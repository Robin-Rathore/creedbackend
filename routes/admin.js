const express = require("express")
const router = express.Router()
const {
  getDashboardStats,
  getAllUsers,
  updateUserRole,
  toggleUserStatus,
  deleteUser,
  getSalesAnalytics,
  getInventoryAnalytics,
} = require("../controllers/adminController")
const { protect, restrictTo } = require("../middleware/auth")
const { validateObjectId } = require("../middleware/validation")

/**
 * @route   GET /api/v1/admin/dashboard
 * @desc    Get dashboard statistics
 * @access  Private (Admin)
 */
router.get("/dashboard", protect, restrictTo("admin"), getDashboardStats)

/**
 * @route   GET /api/v1/admin/users
 * @desc    Get all users
 * @access  Private (Admin)
 */
router.get("/users", protect, restrictTo("admin"), getAllUsers)

/**
 * @route   PUT /api/v1/admin/users/:id/role
 * @desc    Update user role
 * @access  Private (Admin)
 */
router.put("/users/:id/role", protect, restrictTo("admin"), validateObjectId(), updateUserRole)

/**
 * @route   PUT /api/v1/admin/users/:id/toggle-status
 * @desc    Toggle user active status
 * @access  Private (Admin)
 */
router.put("/users/:id/toggle-status", protect, restrictTo("admin"), validateObjectId(), toggleUserStatus)

/**
 * @route   DELETE /api/v1/admin/users/:id
 * @desc    Delete user
 * @access  Private (Admin)
 */
router.delete("/users/:id", protect, restrictTo("admin"), validateObjectId(), deleteUser)

/**
 * @route   GET /api/v1/admin/analytics/sales
 * @desc    Get sales analytics
 * @access  Private (Admin)
 */
router.get("/analytics/sales", protect, restrictTo("admin"), getSalesAnalytics)

/**
 * @route   GET /api/v1/admin/analytics/inventory
 * @desc    Get inventory analytics
 * @access  Private (Admin)
 */
router.get("/analytics/inventory", protect, restrictTo("admin"), getInventoryAnalytics)

module.exports = router
