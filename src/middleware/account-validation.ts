// src/middleware/account-validation.ts
import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { sendResponse } from "../utils/response";

const logoutSchema = Joi.object({
  reason: Joi.string().valid("manual", "security").default("manual").messages({
    "any.only": "Reason must be either manual or security",
  }),
  allDevices: Joi.boolean().default(false),
});

const deleteAccountSchema = Joi.object({
  reason: Joi.string().max(500).optional().messages({
    "string.max": "Reason cannot exceed 500 characters",
  }),
  feedback: Joi.string().max(1000).optional().messages({
    "string.max": "Feedback cannot exceed 1000 characters",
  }),
  password: Joi.string().optional(), // For future password confirmation
});

const adminDeleteAccountSchema = Joi.object({
  userId: Joi.string().uuid().required().messages({
    "string.uuid": "Invalid user ID format",
    "any.required": "User ID is required",
  }),
  reason: Joi.string()
    .valid("admin_action", "policy_violation", "inactive")
    .required()
    .messages({
      "any.only":
        "Reason must be one of: admin_action, policy_violation, inactive",
      "any.required": "Reason is required",
    }),
  notes: Joi.string().max(1000).optional().messages({
    "string.max": "Notes cannot exceed 1000 characters",
  }),
});

const forceLogoutSchema = Joi.object({
  userId: Joi.string().uuid().required().messages({
    "string.uuid": "Invalid user ID format",
    "any.required": "User ID is required",
  }),
  reason: Joi.string().max(200).default("admin_forced").messages({
    "string.max": "Reason cannot exceed 200 characters",
  }),
});

const restoreAccountSchema = Joi.object({
  userId: Joi.string().uuid().required().messages({
    "string.uuid": "Invalid user ID format",
    "any.required": "User ID is required",
  }),
});

const getDeletedAccountsQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(50).messages({
    "number.min": "Limit must be at least 1",
    "number.max": "Limit cannot exceed 100",
  }),
  offset: Joi.number().integer().min(0).default(0).messages({
    "number.min": "Offset must be at least 0",
  }),
  deletedBy: Joi.string().uuid().optional().messages({
    "string.uuid": "Invalid deletedBy user ID format",
  }),
});

const userIdParamSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.uuid": "Invalid user ID format",
    "any.required": "User ID is required",
  }),
});

const logoutHistoryQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(50).messages({
    "number.min": "Limit must be at least 1",
    "number.max": "Limit cannot exceed 100",
  }),
  offset: Joi.number().integer().min(0).default(0).messages({
    "number.min": "Offset must be at least 0",
  }),
});

export const validateLogout = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error, value } = logoutSchema.validate(req.body);
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

export const validateDeleteAccount = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error, value } = deleteAccountSchema.validate(req.body);
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

export const validateAdminDeleteAccount = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error } = adminDeleteAccountSchema.validate(req.body);
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

export const validateForceLogout = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error, value } = forceLogoutSchema.validate(req.body);
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

export const validateRestoreAccount = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error } = restoreAccountSchema.validate(req.body);
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

export const validateGetDeletedAccountsQuery = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error, value } = getDeletedAccountsQuerySchema.validate(req.query);
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

export const validateUserIdParam = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error } = userIdParamSchema.validate(req.params);
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

export const validateLogoutHistoryQuery = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error, value } = logoutHistoryQuerySchema.validate(req.query);
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
