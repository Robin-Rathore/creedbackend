const Coupon = require('../models/Coupon');
const Order = require('../models/Order'); // Import Order model
const { calculatePagination, generateCouponCode } = require('../utils/helpers');

/**
 * @desc    Get all coupons (Admin)
 * @route   GET /api/coupons
 * @access  Private (Admin)
 */
const getAllCoupons = async (req, res) => {
  try {
    const { page = 1, limit = 20, isActive, type } = req.query;

    const query = {};

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (type) {
      query.type = type;
    }

    const total = await Coupon.countDocuments(query);
    const pagination = calculatePagination(page, limit, total);

    const coupons = await Coupon.find(query)
      .populate('createdBy', 'firstName lastName')
      .populate('applicableProducts', 'name')
      .populate('applicableCategories', 'name')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.itemsPerPage);

    res.status(200).json({
      success: true,
      count: coupons.length,
      pagination,
      data: coupons,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching coupons',
      error: error.message,
    });
  }
};

/**
 * @desc    Get single coupon
 * @route   GET /api/coupons/:id
 * @access  Private (Admin)
 */
const getCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id)
      .populate('createdBy', 'firstName lastName')
      .populate('applicableProducts', 'name price')
      .populate('applicableCategories', 'name')
      .populate('excludedProducts', 'name')
      .populate('excludedCategories', 'name')
      .populate('applicableUsers', 'firstName lastName email');

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found',
      });
    }

    res.status(200).json({
      success: true,
      data: coupon,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching coupon',
      error: error.message,
    });
  }
};

/**
 * @desc    Create new coupon
 * @route   POST /api/coupons
 * @access  Private (Admin)
 */
const createCoupon = async (req, res) => {
  try {
    const {
      code,
      description,
      type,
      value,
      minimumOrderAmount,
      maximumDiscountAmount,
      usageLimit,
      usageLimitPerUser,
      validFrom,
      validUntil,
      applicableProducts,
      applicableCategories,
      excludedProducts,
      excludedCategories,
      applicableUsers,
      firstTimeUserOnly,
    } = req.body;

    // Generate code if not provided
    const couponCode = code || generateCouponCode();

    // Check if coupon code already exists
    const existingCoupon = await Coupon.findOne({
      code: couponCode.toUpperCase(),
    });
    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code already exists',
      });
    }

    const coupon = await Coupon.create({
      code: couponCode.toUpperCase(),
      description,
      type,
      value,
      minimumOrderAmount: minimumOrderAmount || 0,
      maximumDiscountAmount,
      usageLimit,
      usageLimitPerUser: usageLimitPerUser || 1,
      validFrom: new Date(validFrom),
      validUntil: new Date(validUntil),
      applicableProducts: applicableProducts || [],
      applicableCategories: applicableCategories || [],
      excludedProducts: excludedProducts || [],
      excludedCategories: excludedCategories || [],
      applicableUsers: applicableUsers || [],
      firstTimeUserOnly: firstTimeUserOnly || false,
      createdBy: req.user.id,
    });

    await coupon.populate('createdBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      data: coupon,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating coupon',
      error: error.message,
    });
  }
};

/**
 * @desc    Update coupon
 * @route   PUT /api/coupons/:id
 * @access  Private (Admin)
 */
const updateCoupon = async (req, res) => {
  try {
    let coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found',
      });
    }

    // Check if code is being changed and if new code already exists
    if (req.body.code && req.body.code.toUpperCase() !== coupon.code) {
      const existingCoupon = await Coupon.findOne({
        code: req.body.code.toUpperCase(),
      });
      if (existingCoupon) {
        return res.status(400).json({
          success: false,
          message: 'Coupon code already exists',
        });
      }
      req.body.code = req.body.code.toUpperCase();
    }

    // Convert date strings to Date objects
    if (req.body.validFrom) req.body.validFrom = new Date(req.body.validFrom);
    if (req.body.validUntil)
      req.body.validUntil = new Date(req.body.validUntil);

    coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('createdBy', 'firstName lastName');

    res.status(200).json({
      success: true,
      message: 'Coupon updated successfully',
      data: coupon,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating coupon',
      error: error.message,
    });
  }
};

/**
 * @desc    Delete coupon
 * @route   DELETE /api/coupons/:id
 * @access  Private (Admin)
 */
const deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found',
      });
    }

    await Coupon.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Coupon deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting coupon',
      error: error.message,
    });
  }
};

/**
 * @desc    Validate coupon
 * @route   POST /api/coupons/validate
 * @access  Private
 */
const validateCoupon = async (req, res) => {
  try {
    const { code, orderAmount } = req.body;

    if (!code || !orderAmount) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code and order amount are required',
      });
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase() });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Invalid coupon code',
      });
    }

    // Get user's order count for first-time user check
    const userOrderCount = await Order.countDocuments({ user: req.user.id });

    // Check if coupon is valid for user
    if (!coupon.isValidForUser(req.user.id, orderAmount, userOrderCount)) {
      return res.status(400).json({
        success: false,
        message: 'Coupon is not valid for this order',
      });
    }

    // Calculate discount
    const discountAmount = coupon.calculateDiscount(orderAmount);

    res.status(200).json({
      success: true,
      message: 'Coupon is valid',
      data: {
        code: coupon.code,
        description: coupon.description,
        type: coupon.type,
        value: coupon.value,
        discountAmount,
        minimumOrderAmount: coupon.minimumOrderAmount,
        maximumDiscountAmount: coupon.maximumDiscountAmount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error validating coupon',
      error: error.message,
    });
  }
};

/**
 * @desc    Get coupon usage statistics
 * @route   GET /api/coupons/:id/stats
 * @access  Private (Admin)
 */
const getCouponStats = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found',
      });
    }

    const stats = {
      totalUsage: coupon.usedCount,
      remainingUsage: coupon.usageLimit
        ? coupon.usageLimit - coupon.usedCount
        : 'Unlimited',
      totalDiscountGiven: coupon.usageHistory.reduce(
        (total, usage) => total + usage.discountAmount,
        0
      ),
      uniqueUsers: new Set(
        coupon.usageHistory.map((usage) => usage.user.toString())
      ).size,
      usageByDate: {},
    };

    // Group usage by date
    coupon.usageHistory.forEach((usage) => {
      const date = usage.usedAt.toISOString().split('T')[0];
      stats.usageByDate[date] = (stats.usageByDate[date] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching coupon statistics',
      error: error.message,
    });
  }
};

/**
 * @desc    Get active coupons for user
 * @route   GET /api/coupons/active
 * @access  Private
 */
const getActiveCoupons = async (req, res) => {
  try {
    const now = new Date();

    const coupons = await Coupon.find({
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now },
      $or: [
        { usageLimit: null },
        { $expr: { $lt: ['$usedCount', '$usageLimit'] } },
      ],
    }).select(
      'code description type value minimumOrderAmount maximumDiscountAmount'
    );

    // Filter coupons that are applicable to the user
    const applicableCoupons = [];

    for (const coupon of coupons) {
      // Check if coupon is applicable to user
      if (coupon.applicableUsers.length > 0) {
        if (!coupon.applicableUsers.includes(req.user.id)) {
          continue;
        }
      }

      // Check usage limit per user
      const userUsageCount = coupon.usageHistory.filter(
        (usage) => usage.user.toString() === req.user.id
      ).length;

      if (userUsageCount >= coupon.usageLimitPerUser) {
        continue;
      }

      // Check first time user only
      if (coupon.firstTimeUserOnly) {
        const userOrderCount = await Order.countDocuments({
          user: req.user.id,
        });
        if (userOrderCount > 0) {
          continue;
        }
      }

      applicableCoupons.push(coupon);
    }

    res.status(200).json({
      success: true,
      count: applicableCoupons.length,
      data: applicableCoupons,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching active coupons',
      error: error.message,
    });
  }
};

module.exports = {
  getAllCoupons,
  getCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
  getCouponStats,
  getActiveCoupons,
};
