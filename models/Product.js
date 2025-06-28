const mongoose = require("mongoose")

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [200, "Product name cannot exceed 200 characters"],
    },
    description: {
      type: String,
      required: [true, "Product description is required"],
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    shortDescription: {
      type: String,
      maxlength: [500, "Short description cannot exceed 500 characters"],
    },
    price: {
      type: Number,
      required: [true, "Product price is required"],
      min: [0, "Price cannot be negative"],
    },
    comparePrice: {
      type: Number,
      min: [0, "Compare price cannot be negative"],
    },
    costPrice: {
      type: Number,
      min: [0, "Cost price cannot be negative"],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Product category is required"],
    },
    subcategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    brand: {
      type: String,
      trim: true,
    },
    sku: {
      type: String,
      unique: true,
      required: [true, "SKU is required"],
    },
    images: [
      {
        public_id: {
          type: String,
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
        alt: String,
      },
    ],
    variants: [
      {
        size: String,
        color: String,
        stock: {
          type: Number,
          required: true,
          min: 0,
        },
        price: Number,
        sku: String,
      },
    ],
    stock: {
      type: Number,
      required: [true, "Stock quantity is required"],
      min: [0, "Stock cannot be negative"],
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
    },
    weight: {
      value: Number,
      unit: {
        type: String,
        enum: ["kg", "g", "lb", "oz"],
        default: "kg",
      },
    },
    dimensions: {
      length: Number,
      width: Number,
      height: Number,
      unit: {
        type: String,
        enum: ["cm", "in", "m"],
        default: "cm",
      },
    },
    tags: [String],
    features: [String],
    specifications: {
      type: Map,
      of: String,
    },
    seoTitle: String,
    seoDescription: String,
    slug: {
      type: String,
      unique: true,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "draft", "archived"],
      default: "active",
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isDigital: {
      type: Boolean,
      default: false,
    },
    downloadableFiles: [
      {
        name: String,
        url: String,
        size: Number,
      },
    ],
    shippingRequired: {
      type: Boolean,
      default: true,
    },
    taxable: {
      type: Boolean,
      default: true,
    },
    taxClass: String,
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    ratings: {
      average: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },
      count: {
        type: Number,
        default: 0,
      },
    },
    reviews: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Review",
      },
    ],
    soldCount: {
      type: Number,
      default: 0,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    relatedProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    metaData: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Indexes for better performance
productSchema.index({ name: "text", description: "text", tags: "text" })
productSchema.index({ category: 1, status: 1 })
productSchema.index({ price: 1 })
productSchema.index({ "ratings.average": -1 })
productSchema.index({ soldCount: -1 })
productSchema.index({ createdAt: -1 })
productSchema.index({ slug: 1 })

// Virtual for discount percentage
productSchema.virtual("discountPercentage").get(function () {
  if (this.comparePrice && this.comparePrice > this.price) {
    return Math.round(((this.comparePrice - this.price) / this.comparePrice) * 100)
  }
  return 0
})

// Virtual for profit margin
productSchema.virtual("profitMargin").get(function () {
  if (this.costPrice && this.price > this.costPrice) {
    return Math.round(((this.price - this.costPrice) / this.price) * 100)
  }
  return 0
})

// Virtual for stock status
productSchema.virtual("stockStatus").get(function () {
  if (this.stock === 0) return "out_of_stock"
  if (this.stock <= this.lowStockThreshold) return "low_stock"
  return "in_stock"
})

// Pre-save middleware to generate slug
productSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
  }
  next()
})

module.exports = mongoose.model("Product", productSchema)
