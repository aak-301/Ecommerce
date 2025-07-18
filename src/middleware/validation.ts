import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { sendResponse } from "../utils/response";

const requestMagicLinkSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),
  name: Joi.string().min(2).max(100).optional().messages({
    "string.min": "Name must be at least 2 characters long",
    "string.max": "Name cannot exceed 100 characters",
  }),
  role: Joi.string()
    .valid("super_admin", "admin", "customer")
    .default("customer")
    .messages({
      "any.only": "Role must be one of: super_admin, admin, customer",
    }),
});

const verifyMagicLinkSchema = Joi.object({
  token: Joi.string().uuid().required().messages({
    "string.uuid": "Invalid token format",
    "any.required": "Token is required",
  }),
});

export const validateRequestMagicLink = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error } = requestMagicLinkSchema.validate(req.body);
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

export const validateVerifyMagicLink = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error } = verifyMagicLinkSchema.validate(req.body);
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
