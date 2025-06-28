const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Coupon = require('../models/Coupon');
const {
  calculatePagination,
  generateOrderNumber,
  calculateTax,
  calculateShippingCost,
} = require('../utils/helpers');
const { sendEmail } = require('../utils/emailService');

/**
 * @desc    Create new order
 * @route   POST /api/orders
 * @access  Private
 */
const createOrder = async (req, res) => {
  try {
    const {
      items,
      shippingAddress,
      billingAddress,
      paymentMethod,
      couponCode,
      shippingMethod = 'standard',
      notes,
    } = req.body;

    // Validate and calculate order totals
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.product}`,
        });
      }

      if (product.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: `Product is not available: ${product.name}`,
        });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product: ${product.name}`,
        });
      }

      const itemSubtotal = product.price * item.quantity;

      orderItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        size: item.size,
        color: item.color,
        sku: product.sku,
        image: {
          url: product.images[0]?.url,
          alt: product.images[0]?.alt,
        },
        subtotal: itemSubtotal,
      });

      subtotal += itemSubtotal;
    }

    // Apply coupon if provided
    let discount = 0;
    let couponData = null;
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
      if (!coupon) {
        return res.status(400).json({
          success: false,
          message: 'Invalid coupon code',
        });
      }

      // Get user's order count for first-time user check
      const userOrderCount = await Order.countDocuments({ user: req.user.id });

      if (!coupon.isValidForUser(req.user.id, subtotal, userOrderCount)) {
        return res.status(400).json({
          success: false,
          message: 'Coupon is not valid for this order',
        });
      }

      discount = coupon.calculateDiscount(subtotal);
      couponData = {
        code: coupon.code,
        discount,
        type: coupon.type,
      };
    }

    // Calculate shipping
    const totalWeight = orderItems.reduce((weight, item) => {
      // Assuming weight is stored in product, default to 1kg if not specified
      return weight + (item.product.weight?.value || 1) * item.quantity;
    }, 0);

    const shipping = calculateShippingCost(totalWeight, 100, shippingMethod); // Assuming 100km distance

    // Calculate tax (8% default)
    const taxableAmount = subtotal - discount;
    const tax = calculateTax(taxableAmount);

    // Calculate total
    const total = subtotal - discount + shipping + tax;

    // Create order
    const order = await Order.create({
      user: req.user.id,
      items: orderItems,
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      pricing: {
        subtotal,
        tax,
        shipping,
        discount,
        total,
      },
      coupon: couponData,
      payment: {
        method: paymentMethod,
        status: paymentMethod === 'cod' ? 'pending' : 'processing',
      },
      shipping: {
        method: shippingMethod,
      },
      notes: notes
        ? [
            {
              message: notes,
              isCustomerVisible: true,
              createdBy: req.user.id,
            },
          ]
        : [],
    });

    // Update product stock and sold count
    for (const item of orderItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: {
          stock: -item.quantity,
          soldCount: item.quantity,
        },
      });
    }

    // Update coupon usage if applied
    if (couponData) {
      await Coupon.findOneAndUpdate(
        { code: couponCode.toUpperCase() },
        {
          $inc: { usedCount: 1 },
          $push: {
            usageHistory: {
              user: req.user.id,
              order: order._id,
              discountAmount: discount,
            },
          },
        }
      );
    }

    // Clear user's cart
    await User.findByIdAndUpdate(req.user.id, { $set: { cart: [] } });

    // Add order to user's orders
    await User.findByIdAndUpdate(req.user.id, { $push: { orders: order._id } });

    // Send order confirmation email
    try {
      await sendEmail({
        email: req.user.email,
        subject: 'Order Confirmation - Creed',
        template: 'orderConfirmation',
        data: {
          customerName: `${req.user.firstName} ${req.user.lastName}`,
          orderNumber: order.orderNumber,
          orderDate: order.createdAt.toLocaleDateString(),
          items: orderItems,
          total: total.toFixed(2),
        },
      });
    } catch (emailError) {
      console.error('Failed to send order confirmation email:', emailError);
    }

    await order.populate('items.product', 'name images');

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating order',
      error: error.message,
    });
  }
};

/**
 * @desc    Get all orders (Admin)
 * @route   GET /api/orders
 * @access  Private (Admin)
 */
const getAllOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      paymentStatus,
      dateFrom,
      dateTo,
      search,
    } = req.query;

    const query = {};

    // Filter by status
    if (status) query.status = status;

    // Filter by payment status
    if (paymentStatus) query['payment.status'] = paymentStatus;

    // Filter by date range
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    // Search by order number or customer email
    if (search) {
      query.$or = [
        { orderNumber: new RegExp(search, 'i') },
        { 'shippingAddress.firstName': new RegExp(search, 'i') },
        { 'shippingAddress.lastName': new RegExp(search, 'i') },
      ];
    }

    const total = await Order.countDocuments(query);
    const pagination = calculatePagination(page, limit, total);

    const orders = await Order.find(query)
      .populate('user', 'firstName lastName email')
      .populate('items.product', 'name images')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.itemsPerPage);

    res.status(200).json({
      success: true,
      count: orders.length,
      pagination,
      data: orders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching orders',
      error: error.message,
    });
  }
};

/**
 * @desc    Get single order
 * @route   GET /api/orders/:id
 * @access  Private
 */
const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'firstName lastName email phone')
      .populate('items.product', 'name images');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Check if user owns the order (unless admin)
    if (
      req.user.role !== 'admin' &&
      order.user._id.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this order',
      });
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching order',
      error: error.message,
    });
  }
};

/**
 * @desc    Update order status
 * @route   PUT /api/orders/:id/status
 * @access  Private (Admin)
 */
const updateOrderStatus = async (req, res) => {
  try {
    const { status, note } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Add status to history
    order.addStatusHistory(status, note, req.user.id);

    // Update specific fields based on status
    if (status === 'shipped') {
      order.shipping.shippedAt = new Date();
    } else if (status === 'delivered') {
      order.shipping.deliveredAt = new Date();
      order.payment.status = 'completed';
      order.payment.paidAt = new Date();
    } else if (status === 'cancelled') {
      order.cancellation = {
        reason: note,
        cancelledAt: new Date(),
        cancelledBy: req.user.id,
        refundStatus: 'pending',
      };

      // Restore product stock
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: {
            stock: item.quantity,
            soldCount: -item.quantity,
          },
        });
      }
    }

    await order.save();

    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating order status',
      error: error.message,
    });
  }
};

/**
 * @desc    Update payment status
 * @route   PUT /api/orders/:id/payment
 * @access  Private (Admin)
 */
const updatePaymentStatus = async (req, res) => {
  try {
    const { status, transactionId, paymentIntentId } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    order.payment.status = status;
    if (transactionId) order.payment.transactionId = transactionId;
    if (paymentIntentId) order.payment.paymentIntentId = paymentIntentId;

    if (status === 'completed') {
      order.payment.paidAt = new Date();
      if (order.status === 'pending') {
        order.addStatusHistory('confirmed', 'Payment confirmed', req.user.id);
      }
    } else if (status === 'failed') {
      order.addStatusHistory('cancelled', 'Payment failed', req.user.id);
    }

    await order.save();

    res.status(200).json({
      success: true,
      message: 'Payment status updated successfully',
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating payment status',
      error: error.message,
    });
  }
};

/**
 * @desc    Add tracking information
 * @route   PUT /api/orders/:id/tracking
 * @access  Private (Admin)
 */
const addTrackingInfo = async (req, res) => {
  try {
    const { trackingNumber, carrier, estimatedDelivery } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    order.shipping.trackingNumber = trackingNumber;
    order.shipping.carrier = carrier;
    if (estimatedDelivery) {
      order.shipping.estimatedDelivery = new Date(estimatedDelivery);
    }

    await order.save();

    res.status(200).json({
      success: true,
      message: 'Tracking information added successfully',
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error adding tracking information',
      error: error.message,
    });
  }
};

/**
 * @desc    Cancel order
 * @route   PUT /api/orders/:id/cancel
 * @access  Private
 */
const cancelOrder = async (req, res) => {
  try {
    const { reason } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Check if user owns the order (unless admin)
    if (req.user.role !== 'admin' && order.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this order',
      });
    }

    // Check if order can be cancelled
    if (['shipped', 'delivered', 'cancelled'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled at this stage',
      });
    }

    order.addStatusHistory('cancelled', reason, req.user.id);
    order.cancellation = {
      reason,
      cancelledAt: new Date(),
      cancelledBy: req.user.id,
      refundStatus: 'pending',
    };

    // Restore product stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: {
          stock: item.quantity,
          soldCount: -item.quantity,
        },
      });
    }

    await order.save();

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error cancelling order',
      error: error.message,
    });
  }
};

/**
 * @desc    Get order statistics
 * @route   GET /api/orders/stats
 * @access  Private (Admin)
 */
const getOrderStats = async (req, res) => {
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

    const stats = await Order.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$pricing.total' },
          averageOrderValue: { $avg: '$pricing.total' },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
          },
          confirmedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] },
          },
          shippedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'shipped'] }, 1, 0] },
          },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] },
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
          },
        },
      },
    ]);

    const result = stats[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      averageOrderValue: 0,
      pendingOrders: 0,
      confirmedOrders: 0,
      shippedOrders: 0,
      deliveredOrders: 0,
      cancelledOrders: 0,
    };

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching order statistics',
      error: error.message,
    });
  }
};

module.exports = {
  createOrder,
  getAllOrders,
  getOrder,
  updateOrderStatus,
  updatePaymentStatus,
  addTrackingInfo,
  cancelOrder,
  getOrderStats,
};
