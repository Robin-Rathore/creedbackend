const express = require("express")
const router = express.Router()
const {
  sendOTP,
  register,
  login,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerificationEmail,
  refreshToken,
  changePassword,
} = require("../controllers/authController")
const { protect } = require("../middleware/auth")
const { validateUserRegistration, validateUserLogin } = require("../middleware/validation")

/**
 * @route   POST /api/v1/auth/send-otp
 * @desc    Send OTP for registration
 * @access  Public
 */
router.post("/send-otp", sendOTP)

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post("/register", validateUserRegistration, register)

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post("/login", validateUserLogin, login)

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post("/logout", protect, logout)

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 */
router.post("/forgot-password", forgotPassword)

/**
 * @route   POST /api/v1/auth/reset-password/:token
 * @desc    Reset password with token
 * @access  Public
 */
router.post("/reset-password/:token", resetPassword)

/**
 * @route   GET /api/v1/auth/verify-email/:token
 * @desc    Verify email address
 * @access  Public
 */
router.get("/verify-email/:token", verifyEmail)

/**
 * @route   POST /api/v1/auth/resend-verification
 * @desc    Resend email verification
 * @access  Public
 */
router.post("/resend-verification", resendVerificationEmail)

/**
 * @route   POST /api/v1/auth/refresh-token
 * @desc    Refresh access token
 * @access  Public
 */
router.post("/refresh-token", refreshToken)

/**
 * @route   PUT /api/v1/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.put("/change-password", protect, changePassword)

module.exports = router
