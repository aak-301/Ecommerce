// src/middleware/auth.ts - Updated to include token blacklist checking
import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import { sendResponse } from "../utils/response";
import { UserModel } from "../models/User";
import { AccountModel } from "../models/AccountModel";
import { User, UserRole } from "../types";

interface AuthRequest extends Request {
  user?: User;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return sendResponse(res, 401, false, "Access denied. No token provided.");
    }

    // Check if token is blacklisted (logged out)
    const isBlacklisted = await AccountModel.isTokenBlacklisted(token);
    if (isBlacklisted) {
      return sendResponse(
        res,
        401,
        false,
        "Token has been invalidated. Please log in again."
      );
    }

    const decoded = verifyToken(token);
    const user = await UserModel.findById(decoded.id);

    if (!user) {
      return sendResponse(res, 401, false, "Invalid token. User not found.");
    }

    // Check if user account is soft deleted
    if (user.deleted_at) {
      return sendResponse(res, 403, false, "Account has been deleted.");
    }

    if (user.status === "suspended") {
      return sendResponse(res, 403, false, "Account is suspended.");
    }

    if (user.status === "rejected") {
      return sendResponse(res, 403, false, "Account has been rejected.");
    }

    // Update user's last activity
    try {
      await AccountModel.updateLastActivity(user.id);
    } catch (error) {
      // Don't fail authentication if activity update fails
      console.error("Failed to update last activity:", error);
    }

    req.user = user;
    next();
  } catch (error) {
    return sendResponse(res, 401, false, "Invalid token.");
  }
};

export const authorize = (roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendResponse(
        res,
        401,
        false,
        "Access denied. User not authenticated."
      );
    }

    if (!roles.includes(req.user.role)) {
      return sendResponse(
        res,
        403,
        false,
        "Access denied. Insufficient permissions."
      );
    }

    next();
  };
};
