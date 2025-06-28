const Category = require("../models/Category")
const Product = require("../models/Product")
const { generateSlug, calculatePagination } = require("../utils/helpers")
const cloudinary = require("../config/cloudinary")

/**
 * @desc    Get all categories
 * @route   GET /api/v1/categories
 * @access  Public
 */
const getCategories = async (req, res) => {
  try {
    const { level, parent, featured } = req.query

    const query = { isActive: true }

    // Filter by level
    if (level !== undefined) {
      query.level = Number(level)
    }

    // Filter by parent
    if (parent) {
      if (parent === "null") {
        query.parent = null
      } else {
        query.parent = parent
      }
    }

    // Filter by featured
    if (featured === "true") {
      query.isFeatured = true
    }

    const categories = await Category.find(query)
      .populate("parent", "name slug")
      .populate("children", "name slug image")
      .sort({ sortOrder: 1, name: 1 })

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching categories",
      error: error.message,
    })
  }
}

/**
 * @desc    Get category tree (hierarchical structure)
 * @route   GET /api/v1/categories/tree
 * @access  Public
 */
const getCategoryTree = async (req, res) => {
  try {
    // Get all root categories (level 0)
    const rootCategories = await Category.find({
      level: 0,
      isActive: true,
    })
      .populate({
        path: "children",
        match: { isActive: true },
        populate: {
          path: "children",
          match: { isActive: true },
        },
      })
      .sort({ sortOrder: 1, name: 1 })

    res.status(200).json({
      success: true,
      data: rootCategories,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching category tree",
      error: error.message,
    })
  }
}

/**
 * @desc    Get single category
 * @route   GET /api/v1/categories/:id
 * @access  Public
 */
const getCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
      .populate("parent", "name slug")
      .populate("children", "name slug image")

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      })
    }

    res.status(200).json({
      success: true,
      data: category,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching category",
      error: error.message,
    })
  }
}

/**
 * @desc    Get category by slug
 * @route   GET /api/v1/categories/slug/:slug
 * @access  Public
 */
const getCategoryBySlug = async (req, res) => {
  try {
    const category = await Category.findOne({ slug: req.params.slug })
      .populate("parent", "name slug")
      .populate("children", "name slug image")

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      })
    }

    res.status(200).json({
      success: true,
      data: category,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching category",
      error: error.message,
    })
  }
}

/**
 * @desc    Create new category
 * @route   POST /api/v1/categories
 * @access  Private (Admin)
 */
const createCategory = async (req, res) => {
  try {
    const {
      name,
      description,
      parent,
      icon,
      sortOrder,
      isFeatured,
      seoTitle,
      seoDescription,
      metaKeywords,
      attributes,
    } = req.body

    // Generate slug
    const slug = generateSlug(name)

    // Handle image upload
    let image = {}
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "categories",
        quality: "auto",
        fetch_format: "auto",
      })

      image = {
        public_id: result.public_id,
        url: result.secure_url,
        alt: name,
      }
    }

    const category = await Category.create({
      name,
      description,
      slug,
      parent: parent || null,
      image,
      icon,
      sortOrder: sortOrder || 0,
      isFeatured: isFeatured || false,
      seoTitle,
      seoDescription,
      metaKeywords: metaKeywords ? metaKeywords.split(",").map((keyword) => keyword.trim()) : [],
      attributes: attributes ? JSON.parse(attributes) : [],
    })

    await category.populate("parent", "name slug")

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating category",
      error: error.message,
    })
  }
}

/**
 * @desc    Update category
 * @route   PUT /api/v1/categories/:id
 * @access  Private (Admin)
 */
const updateCategory = async (req, res) => {
  try {
    let category = await Category.findById(req.params.id)

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      })
    }

    // Handle image upload
    if (req.file) {
      // Delete old image from cloudinary
      if (category.image && category.image.public_id) {
        await cloudinary.uploader.destroy(category.image.public_id)
      }

      // Upload new image
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "categories",
        quality: "auto",
        fetch_format: "auto",
      })

      req.body.image = {
        public_id: result.public_id,
        url: result.secure_url,
        alt: req.body.name || category.name,
      }
    }

    // Update slug if name changed
    if (req.body.name && req.body.name !== category.name) {
      req.body.slug = generateSlug(req.body.name)
    }

    // Parse arrays
    if (req.body.metaKeywords && typeof req.body.metaKeywords === "string") {
      req.body.metaKeywords = req.body.metaKeywords.split(",").map((keyword) => keyword.trim())
    }
    if (req.body.attributes && typeof req.body.attributes === "string") {
      req.body.attributes = JSON.parse(req.body.attributes)
    }

    category = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate("parent", "name slug")

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: category,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating category",
      error: error.message,
    })
  }
}

/**
 * @desc    Delete category
 * @route   DELETE /api/v1/categories/:id
 * @access  Private (Admin)
 */
const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      })
    }

    // Check if category has products
    const productCount = await Product.countDocuments({ category: category._id })
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete category with existing products",
      })
    }

    // Check if category has children
    const childrenCount = await Category.countDocuments({ parent: category._id })
    if (childrenCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete category with subcategories",
      })
    }

    // Delete image from cloudinary
    if (category.image && category.image.public_id) {
      await cloudinary.uploader.destroy(category.image.public_id)
    }

    await Category.findByIdAndDelete(req.params.id)

    res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting category",
      error: error.message,
    })
  }
}

/**
 * @desc    Get category products
 * @route   GET /api/v1/categories/:id/products
 * @access  Public
 */
const getCategoryProducts = async (req, res) => {
  try {
    const { page = 1, limit = 12, sort = "-createdAt" } = req.query

    const category = await Category.findById(req.params.id)
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      })
    }

    // Get all subcategory IDs
    const subcategories = await Category.find({ parent: category._id }).select("_id")
    const categoryIds = [category._id, ...subcategories.map((sub) => sub._id)]

    const query = {
      category: { $in: categoryIds },
      status: "active",
    }

    const total = await Product.countDocuments(query)
    const pagination = calculatePagination(page, limit, total)

    const products = await Product.find(query)
      .populate("category", "name slug")
      .select("-reviews")
      .sort(sort)
      .skip(pagination.skip)
      .limit(pagination.itemsPerPage)

    res.status(200).json({
      success: true,
      count: products.length,
      pagination,
      category: {
        id: category._id,
        name: category.name,
        slug: category.slug,
      },
      data: products,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching category products",
      error: error.message,
    })
  }
}

/**
 * @desc    Update category product count
 * @route   PUT /api/v1/categories/:id/update-count
 * @access  Private (Admin)
 */
const updateCategoryProductCount = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      })
    }

    const productCount = await Product.countDocuments({
      category: category._id,
      status: "active",
    })

    category.productCount = productCount
    await category.save()

    res.status(200).json({
      success: true,
      message: "Category product count updated",
      data: {
        categoryId: category._id,
        productCount,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating category product count",
      error: error.message,
    })
  }
}

module.exports = {
  getCategories,
  getCategoryTree,
  getCategory,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryProducts,
  updateCategoryProductCount,
}
