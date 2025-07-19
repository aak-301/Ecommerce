// src/middleware/product-validation.ts
import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { sendResponse } from "../utils/response";

// Product validation schemas
const createProductSchema = Joi.object({
  name: Joi.string().min(1).max(255).required().messages({
    "string.min": "Product name is required",
    "string.max": "Product name cannot exceed 255 characters",
    "any.required": "Product name is required",
  }),
  description: Joi.string().max(5000).optional().messages({
    "string.max": "Description cannot exceed 5000 characters",
  }),
  short_description: Joi.string().max(500).optional().messages({
    "string.max": "Short description cannot exceed 500 characters",
  }),
  sku: Joi.string().max(100).optional().messages({
    "string.max": "SKU cannot exceed 100 characters",
  }),
  slug: Joi.string().max(255).optional().messages({
    "string.max": "Slug cannot exceed 255 characters",
  }),
  category_id: Joi.string().uuid().optional().messages({
    "string.uuid": "Invalid category ID format",
  }),
  price: Joi.number().min(0).precision(2).required().messages({
    "number.min": "Price cannot be negative",
    "any.required": "Price is required",
  }),
  sale_price: Joi.number().min(0).precision(2).optional().messages({
    "number.min": "Sale price cannot be negative",
  }),
  cost_price: Joi.number().min(0).precision(2).optional().messages({
    "number.min": "Cost price cannot be negative",
  }),
  quantity: Joi.number().integer().min(0).default(0).messages({
    "number.min": "Quantity cannot be negative",
  }),
  min_quantity: Joi.number().integer().min(0).default(0).messages({
    "number.min": "Minimum quantity cannot be negative",
  }),
  max_quantity: Joi.number().integer().min(0).optional().messages({
    "number.min": "Maximum quantity cannot be negative",
  }),
  track_quantity: Joi.boolean().default(true),
  allow_backorder: Joi.boolean().default(false),
  status: Joi.string()
    .valid("draft", "active", "inactive", "out_of_stock")
    .default("draft")
    .messages({
      "any.only":
        "Status must be one of: draft, active, inactive, out_of_stock",
    }),
  is_featured: Joi.boolean().default(false),
  is_digital: Joi.boolean().default(false),
  meta_title: Joi.string().max(255).optional().messages({
    "string.max": "Meta title cannot exceed 255 characters",
  }),
  meta_description: Joi.string().max(1000).optional().messages({
    "string.max": "Meta description cannot exceed 1000 characters",
  }),
  tags: Joi.array().items(Joi.string().max(50)).optional().messages({
    "string.max": "Each tag cannot exceed 50 characters",
  }),
  featured_image: Joi.string().uri().optional().messages({
    "string.uri": "Featured image must be a valid URL",
  }),
  gallery_images: Joi.array().items(Joi.string().uri()).optional().messages({
    "string.uri": "Gallery images must be valid URLs",
  }),
  weight: Joi.number().min(0).precision(2).optional().messages({
    "number.min": "Weight cannot be negative",
  }),
  length: Joi.number().min(0).precision(2).optional().messages({
    "number.min": "Length cannot be negative",
  }),
  width: Joi.number().min(0).precision(2).optional().messages({
    "number.min": "Width cannot be negative",
  }),
  height: Joi.number().min(0).precision(2).optional().messages({
    "number.min": "Height cannot be negative",
  }),
  shipping_class: Joi.string().max(100).optional().messages({
    "string.max": "Shipping class cannot exceed 100 characters",
  }),
  attributes: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().max(100).required(),
        value: Joi.string().max(255).required(),
      })
    )
    .optional(),
  variants: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().max(255).required(),
        sku: Joi.string().max(100).optional(),
        price: Joi.number().min(0).precision(2).optional(),
        sale_price: Joi.number().min(0).precision(2).optional(),
        quantity: Joi.number().integer().min(0).default(0),
        attributes: Joi.object().optional(),
        image: Joi.string().uri().optional(),
        is_active: Joi.boolean().default(true),
      })
    )
    .optional(),
});

const updateProductSchema = createProductSchema.fork(
  ["name", "price"],
  (schema) => schema.optional()
);

const productQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    "number.min": "Page must be at least 1",
  }),
  limit: Joi.number().integer().min(1).max(100).default(50).messages({
    "number.min": "Limit must be at least 1",
    "number.max": "Limit cannot exceed 100",
  }),
  search: Joi.string().min(2).max(100).optional().messages({
    "string.min": "Search term must be at least 2 characters",
    "string.max": "Search term cannot exceed 100 characters",
  }),
  category_id: Joi.string().uuid().optional().messages({
    "string.uuid": "Invalid category ID format",
  }),
  status: Joi.string()
    .valid("draft", "active", "inactive", "out_of_stock")
    .optional()
    .messages({
      "any.only":
        "Status must be one of: draft, active, inactive, out_of_stock",
    }),
  is_featured: Joi.boolean().optional(),
  min_price: Joi.number().min(0).precision(2).optional().messages({
    "number.min": "Minimum price cannot be negative",
  }),
  max_price: Joi.number().min(0).precision(2).optional().messages({
    "number.min": "Maximum price cannot be negative",
  }),
  in_stock: Joi.boolean().optional(),
  low_stock: Joi.boolean().optional(),
  sort_by: Joi.string()
    .valid("name", "price", "quantity", "created_at", "updated_at")
    .default("created_at")
    .messages({
      "any.only":
        "Sort by must be one of: name, price, quantity, created_at, updated_at",
    }),
  sort_order: Joi.string().valid("asc", "desc").default("desc").messages({
    "any.only": "Sort order must be either asc or desc",
  }),
});

// Inventory validation schemas
const inventoryUpdateSchema = Joi.object({
  product_id: Joi.string().uuid().optional().messages({
    "string.uuid": "Invalid product ID format",
  }),
  variant_id: Joi.string().uuid().optional().messages({
    "string.uuid": "Invalid variant ID format",
  }),
  quantity_change: Joi.number().integer().required().messages({
    "any.required": "Quantity change is required",
  }),
  change_type: Joi.string()
    .valid("stock_in", "stock_out", "adjustment", "sale", "return", "damaged")
    .required()
    .messages({
      "any.only":
        "Change type must be one of: stock_in, stock_out, adjustment, sale, return, damaged",
      "any.required": "Change type is required",
    }),
  reason: Joi.string().max(500).optional().messages({
    "string.max": "Reason cannot exceed 500 characters",
  }),
  reference_id: Joi.string().uuid().optional().messages({
    "string.uuid": "Invalid reference ID format",
  }),
}).or("product_id", "variant_id");

const bulkInventoryUpdateSchema = Joi.object({
  updates: Joi.array()
    .items(inventoryUpdateSchema)
    .min(1)
    .max(100)
    .required()
    .messages({
      "array.min": "At least one update is required",
      "array.max": "Cannot update more than 100 items at once",
      "any.required": "Updates array is required",
    }),
});

// Category validation schemas
const createCategorySchema = Joi.object({
  name: Joi.string().min(1).max(255).required().messages({
    "string.min": "Category name is required",
    "string.max": "Category name cannot exceed 255 characters",
    "any.required": "Category name is required",
  }),
  description: Joi.string().max(1000).optional().messages({
    "string.max": "Description cannot exceed 1000 characters",
  }),
  slug: Joi.string().max(255).optional().messages({
    "string.max": "Slug cannot exceed 255 characters",
  }),
  parent_id: Joi.string().uuid().optional().messages({
    "string.uuid": "Invalid parent category ID format",
  }),
  is_active: Joi.boolean().default(true),
});

const updateCategorySchema = createCategorySchema.fork(["name"], (schema) =>
  schema.optional()
);

// Bulk operations schemas
const bulkCreateProductsSchema = Joi.object({
  products: Joi.array()
    .items(createProductSchema)
    .min(1)
    .max(100)
    .required()
    .messages({
      "array.min": "At least one product is required",
      "array.max": "Cannot create more than 100 products at once",
      "any.required": "Products array is required",
    }),
  skip_errors: Joi.boolean().default(false),
});

// ID parameter schema
const idParamSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.uuid": "Invalid ID format",
    "any.required": "ID is required",
  }),
});

// Assign product schema
const assignProductSchema = Joi.object({
  target_user_id: Joi.string().uuid().required().messages({
    "string.uuid": "Invalid target user ID format",
    "any.required": "Target user ID is required",
  }),
});

// =============================================
// VALIDATION MIDDLEWARE FUNCTIONS
// =============================================

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

export const validateProductQuery = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error, value } = productQuerySchema.validate(req.query);
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

export const validateInventoryUpdate = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error, value } = inventoryUpdateSchema.validate(req.body);
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

export const validateBulkInventoryUpdate = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error, value } = bulkInventoryUpdateSchema.validate(req.body);
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

export const validateBulkCreateProducts = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error, value } = bulkCreateProductsSchema.validate(req.body);
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

export const validateIdParam = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error } = idParamSchema.validate(req.params);
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

export const validateAssignProduct = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error, value } = assignProductSchema.validate(req.body);
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

// File upload validation
export const validateFileUpload = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.file) {
    return sendResponse(res, 400, false, "File is required");
  }

  // Check file type
  const allowedMimeTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-excel", // .xls
  ];

  if (!allowedMimeTypes.includes(req.file.mimetype)) {
    return sendResponse(
      res,
      400,
      false,
      "Only Excel files (.xlsx, .xls) are allowed"
    );
  }

  // Check file size (10MB limit)
  if (req.file.size > 10 * 1024 * 1024) {
    return sendResponse(res, 400, false, "File size cannot exceed 10MB");
  }

  next();
};
