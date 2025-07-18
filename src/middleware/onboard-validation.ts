// src/middleware/onboard-validation.ts
import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { sendResponse } from "../utils/response";

const processOnboardingSchema = Joi.object({
  userId: Joi.string().uuid().required().messages({
    "string.uuid": "Invalid user ID format",
    "any.required": "User ID is required",
  }),
  action: Joi.string()
    .valid("approve", "reject", "suspend")
    .required()
    .messages({
      "any.only": "Action must be one of: approve, reject, suspend",
      "any.required": "Action is required",
    }),
  reason: Joi.when("action", {
    is: Joi.string().valid("reject", "suspend"),
    then: Joi.string().min(10).max(500).required().messages({
      "string.min": "Reason must be at least 10 characters long",
      "string.max": "Reason cannot exceed 500 characters",
      "any.required": "Reason is required for reject or suspend actions",
    }),
    otherwise: Joi.string().max(500).optional().messages({
      "string.max": "Reason cannot exceed 500 characters",
    }),
  }),
  notes: Joi.string().max(1000).optional().messages({
    "string.max": "Notes cannot exceed 1000 characters",
  }),
});

const reactivateAdminSchema = Joi.object({
  userId: Joi.string().uuid().required().messages({
    "string.uuid": "Invalid user ID format",
    "any.required": "User ID is required",
  }),
  notes: Joi.string().max(1000).optional().messages({
    "string.max": "Notes cannot exceed 1000 characters",
  }),
});

const getAdminsQuerySchema = Joi.object({
  status: Joi.string()
    .valid("pending", "active", "suspended", "rejected")
    .optional()
    .messages({
      "any.only": "Status must be one of: pending, active, suspended, rejected",
    }),
  search: Joi.string().min(2).max(100).optional().messages({
    "string.min": "Search term must be at least 2 characters long",
    "string.max": "Search term cannot exceed 100 characters",
  }),
  limit: Joi.number().integer().min(1).max(100).default(50).messages({
    "number.min": "Limit must be at least 1",
    "number.max": "Limit cannot exceed 100",
  }),
  offset: Joi.number().integer().min(0).default(0).messages({
    "number.min": "Offset must be at least 0",
  }),
});

const adminIdParamSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.uuid": "Invalid admin ID format",
    "any.required": "Admin ID is required",
  }),
});

export const validateProcessOnboarding = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error } = processOnboardingSchema.validate(req.body);
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

export const validateReactivateAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error } = reactivateAdminSchema.validate(req.body);
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

export const validateGetAdminsQuery = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error, value } = getAdminsQuerySchema.validate(req.query);
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

export const validateAdminIdParam = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error } = adminIdParamSchema.validate(req.params);
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
