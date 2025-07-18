// src/middleware/product-validation.ts
import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { sendResponse } from "../utils/response";

// Product validation schemas
const createProductSchema = Joi.object({
  name: Joi.string().min(2).max(255).required().messages({
    "string.min": "Product name must be at least 2 characters long",
    "string.max": "Product name cannot exceed 255 characters",
    "any.required": "Quantity is required"
  })
});

const updateCartItemSchema = Joi.object({
  quantity: Joi.number().integer().min(0).max(1000).required().messages({
    "number.min": "Quantity cannot be negative",
    "number.max": "Quantity cannot exceed 1000",
    "number.integer": "Quantity must be a whole number",
    "any.required": "Quantity is required"
  })
});

// Order validation schemas
const createOrderSchema = Joi.object({
  shipping_address: Joi.object({
    street: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    postal_code: Joi.string().required(),
    country: Joi.string().required(),
    phone: Joi.string().optional()
  }).optional(),
  billing_address: Joi.object({
    street: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    postal_code: Joi.string().required(),
    country: Joi.string().required(),
    phone: Joi.string().optional()
  }).optional(),
  shipping_method: Joi.string().max(100).optional().messages({
    "string.max": "Shipping method cannot exceed 100 characters"
  }),
  notes: Joi.string().max(1000).optional().messages({
    "string.max": "Notes cannot exceed 1000 characters"
  })
});

const updateOrderSchema = Joi.object({
  status: Joi.string().valid(
    'pending', 'confirmed', 'processing', 'shipped', 
    'delivered', 'cancelled', 'refunded', 'partially_refunded'
  ).optional().messages({
    "any.only": "Invalid order status"
  }),
  payment_status: Joi.string().valid(
    'pending', 'paid', 'failed', 'refunded', 'partially_refunded'
  ).optional().messages({
    "any.only": "Invalid payment status"
  }),
  shipping_method: Joi.string().max(100).optional().messages({
    "string.max": "Shipping method cannot exceed 100 characters"
  }),
  tracking_number: Joi.string().max(100).optional().messages({
    "string.max": "Tracking number cannot exceed 100 characters"
  }),
  internal_notes: Joi.string().max(1000).optional().messages({
    "string.max": "Internal notes cannot exceed 1000 characters"
  }),
  shipped_at: Joi.date().optional(),
  delivered_at: Joi.date().optional()
});

// Parameter validation schemas
const uuidParamSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.uuid": "Invalid ID format",
    "any.required": "ID is required"
  })
});

const slugParamSchema = Joi.object({
  slug: Joi.string().min(1).max(255).required().messages({
    "string.min": "Slug cannot be empty",
    "string.max": "Slug cannot exceed 255 characters",
    "any.required": "Slug is required"
  })
});

// Validation middleware functions
export const validateCreateProduct = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error, value } = createProductSchema.validate(req.body);
  if (error) {
    return sendResponse(
      res,
      400,
      false,
      "Validation error",
      null,
      error.details[0].message
    );
  }
  req.body = value;
  next();
};

export const validateUpdateProduct = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error, value } = updateProductSchema.validate(req.body);
  if (error) {
    return sendResponse(
      res,
      400,
      false,
      "Validation error",
      null,
      error.details[0].message
    );
  }
  req.body = value;
  next();
};

export const validateProductSearch = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error, value } = productSearchSchema.validate(req.query);
  if (error) {
    return sendResponse(
      res,
      400,
      false,
      "Validation error",
      null,
      error.details[0].message
    );
  }
  req.query = value;
  next();
};

export const validateCreateCategory = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error, value } = createCategorySchema.validate(req.body);
  if (error) {
    return sendResponse(
      res,
      400,
      false,
      "Validation error",
      null,
      error.details[0].message
    );
  }
  req.body = value;
  next();
};

export const validateUpdateCategory = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error, value } = updateCategorySchema.validate(req.body);
  if (error) {
    return sendResponse(
      res,
      400,
      false,
      "Validation error",
      null,
      error.details[0].message
    );
  }
  req.body = value;
  next();
};

export const validateAddToCart = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error, value } = addToCartSchema.validate(req.body);
  if (error) {
    return sendResponse(
      res,
      400,
      false,
      "Validation error",
      null,
      error.details[0].message
    );
  }
  req.body = value;
  next();
};

export const validateUpdateCartItem = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error, value } = updateCartItemSchema.validate(req.body);
  if (error) {
    return sendResponse(
      res,
      400,
      false,
      "Validation error",
      null,
      error.details[0].message
    );
  }
  req.body = value;
  next();
};

export const validateCreateOrder = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error, value } = createOrderSchema.validate(req.body);
  if (error) {
    return sendResponse(
      res,
      400,
      false,
      "Validation error",
      null,
      error.details[0].message
    );
  }
  req.body = value;
  next();
};

export const validateUpdateOrder = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error, value } = updateOrderSchema.validate(req.body);
  if (error) {
    return sendResponse(
      res,
      400,
      false,
      "Validation error",
      null,
      error.details[0].message
    );
  }
  req.body = value;
  next();
};

export const validateUuidParam = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error } = uuidParamSchema.validate(req.params);
  if (error) {
    return sendResponse(
      res,
      400,
      false,
      "Validation error",
      null,
      error.details[0].message
    );
  }
  next();
};

export const validateSlugParam = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error } = slugParamSchema.validate(req.params);
  if (error) {
    return sendResponse(
      res,
      400,
      false,
      "Validation error",
      null,
      error.details[0].message
    );
  }
  next();
};

// Custom validation for price relationships
export const validatePriceRelationship = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { price, sale_price } = req.body;
  
  if (price && sale_price && sale_price >= price) {
    return sendResponse(
      res,
      400,
      false,
      "Sale price must be less than regular price"
    );
  }
  
  next();
};

// Custom validation for category hierarchy (prevent circular references)
export const validateCategoryHierarchy = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { parent_id } = req.body;
  const { id } = req.params;
  
  if (parent_id && id && parent_id === id) {
    return sendResponse(
      res,
      400,
      false,
      "Category cannot be its own parent"
    );
  }
  
  next();
};

// Validate bulk operations
export const validateBulkQuantityUpdate = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { updates } = req.body;
  
  if (!Array.isArray(updates)) {
    return sendResponse(
      res,
      400,
      false,
      "Updates must be an array"
    );
  }
  
  if (updates.length === 0) {
    return sendResponse(
      res,
      400,
      false,
      "Updates array cannot be empty"
    );
  }
  
  if (updates.length > 100) {
    return sendResponse(
      res,
      400,
      false,
      "Cannot update more than 100 products at once"
    );
  }
  
  const schema = Joi.array().items(
    Joi.object({
      id: Joi.string().uuid().required(),
      quantity: Joi.number().integer().min(0).required()
    })
  ).required();
  
  const { error, value } = schema.validate(updates);
  if (error) {
    return sendResponse(
      res,
      400,
      false,
      "Validation error",
      null,
      error.details[0].message
    );
  }
  
  req.body.updates = value;
  next();
};

export const validateBulkCategorySortOrder = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { updates } = req.body;
  
  if (!Array.isArray(updates)) {
    return sendResponse(
      res,
      400,
      false,
      "Updates must be an array"
    );
  }
  
  if (updates.length === 0) {
    return sendResponse(
      res,
      400,
      false,
      "Updates array cannot be empty"
    );
  }
  
  const schema = Joi.array().items(
    Joi.object({
      id: Joi.string().uuid().required(),
      sort_order: Joi.number().integer().min(0).required()
    })
  ).required();
  
  const { error, value } = schema.validate(updates);
  if (error) {
    return sendResponse(
      res,
      400,
      false,
      "Validation error",
      null,
      error.details[0].message
    );
  }
  
  req.body.updates = value;
  next();
};Product name is required"
  }),
  description: Joi.string().max(5000).optional().messages({
    "string.max": "Description cannot exceed 5000 characters"
  }),
  short_description: Joi.string().max(500).optional().messages({
    "string.max": "Short description cannot exceed 500 characters"
  }),
  category_id: Joi.string().uuid().required().messages({
    "string.uuid": "Invalid category ID format",
    "any.required": "Category ID is required"
  }),
  price: Joi.number().positive().precision(2).required().messages({
    "number.positive": "Price must be greater than 0",
    "any.required": "Price is required"
  }),
  sale_price: Joi.number().positive().precision(2).optional().messages({
    "number.positive": "Sale price must be greater than 0"
  }),
  cost_price: Joi.number().min(0).precision(2).optional().messages({
    "number.min": "Cost price cannot be negative"
  }),
  quantity: Joi.number().integer().min(0).default(0).messages({
    "number.min": "Quantity cannot be negative",
    "number.integer": "Quantity must be a whole number"
  }),
  low_stock_threshold: Joi.number().integer().min(0).default(10).messages({
    "number.min": "Low stock threshold cannot be negative",
    "number.integer": "Low stock threshold must be a whole number"
  }),
  track_quantity: Joi.boolean().default(true),
  allow_backorders: Joi.boolean().default(false),
  weight: Joi.number().min(0).precision(3).optional().messages({
    "number.min": "Weight cannot be negative"
  }),
  dimensions_length: Joi.number().min(0).precision(2).optional().messages({
    "number.min": "Length cannot be negative"
  }),
  dimensions_width: Joi.number().min(0).precision(2).optional().messages({
    "number.min": "Width cannot be negative"
  }),
  dimensions_height: Joi.number().min(0).precision(2).optional().messages({
    "number.min": "Height cannot be negative"
  }),
  status: Joi.string().valid('draft', 'published', 'archived').default('draft').messages({
    "any.only": "Status must be one of: draft, published, archived"
  }),
  visibility: Joi.string().valid('public', 'private', 'hidden').default('public').messages({
    "any.only": "Visibility must be one of: public, private, hidden"
  }),
  featured: Joi.boolean().default(false),
  meta_title: Joi.string().max(255).optional().messages({
    "string.max": "Meta title cannot exceed 255 characters"
  }),
  meta_description: Joi.string().max(500).optional().messages({
    "string.max": "Meta description cannot exceed 500 characters"
  }),
  meta_keywords: Joi.string().max(500).optional().messages({
    "string.max": "Meta keywords cannot exceed 500 characters"
  }),
  tags: Joi.array().items(Joi.string().max(50)).max(20).optional().messages({
    "array.max": "Cannot have more than 20 tags",
    "string.max": "Each tag cannot exceed 50 characters"
  }),
  attributes: Joi.object().optional(),
  images: Joi.array().items(
    Joi.object({
      url: Joi.string().uri().required(),
      alt_text: Joi.string().max(255).optional(),
      is_primary: Joi.boolean().default(false)
    })
  ).max(10).optional().messages({
    "array.max": "Cannot have more than 10 images"
  }),
  variants: Joi.array().items(
    Joi.object({
      name: Joi.string().min(1).max(255).required(),
      price: Joi.number().positive().precision(2).optional(),
      sale_price: Joi.number().positive().precision(2).optional(),
      quantity: Joi.number().integer().min(0).required(),
      attributes: Joi.object().required(),
      image_url: Joi.string().uri().optional()
    })
  ).max(50).optional().messages({
    "array.max": "Cannot have more than 50 variants"
  })
});

const updateProductSchema = createProductSchema.fork(
  ['name', 'category_id', 'price'],
  (schema) => schema.optional()
);

const productSearchSchema = Joi.object({
  search: Joi.string().min(2).max(100).optional().messages({
    "string.min": "Search term must be at least 2 characters long",
    "string.max": "Search term cannot exceed 100 characters"
  }),
  category_id: Joi.string().uuid().optional().messages({
    "string.uuid": "Invalid category ID format"
  }),
  status: Joi.string().valid('draft', 'published', 'archived').optional().messages({
    "any.only": "Status must be one of: draft, published, archived"
  }),
  visibility: Joi.string().valid('public', 'private', 'hidden').optional().messages({
    "any.only": "Visibility must be one of: public, private, hidden"
  }),
  featured: Joi.boolean().optional(),
  min_price: Joi.number().min(0).precision(2).optional().messages({
    "number.min": "Minimum price cannot be negative"
  }),
  max_price: Joi.number().min(0).precision(2).optional().messages({
    "number.min": "Maximum price cannot be negative"
  }),
  in_stock: Joi.boolean().optional(),
  low_stock: Joi.boolean().optional(),
  tags: Joi.string().optional(), // Comma-separated tags
  sort_by: Joi.string().valid('name', 'price', 'created_at', 'updated_at', 'quantity').default('created_at').messages({
    "any.only": "Sort by must be one of: name, price, created_at, updated_at, quantity"
  }),
  sort_order: Joi.string().valid('asc', 'desc').default('desc').messages({
    "any.only": "Sort order must be either asc or desc"
  }),
  limit: Joi.number().integer().min(1).max(100).default(50).messages({
    "number.min": "Limit must be at least 1",
    "number.max": "Limit cannot exceed 100",
    "number.integer": "Limit must be a whole number"
  }),
  offset: Joi.number().integer().min(0).default(0).messages({
    "number.min": "Offset cannot be negative",
    "number.integer": "Offset must be a whole number"
  })
});

// Category validation schemas
const createCategorySchema = Joi.object({
  name: Joi.string().min(2).max(255).required().messages({
    "string.min": "Category name must be at least 2 characters long",
    "string.max": "Category name cannot exceed 255 characters",
    "any.required": "Category name is required"
  }),
  description: Joi.string().max(1000).optional().messages({
    "string.max": "Description cannot exceed 1000 characters"
  }),
  parent_id: Joi.string().uuid().optional().allow(null).messages({
    "string.uuid": "Invalid parent category ID format"
  }),
  image_url: Joi.string().uri().optional().messages({
    "string.uri": "Image URL must be a valid URL"
  }),
  sort_order: Joi.number().integer().min(0).default(0).messages({
    "number.min": "Sort order cannot be negative",
    "number.integer": "Sort order must be a whole number"
  })
});

const updateCategorySchema = createCategorySchema.fork(
  ['name'],
  (schema) => schema.optional()
);

// Cart validation schemas
const addToCartSchema = Joi.object({
  product_id: Joi.string().uuid().required().messages({
    "string.uuid": "Invalid product ID format",
    "any.required": "Product ID is required"
  }),
  variant_id: Joi.string().uuid().optional().allow(null).messages({
    "string.uuid": "Invalid variant ID format"
  }),
  quantity: Joi.number().integer().min(1).max(1000).required().messages({
    "number.min": "Quantity must be at least 1",
    "number.max": "Quantity cannot exceed 1000",
    "number.integer": "Quantity must be a whole number",
    "any.required": "