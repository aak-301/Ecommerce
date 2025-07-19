// src/middleware/customer-validation.ts
import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { sendResponse } from "../utils/response";

// Address validation schemas
const createAddressSchema = Joi.object({
  type: Joi.string().valid("shipping", "billing").required().messages({
    "any.only": "Address type must be either shipping or billing",
    "any.required": "Address type is required",
  }),
  is_default: Joi.boolean().default(false),
  first_name: Joi.string().min(1).max(100).required().messages({
    "string.min": "First name is required",
    "string.max": "First name cannot exceed 100 characters",
    "any.required": "First name is required",
  }),
  last_name: Joi.string().min(1).max(100).required().messages({
    "string.min": "Last name is required",
    "string.max": "Last name cannot exceed 100 characters",
    "any.required": "Last name is required",
  }),
  company: Joi.string().max(255).optional().messages({
    "string.max": "Company name cannot exceed 255 characters",
  }),
  address_line_1: Joi.string().min(1).max(255).required().messages({
    "string.min": "Address line 1 is required",
    "string.max": "Address line 1 cannot exceed 255 characters",
    "any.required": "Address line 1 is required",
  }),
  address_line_2: Joi.string().max(255).optional().messages({
    "string.max": "Address line 2 cannot exceed 255 characters",
  }),
  city: Joi.string().min(1).max(100).required().messages({
    "string.min": "City is required",
    "string.max": "City cannot exceed 100 characters",
    "any.required": "City is required",
  }),
  state: Joi.string().min(1).max(100).required().messages({
    "string.min": "State is required",
    "string.max": "State cannot exceed 100 characters",
    "any.required": "State is required",
  }),
  postal_code: Joi.string()
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      "string.pattern.base": "Postal code must be 6 digits",
      "any.required": "Postal code is required",
    }),
  country: Joi.string().max(100).default("India").messages({
    "string.max": "Country cannot exceed 100 characters",
  }),
  phone: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid Indian phone number format",
    }),
});

const updateAddressSchema = createAddressSchema.fork(
  [
    "type",
    "first_name",
    "last_name",
    "address_line_1",
    "city",
    "state",
    "postal_code",
  ],
  (schema) => schema.optional()
);

// Cart validation schemas
const addToCartSchema = Joi.object({
  product_id: Joi.string().uuid().required().messages({
    "string.uuid": "Invalid product ID format",
    "any.required": "Product ID is required",
  }),
  variant_id: Joi.string().uuid().optional().messages({
    "string.uuid": "Invalid variant ID format",
  }),
  quantity: Joi.number().integer().min(1).max(100).default(1).messages({
    "number.min": "Quantity must be at least 1",
    "number.max": "Cannot add more than 100 items at once",
  }),
});

const updateCartItemSchema = Joi.object({
  quantity: Joi.number().integer().min(1).max(100).required().messages({
    "number.min": "Quantity must be at least 1",
    "number.max": "Cannot have more than 100 items",
    "any.required": "Quantity is required",
  }),
});

// Order validation schemas
const placeOrderSchema = Joi.object({
  shipping_address_id: Joi.string().uuid().required().messages({
    "string.uuid": "Invalid shipping address ID format",
    "any.required": "Shipping address ID is required",
  }),
  billing_address_id: Joi.string().uuid().required().messages({
    "string.uuid": "Invalid billing address ID format",
    "any.required": "Billing address ID is required",
  }),
  customer_notes: Joi.string().max(1000).optional().messages({
    "string.max": "Customer notes cannot exceed 1000 characters",
  }),
  payment_method: Joi.string()
    .valid("credit_card", "debit_card", "upi", "net_banking", "cod")
    .required()
    .messages({
      "any.only": "Invalid payment method",
      "any.required": "Payment method is required",
    }),
});

const cancelOrderSchema = Joi.object({
  reason: Joi.string().max(500).optional().messages({
    "string.max": "Cancellation reason cannot exceed 500 characters",
  }),
});

// Review validation schemas
const createReviewSchema = Joi.object({
  product_id: Joi.string().uuid().required().messages({
    "string.uuid": "Invalid product ID format",
    "any.required": "Product ID is required",
  }),
  order_id: Joi.string().uuid().optional().messages({
    "string.uuid": "Invalid order ID format",
  }),
  rating: Joi.number().integer().min(1).max(5).required().messages({
    "number.min": "Rating must be at least 1",
    "number.max": "Rating cannot exceed 5",
    "any.required": "Rating is required",
  }),
  title: Joi.string().max(255).optional().messages({
    "string.max": "Review title cannot exceed 255 characters",
  }),
  review_text: Joi.string().max(2000).optional().messages({
    "string.max": "Review text cannot exceed 2000 characters",
  }),
});

const updateReviewSchema = createReviewSchema.fork(
  ["product_id", "rating"],
  (schema) => schema.optional()
);

// Query parameter schemas
const customerProductQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    "number.min": "Page must be at least 1",
  }),
  limit: Joi.number().integer().min(1).max(100).default(20).messages({
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
  min_price: Joi.number().min(0).precision(2).optional().messages({
    "number.min": "Minimum price cannot be negative",
  }),
  max_price: Joi.number().min(0).precision(2).optional().messages({
    "number.min": "Maximum price cannot be negative",
  }),
  in_stock: Joi.boolean().optional(),
  featured: Joi.boolean().optional(),
  sort_by: Joi.string()
    .valid("name", "price", "created_at", "rating")
    .default("created_at")
    .messages({
      "any.only": "Sort by must be one of: name, price, created_at, rating",
    }),
  sort_order: Joi.string().valid("asc", "desc").default("desc").messages({
    "any.only": "Sort order must be either asc or desc",
  }),
  tags: Joi.string().optional(), // Will be split into array
});

const idParamSchema = Joi.object({
  id: Joi.string().uuid().optional().messages({
    "string.uuid": "Invalid ID format",
  }),
  productId: Joi.string().uuid().optional().messages({
    "string.uuid": "Invalid product ID format",
  }),
  orderId: Joi.string().uuid().optional().messages({
    "string.uuid": "Invalid order ID format",
  }),
  reviewId: Joi.string().uuid().optional().messages({
    "string.uuid": "Invalid review ID format",
  }),
}).or("id", "productId", "orderId", "reviewId");

const customerOrderQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    "number.min": "Page must be at least 1",
  }),
  limit: Joi.number().integer().min(1).max(100).default(20).messages({
    "number.min": "Limit must be at least 1",
    "number.max": "Limit cannot exceed 100",
  }),
  status: Joi.string()
    .valid(
      "pending",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
      "refunded"
    )
    .optional()
    .messages({
      "any.only": "Invalid order status",
    }),
  payment_status: Joi.string()
    .valid("pending", "paid", "failed", "refunded", "partial_refund")
    .optional()
    .messages({
      "any.only": "Invalid payment status",
    }),
  start_date: Joi.date().iso().optional().messages({
    "date.format": "Start date must be in ISO format",
  }),
  end_date: Joi.date().iso().min(Joi.ref("start_date")).optional().messages({
    "date.format": "End date must be in ISO format",
    "date.min": "End date cannot be before start date",
  }),
  sort_by: Joi.string()
    .valid("created_at", "total_amount", "status")
    .default("created_at")
    .messages({
      "any.only": "Sort by must be one of: created_at, total_amount, status",
    }),
  sort_order: Joi.string().valid("asc", "desc").default("desc").messages({
    "any.only": "Sort order must be either asc or desc",
  }),
});

const searchQuerySchema = Joi.object({
  q: Joi.string().min(2).max(100).required().messages({
    "string.min": "Search query must be at least 2 characters",
    "string.max": "Search query cannot exceed 100 characters",
    "any.required": "Search query is required",
  }),
  page: Joi.number().integer().min(1).default(1).messages({
    "number.min": "Page must be at least 1",
  }),
  limit: Joi.number().integer().min(1).max(100).default(20).messages({
    "number.min": "Limit must be at least 1",
    "number.max": "Limit cannot exceed 100",
  }),
  category_id: Joi.string().uuid().optional().messages({
    "string.uuid": "Invalid category ID format",
  }),
  min_price: Joi.number().min(0).precision(2).optional().messages({
    "number.min": "Minimum price cannot be negative",
  }),
  max_price: Joi.number().min(0).precision(2).optional().messages({
    "number.min": "Maximum price cannot be negative",
  }),
  in_stock: Joi.boolean().optional(),
  sort_by: Joi.string()
    .valid("name", "price", "created_at", "rating")
    .default("created_at")
    .messages({
      "any.only": "Sort by must be one of: name, price, created_at, rating",
    }),
  sort_order: Joi.string().valid("asc", "desc").default("desc").messages({
    "any.only": "Sort order must be either asc or desc",
  }),
  tags: Joi.string().optional(), // Will be split into array
});
// =============================================
// VALIDATION MIDDLEWARE FUNCTIONS
// =============================================

export const validateCreateAddress = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error, value } = createAddressSchema.validate(req.body);
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

export const validateUpdateAddress = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error, value } = updateAddressSchema.validate(req.body);
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

export const validatePlaceOrder = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error, value } = placeOrderSchema.validate(req.body);
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

export const validateCancelOrder = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error, value } = cancelOrderSchema.validate(req.body);
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

export const validateCreateReview = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error, value } = createReviewSchema.validate(req.body);
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

export const validateUpdateReview = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error, value } = updateReviewSchema.validate(req.body);
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

export const validateCustomerProductQuery = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error, value } = customerProductQuerySchema.validate(req.query);
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

export const validateCustomerOrderQuery = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error, value } = customerOrderQuerySchema.validate(req.query);
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

export const validateSearchQuery = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error, value } = searchQuerySchema.validate(req.query);
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
