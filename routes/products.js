const express = require("express")
const router = express.Router()
const {
  getProducts,
  getProduct,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  getFeaturedProducts,
  getLatestProducts,
  getBestSellingProducts,
  getTopRatedProducts,
  searchProducts,
  getRelatedProducts,
} = require("../controllers/productController")
const { getProductReviews, getReviewStats, createReview } = require("../controllers/reviewController")
const { protect, restrictTo } = require("../middleware/auth")
const { validateProduct, validateReview, validateObjectId } = require("../middleware/validation")
const upload = require("../middleware/upload")

/**
 * @route   GET /api/v1/products
 * @desc    Get all products with filtering and pagination
 * @access  Public
 */
router.get("/", getProducts)

/**
 * @route   GET /api/v1/products/featured
 * @desc    Get featured products
 * @access  Public
 */
router.get("/featured", getFeaturedProducts)

/**
 * @route   GET /api/v1/products/latest
 * @desc    Get latest products
 * @access  Public
 */
router.get("/latest", getLatestProducts)

/**
 * @route   GET /api/v1/products/best-selling
 * @desc    Get best selling products
 * @access  Public
 */
router.get("/best-selling", getBestSellingProducts)

/**
 * @route   GET /api/v1/products/top-rated
 * @desc    Get top rated products
 * @access  Public
 */
router.get("/top-rated", getTopRatedProducts)

/**
 * @route   GET /api/v1/products/search
 * @desc    Search products
 * @access  Public
 */
router.get("/search", searchProducts)

/**
 * @route   GET /api/v1/products/slug/:slug
 * @desc    Get product by slug
 * @access  Public
 */
router.get("/slug/:slug", getProductBySlug)

/**
 * @route   POST /api/v1/products
 * @desc    Create new product
 * @access  Private (Admin/Seller)
 */
router.post("/", protect, restrictTo("admin", "seller"), upload.array("images", 5), validateProduct, createProduct)

/**
 * @route   GET /api/v1/products/:id
 * @desc    Get single product
 * @access  Public
 */
router.get("/:id", validateObjectId(), getProduct)

/**
 * @route   PUT /api/v1/products/:id
 * @desc    Update product
 * @access  Private (Admin/Seller)
 */
router.put("/:id", protect, restrictTo("admin", "seller"), validateObjectId(), upload.array("images", 5), updateProduct)

/**
 * @route   DELETE /api/v1/products/:id
 * @desc    Delete product
 * @access  Private (Admin/Seller)
 */
router.delete("/:id", protect, restrictTo("admin", "seller"), validateObjectId(), deleteProduct)

/**
 * @route   GET /api/v1/products/:id/related
 * @desc    Get related products
 * @access  Public
 */
router.get("/:id/related", validateObjectId(), getRelatedProducts)

// Product Reviews Routes
/**
 * @route   GET /api/v1/products/:productId/reviews
 * @desc    Get all reviews for a product
 * @access  Public
 */
router.get("/:productId/reviews", validateObjectId("productId"), getProductReviews)

/**
 * @route   GET /api/v1/products/:productId/reviews/stats
 * @desc    Get review statistics for a product
 * @access  Public
 */
router.get("/:productId/reviews/stats", validateObjectId("productId"), getReviewStats)

/**
 * @route   POST /api/v1/products/:productId/reviews
 * @desc    Create new review for a product
 * @access  Private
 */
router.post(
  "/:productId/reviews",
  protect,
  validateObjectId("productId"),
  upload.array("images", 3),
  validateReview,
  createReview,
)

module.exports = router
