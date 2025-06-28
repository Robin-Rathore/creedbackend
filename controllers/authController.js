const crypto = require("crypto")
const jwt = require("jsonwebtoken")
const User = require("../models/User")
const OTP = require("../models/OTP")
const otpGenerator = require("otp-generator")
const { sendEmail } = require("../utils/emailService")
const { hashPassword, comparePassword } = require("../utils/helpers")

/**
 * Generate JWT tokens
 */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  })
}

/**
 * @desc    Send OTP for registration
 * @route   POST /api/v1/auth/send-otp
 * @access  Public
 */
const sendOTP = async (req, res) => {
  try {
    const { email } = req.body

    // Check if user already exists
    const checkUserPresent = await User.findOne({ email })
    if (checkUserPresent) {
      return res.status(401).json({
        success: false,
        message: "User already registered",
      })
    }

    // Generate OTP
    var otp = otpGenerator.generate(4, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    })

    // Check unique OTP
    let result = await OTP.findOne({ otp: otp })
    while (result) {
      otp = otpGenerator.generate(4, {
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false,
      })
      result = await OTP.findOne({ otp: otp })
    }

    const otpPayload = { email, otp }
    const otpBody = await OTP.create(otpPayload)

    res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      otp, // Remove this in production
    })
  } catch (error) {
    console.log(error)
    return res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

/**
 * @desc    Register user
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword, otp } = req.body

    // Validation
    if (!firstName || !lastName || !email || !password || !confirmPassword || !otp) {
      return res.status(400).json({
        success: false,
        message: "Please provide all credentials",
      })
    }

    if (confirmPassword !== password) {
      return res.status(400).json({
        success: false,
        message: "Password not matched",
      })
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      })
    }

    // Verify OTP
    const response = await OTP.find({ email }).sort({ createdAt: -1 }).limit(1)
    if (response.length === 0) {
      return res.status(400).json({
        success: false,
        message: "OTP not found",
      })
    } else if (otp !== response[0].otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      })
    }

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      avatar: {
        url: `https://api.dicebear.com/7.x/initials/svg?seed=${firstName} ${lastName}`,
      },
    })

    // Generate JWT token
    const token = generateToken(user._id)

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error during registration",
      error: error.message,
    })
  }
}

/**
 * @desc    Login user
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body

    // Check if user exists and get password
    const user = await User.findOne({ email }).select("+password")
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      })
    }

    // Check if password matches
    const isPasswordValid = await user.comparePassword(password)
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      })
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account has been deactivated",
      })
    }

    // Update last login
    user.lastLogin = new Date()
    await user.save({ validateBeforeSave: false })

    // Generate JWT token
    const token = generateToken(user._id)

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        avatar: user.avatar,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error during login",
      error: error.message,
    })
  }
}

/**
 * @desc    Logout user
 * @route   POST /api/v1/auth/logout
 * @access  Private
 */
const logout = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: "Logout successful",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error during logout",
      error: error.message,
    })
  }
}

/**
 * @desc    Forgot password
 * @route   POST /api/v1/auth/forgot-password
 * @access  Public
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body

    const user = await User.findOne({ email })
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No user found with this email",
      })
    }

    // Generate reset token
    const resetToken = user.generatePasswordResetToken()
    await user.save({ validateBeforeSave: false })

    // Create reset URL
    const resetUrl = `${process.env.RESET_PASSWORD_DOMAIN}/update-password/${resetToken}`

    try {
      await sendEmail({
        email: user.email,
        subject: "Password Reset - Creed",
        template: "passwordReset",
        data: {
          name: user.fullName,
          resetUrl,
        },
      })

      res.status(200).json({
        success: true,
        message: "Password reset email sent",
      })
    } catch (error) {
      user.passwordResetToken = undefined
      user.passwordResetExpires = undefined
      await user.save({ validateBeforeSave: false })

      return res.status(500).json({
        success: false,
        message: "Email could not be sent",
      })
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
}

/**
 * @desc    Reset password
 * @route   POST /api/v1/auth/reset-password/:token
 * @access  Public
 */
const resetPassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body

    if (password !== confirmPassword) {
      return res.json({
        success: false,
        message: "Password not matching",
      })
    }

    // Get hashed token
    const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex")

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    })

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      })
    }

    // Set new password
    user.password = password
    user.passwordResetToken = undefined
    user.passwordResetExpires = undefined
    await user.save()

    // Generate JWT token
    const token = generateToken(user._id)

    res.status(200).json({
      success: true,
      message: "Password reset successful",
      token,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
}

/**
 * @desc    Verify email
 * @route   GET /api/v1/auth/verify-email/:token
 * @access  Public
 */
const verifyEmail = async (req, res) => {
  try {
    // Get hashed token
    const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex")

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    })

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification token",
      })
    }

    // Verify email
    user.isEmailVerified = true
    user.emailVerificationToken = undefined
    user.emailVerificationExpires = undefined
    await user.save({ validateBeforeSave: false })

    res.status(200).json({
      success: true,
      message: "Email verified successfully",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
}

/**
 * @desc    Resend verification email
 * @route   POST /api/v1/auth/resend-verification
 * @access  Public
 */
const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body

    const user = await User.findOne({ email })
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No user found with this email",
      })
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified",
      })
    }

    // Generate new verification token
    const verificationToken = user.generateEmailVerificationToken()
    await user.save({ validateBeforeSave: false })

    // Send verification email
    const verificationUrl = `${req.protocol}://${req.get("host")}/api/v1/auth/verify-email/${verificationToken}`

    await sendEmail({
      email: user.email,
      subject: "Email Verification - Creed",
      template: "emailVerification",
      data: {
        name: user.fullName,
        verificationUrl,
      },
    })

    res.status(200).json({
      success: true,
      message: "Verification email sent",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
}

/**
 * @desc    Refresh token
 * @route   POST /api/v1/auth/refresh-token
 * @access  Public
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token is required",
      })
    }

    // Verify refresh token
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET)
      const user = await User.findById(decoded.id)

      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: "Invalid refresh token",
        })
      }

      // Generate new access token
      const accessToken = generateToken(user._id)

      res.status(200).json({
        success: true,
        message: "Token refreshed successfully",
        token: accessToken,
      })
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      })
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
}

/**
 * @desc    Change password
 * @route   PUT /api/v1/auth/change-password
 * @access  Private
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body

    // Get user with password
    const user = await User.findById(req.user.id).select("+password")

    // Check current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword)
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      })
    }

    // Update password
    user.password = newPassword
    await user.save()

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
}

module.exports = {
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
}
