// src/controllers/AccountController.ts
import { Request, Response } from "express";
import { AccountService } from "../services/AccountService";
import { sendResponse } from "../utils/response";
import { User } from "../types";

interface AuthRequest extends Request {
  user?: User;
}

export class AccountController {
  // Enhanced logout with session tracking
  static async logout(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const token = req.header("Authorization")?.replace("Bearer ", "");
      if (!token) {
        sendResponse(res, 400, false, "Token not provided");
        return;
      }

      const { reason } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get("User-Agent");

      const result = await AccountService.logout(
        req.user,
        token,
        { reason },
        ipAddress,
        userAgent
      );

      sendResponse(res, 200, true, result.message, {
        sessionId: result.sessionId,
        loggedOutAt: new Date().toISOString(),
        message: "Please remove the token from your client storage",
      });
    } catch (error) {
      console.error("Logout error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to logout",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Delete user account (self-service)
  static async deleteAccount(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      // Prevent super admins from deleting their own accounts
      if (req.user.role === "super_admin") {
        sendResponse(
          res,
          403,
          false,
          "Super admin accounts cannot be self-deleted. Contact another super admin."
        );
        return;
      }

      const { reason, feedback } = req.body;

      const result = await AccountService.deleteAccount(req.user, {
        reason,
        feedback,
      });

      sendResponse(res, 200, true, result.message, {
        deletedAccountId: result.deletedAccountId,
        deletedAt: new Date().toISOString(),
        message:
          "Your account has been permanently deleted. Thank you for using our service.",
      });
    } catch (error) {
      console.error("Delete account error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to delete account",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Admin delete user account
  static async adminDeleteAccount(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { userId, reason, notes } = req.body;

      // Prevent deletion of the current user
      if (userId === req.user.id) {
        sendResponse(
          res,
          400,
          false,
          "Cannot delete your own account using admin deletion"
        );
        return;
      }

      const result = await AccountService.adminDeleteAccount(
        { userId, reason, notes },
        req.user
      );

      sendResponse(res, 200, true, result.message, {
        deletedAccountId: result.deletedAccountId,
        deletedAt: new Date().toISOString(),
        deletedBy: {
          id: req.user.id,
          name: req.user.name,
        },
      });
    } catch (error) {
      console.error("Admin delete account error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to delete account",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Force logout user (admin action)
  static async forceLogoutUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { userId, reason } = req.body;

      // Prevent force logout of self
      if (userId === req.user.id) {
        sendResponse(
          res,
          400,
          false,
          "Cannot force logout yourself. Use regular logout instead."
        );
        return;
      }

      const result = await AccountService.forceLogoutUser(
        userId,
        req.user,
        reason
      );

      sendResponse(res, 200, true, result.message, {
        loggedOutAt: new Date().toISOString(),
        performedBy: {
          id: req.user.id,
          name: req.user.name,
        },
      });
    } catch (error) {
      console.error("Force logout error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to force logout user",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Restore deleted account (admin only)
  static async restoreAccount(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { userId } = req.body;

      const result = await AccountService.restoreAccount(userId, req.user);

      sendResponse(res, 200, true, result.message, {
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
          status: result.user.status,
        },
        restoredAt: new Date().toISOString(),
        restoredBy: {
          id: req.user.id,
          name: req.user.name,
        },
      });
    } catch (error) {
      console.error("Restore account error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to restore account",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get user logout history
  static async getLogoutHistory(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { limit, offset } = req.query as {
        limit?: string;
        offset?: string;
      };

      const history = await AccountService.getUserLogoutHistory(
        req.user.id,
        parseInt(limit || "50"),
        parseInt(offset || "0")
      );

      sendResponse(res, 200, true, "Logout history retrieved successfully", {
        history,
        count: history.length,
        pagination: {
          limit: parseInt(limit || "50"),
          offset: parseInt(offset || "0"),
          hasMore: history.length === parseInt(limit || "50"),
        },
      });
    } catch (error) {
      console.error("Get logout history error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve logout history",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get deleted accounts (admin only)
  static async getDeletedAccounts(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const { limit, offset, deletedBy } = req.query as {
        limit?: string;
        offset?: string;
        deletedBy?: string;
      };

      const result = await AccountService.getDeletedAccounts(
        parseInt(limit || "50"),
        parseInt(offset || "0"),
        deletedBy
      );

      sendResponse(res, 200, true, "Deleted accounts retrieved successfully", {
        accounts: result.accounts,
        stats: result.stats,
        pagination: result.pagination,
      });
    } catch (error) {
      console.error("Get deleted accounts error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve deleted accounts",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get account deletion statistics
  static async getAccountDeletionStats(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const stats = await AccountService.getAccountDeletionStats();

      sendResponse(
        res,
        200,
        true,
        "Account deletion statistics retrieved successfully",
        {
          stats,
        }
      );
    } catch (error) {
      console.error("Get account deletion stats error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve account deletion statistics",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get user by ID (admin only)
  static async getUserById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { includeSoftDeleted } = req.query as {
        includeSoftDeleted?: string;
      };

      const user = await AccountService.getUserById(
        id,
        includeSoftDeleted === "true"
      );

      if (!user) {
        sendResponse(res, 404, false, "User not found");
        return;
      }

      sendResponse(res, 200, true, "User retrieved successfully", {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          created_at: user.created_at,
          updated_at: user.updated_at,
          deleted_at: user.deleted_at,
          deletion_reason: user.deletion_reason,
        },
      });
    } catch (error) {
      console.error("Get user by ID error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve user",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Check token status (for debugging/admin purposes)
  static async checkTokenStatus(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const token = req.header("Authorization")?.replace("Bearer ", "");
      if (!token) {
        sendResponse(res, 400, false, "Token not provided");
        return;
      }

      const isBlacklisted = await AccountService.isTokenBlacklisted(token);

      sendResponse(res, 200, true, "Token status checked", {
        token: token.substring(0, 20) + "...", // Only show first 20 chars for security
        isBlacklisted,
        isValid: !isBlacklisted,
        checkedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Check token status error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to check token status",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
}
