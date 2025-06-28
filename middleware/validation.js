const { body, param, query, validationResult } = require("express-validator")

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    })
  }
  next()
}

/**
 * User registration validation
 */
const validateUserRegistration = [
  body("firstName")
    .trim()
    .notEmpty()
    .withMessage("First name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters"),

  body("lastName")
    .trim()
    .notEmpty()
    .withMessage("Last name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must be between 2 and 50 characters"),

  body("email").isEmail().withMessage("Please provide a valid email").normalizeEmail(),

  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters long"),

  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error("Password confirmation does not match password")
    }
    return true
  }),

  body("otp")
    .isLength({ min: 4, max: 4 })
    .withMessage("OTP must be 4 digits")
    .isNumeric()
    .withMessage("OTP must contain only numbers"),

  body("phone").optional().isMobilePhone().withMessage("Please provide a valid phone number"),

  handleValidationErrors,
]

/**
 * User login validation
 */
const validateUserLogin = [
  body("email").isEmail().withMessage("Please provide a valid email").normalizeEmail(),

  body("password").notEmpty().withMessage("Password is required"),

  handleValidationErrors,
]

/**
 * Product validation
 */
const validateProduct = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Product name is required")
    .isLength({ max: 200 })
    .withMessage("Product name cannot exceed 200 characters"),

  body("description")
    .trim()
    .notEmpty()
    .withMessage("Product description is required")
    .isLength({ max: 2000 })
    .withMessage("Description cannot exceed 2000 characters"),

  body("price").isFloat({ min: 0 }).withMessage("Price must be a positive number"),

  body("category").isMongoId().withMessage("Valid category ID is required"),

  body("stock").isInt({ min: 0 }).withMessage("Stock must be a non-negative integer"),

  body("sku").trim().notEmpty().withMessage("SKU is required"),

  handleValidationErrors,
]

/**
 * Category validation
 */
const validateCategory = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Category name is required")
    .isLength({ max: 100 })
    .withMessage("Category name cannot exceed 100 characters"),

  body("parent").optional().isMongoId().withMessage("Valid parent category ID is required"),

  handleValidationErrors,
]

/**
 * Order validation
 */
const validateOrder = [
  body("items").isArray({ min: 1 }).withMessage("Order must contain at least one item"),

  body("items.*.product").isMongoId().withMessage("Valid product ID is required"),

  body("items.*.quantity").isInt({ min: 1 }).withMessage("Quantity must be at least 1"),

  body("shippingAddress.firstName").trim().notEmpty().withMessage("Shipping first name is required"),

  body("shippingAddress.lastName").trim().notEmpty().withMessage("Shipping last name is required"),

  body("shippingAddress.address1").trim().notEmpty().withMessage("Shipping address is required"),

  body("shippingAddress.city").trim().notEmpty().withMessage("Shipping city is required"),

  body("shippingAddress.postalCode").trim().notEmpty().withMessage("Shipping postal code is required"),

  body("payment.method")
    .isIn(["credit_card", "debit_card", "paypal", "stripe", "razorpay", "cod"])
    .withMessage("Valid payment method is required"),

  handleValidationErrors,
]

/**
 * Review validation
 */
const validateReview = [
  body("rating").isInt({ min: 1, max: 5 }).withMessage("Rating must be between 1 and 5"),

  body("comment")
    .trim()
    .notEmpty()
    .withMessage("Review comment is required")
    .isLength({ max: 1000 })
    .withMessage("Comment cannot exceed 1000 characters"),

  body("title").optional().trim().isLength({ max: 100 }).withMessage("Title cannot exceed 100 characters"),

  handleValidationErrors,
]

/**
 * MongoDB ObjectId validation
 */
const validateObjectId = (field = "id") => [
  param(field).isMongoId().withMessage(`Valid ${field} is required`),

  handleValidationErrors,
]

module.exports = {
  validateUserRegistration,
  validateUserLogin,
  validateProduct,
  validateCategory,
  validateOrder,
  validateReview,
  validateObjectId,
  handleValidationErrors,
}
