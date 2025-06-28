const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Category = require('../models/Category');
const Review = require('../models/Review');
const Coupon = require('../models/Coupon');
const { calculatePagination } = require('../utils/helpers');

/**
 * @desc    Get dashboard statistics
 * @route   GET /api/admin/dashboard
 * @access  Private (Admin)
 */
const getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Current month stats
    const currentMonthOrders = await Order.countDocuments({
      createdAt: { $gte: startOfMonth },
    });

    const currentMonthRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfMonth },
          status: { $ne: 'cancelled' },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$pricing.total' },
        },
      },
    ]);

    // Last month stats for comparison
    const lastMonthOrders = await Order.countDocuments({
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
    });

    const lastMonthRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
          status: { $ne: 'cancelled' },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$pricing.total' },
        },
      },
    ]);

    // Overall stats
    const totalUsers = await User.countDocuments({ role: 'user' });
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();
    const totalRevenue = await Order.aggregate([
      {
        $match: { status: { $ne: 'cancelled' } },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$pricing.total' },
        },
      },
    ]);

    // Recent orders
    const recentOrders = await Order.find()
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(5);

    // Top selling products
    const topProducts = await Product.find()
      .sort({ soldCount: -1 })
      .limit(5)
      .select('name soldCount price images');

    // Low stock products
    const lowStockProducts = await Product.find({
      $expr: { $lte: ['$stock', '$lowStockThreshold'] },
      status: 'active',
    })
      .limit(10)
      .select('name stock lowStockThreshold');

    // Order status distribution
    const orderStatusStats = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    // Revenue by month (last 12 months)
    const revenueByMonth = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(now.getFullYear() - 1, now.getMonth(), 1),
          },
          status: { $ne: 'cancelled' },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          revenue: { $sum: '$pricing.total' },
          orders: { $sum: 1 },
        },
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 },
      },
    ]);

    const stats = {
      overview: {
        totalUsers,
        totalProducts,
        totalOrders,
        totalRevenue: totalRevenue[0]?.total || 0,
      },
      currentMonth: {
        orders: currentMonthOrders,
        revenue: currentMonthRevenue[0]?.total || 0,
      },
      lastMonth: {
        orders: lastMonthOrders,
        revenue: lastMonthRevenue[0]?.total || 0,
      },
      growth: {
        orders:
          lastMonthOrders > 0
            ? ((currentMonthOrders - lastMonthOrders) / lastMonthOrders) * 100
            : 0,
        revenue:
          lastMonthRevenue[0]?.total > 0
            ? (((currentMonthRevenue[0]?.total || 0) -
                lastMonthRevenue[0].total) /
                lastMonthRevenue[0].total) *
              100
            : 0,
      },
      recentOrders,
      topProducts,
      lowStockProducts,
      orderStatusStats,
      revenueByMonth,
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard statistics',
      error: error.message,
    });
  }
};

/**
 * @desc    Get all users (Admin)
 * @route   GET /api/admin/users
 * @access  Private (Admin)
 */
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, isActive, search } = req.query;

    const query = {};

    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    if (search) {
      query.$or = [
        { firstName: new RegExp(search, 'i') },
        { lastName: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
      ];
    }

    const total = await User.countDocuments(query);
    const pagination = calculatePagination(page, limit, total);

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.itemsPerPage);

    res.status(200).json({
      success: true,
      count: users.length,
      pagination,
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message,
    });
  }
};

/**
 * @desc    Update user role
 * @route   PUT /api/admin/users/:id/role
 * @access  Private (Admin)
 */
const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;

    if (!['user', 'admin', 'seller'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role',
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'User role updated successfully',
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating user role',
      error: error.message,
    });
  }
};

/**
 * @desc    Toggle user active status
 * @route   PUT /api/admin/users/:id/toggle-status
 * @access  Private (Admin)
 */
const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${
        user.isActive ? 'activated' : 'deactivated'
      } successfully`,
      data: {
        id: user._id,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating user status',
      error: error.message,
    });
  }
};

/**
 * @desc    Delete user
 * @route   DELETE /api/admin/users/:id
 * @access  Private (Admin)
 */
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if user has orders
    const orderCount = await Order.countDocuments({ user: user._id });
    if (orderCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete user with existing orders',
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error.message,
    });
  }
};

/**
 * @desc    Get sales analytics
 * @route   GET /api/admin/analytics/sales
 * @access  Private (Admin)
 */
const getSalesAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;

    let dateFilter = {};
    const now = new Date();

    switch (period) {
      case '7d':
        dateFilter = {
          createdAt: {
            $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          },
        };
        break;
      case '30d':
        dateFilter = {
          createdAt: {
            $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          },
        };
        break;
      case '90d':
        dateFilter = {
          createdAt: {
            $gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
          },
        };
        break;
      case '1y':
        dateFilter = {
          createdAt: {
            $gte: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
          },
        };
        break;
      default:
        dateFilter = {};
    }

    // Sales by day
    const salesByDay = await Order.aggregate([
      {
        $match: {
          ...dateFilter,
          status: { $ne: 'cancelled' },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          revenue: { $sum: '$pricing.total' },
          orders: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Top selling products
    const topSellingProducts = await Order.aggregate([
      {
        $match: {
          ...dateFilter,
          status: { $ne: 'cancelled' },
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalSold: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.subtotal' },
          productName: { $first: '$items.name' },
        },
      },
      {
        $sort: { totalSold: -1 },
      },
      {
        $limit: 10,
      },
    ]);

    // Sales by category
    const salesByCategory = await Order.aggregate([
      {
        $match: {
          ...dateFilter,
          status: { $ne: 'cancelled' },
        },
      },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $lookup: {
          from: 'categories',
          localField: 'product.category',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: '$category' },
      {
        $group: {
          _id: '$category._id',
          categoryName: { $first: '$category.name' },
          revenue: { $sum: '$items.subtotal' },
          orders: { $sum: 1 },
        },
      },
      {
        $sort: { revenue: -1 },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        salesByDay,
        topSellingProducts,
        salesByCategory,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching sales analytics',
      error: error.message,
    });
  }
};

/**
 * @desc    Get inventory analytics
 * @route   GET /api/admin/analytics/inventory
 * @access  Private (Admin)
 */
const getInventoryAnalytics = async (req, res) => {
  try {
    // Low stock products
    const lowStockProducts = await Product.find({
      $expr: { $lte: ['$stock', '$lowStockThreshold'] },
      status: 'active',
    }).select('name stock lowStockThreshold category');

    // Out of stock products
    const outOfStockProducts = await Product.find({
      stock: 0,
      status: 'active',
    }).select('name category');

    // Stock value by category
    const stockValueByCategory = await Product.aggregate([
      {
        $match: { status: 'active' },
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: '$category' },
      {
        $group: {
          _id: '$category._id',
          categoryName: { $first: '$category.name' },
          totalProducts: { $sum: 1 },
          totalStock: { $sum: '$stock' },
          totalValue: { $sum: { $multiply: ['$stock', '$price'] } },
        },
      },
      {
        $sort: { totalValue: -1 },
      },
    ]);

    // Top products by stock value
    const topProductsByValue = await Product.find({ status: 'active' })
      .select('name stock price')
      .sort({ stock: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      data: {
        lowStockProducts,
        outOfStockProducts,
        stockValueByCategory,
        topProductsByValue,
        summary: {
          lowStockCount: lowStockProducts.length,
          outOfStockCount: outOfStockProducts.length,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching inventory analytics',
      error: error.message,
    });
  }
};

module.exports = {
  getDashboardStats,
  getAllUsers,
  updateUserRole,
  toggleUserStatus,
  deleteUser,
  getSalesAnalytics,
  getInventoryAnalytics,
};
