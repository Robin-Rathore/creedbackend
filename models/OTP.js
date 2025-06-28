const mongoose = require("mongoose")
const mailSender = require("../utils/emailService")

const OTPSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  otp: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 60 * 5, // 5 minutes
  },
})

// Pre-save middleware to send OTP email
OTPSchema.pre("save", async function (next) {
  if (this.isNew) {
    try {
      await mailSender.sendEmail({
        email: this.email,
        subject: "Verification From Creed",
        template: "emailVerification",
        data: {
          name: "User",
          otp: this.otp,
        },
      })
      console.log("OTP email sent successfully")
    } catch (error) {
      console.log("Error occurred while sending OTP email:", error)
    }
  }
  next()
})

module.exports = mongoose.model("OTP", OTPSchema)
