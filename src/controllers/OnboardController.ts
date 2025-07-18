// src/controllers/OnboardController.ts
import { Request, Response } from "express";
import { OnboardService } from "../services/OnboardService";
import { sendResponse } from "../utils/response";
import { User } from "../types";

interface AuthRequest extends Request {
  user?: User;
}

export class OnboardController {
  // Get all pending admins
  static async getPendingAdmins(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const admins = await OnboardService.getPendingAdmins();

      sendResponse(res, 200, true, "Pending admins retrieved successfully", {
        admins,
        count: admins.length,
      });
    } catch (error) {
      console.error("Get pending admins error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve pending admins",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get all admins with filters
  static async getAllAdmins(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { status, search, limit, offset } = req.query as {
        status?: string;
        search?: string;
        limit?: string;
        offset?: string;
      };

      const result = await OnboardService.getAllAdmins(
        status,
        search,
        parseInt(limit || "50"),
        parseInt(offset || "0")
      );

      sendResponse(res, 200, true, "Admins retrieved successfully", {
        admins: result.admins,
        total: result.total,
        stats: result.stats,
        pagination: {
          limit: parseInt(limit || "50"),
          offset: parseInt(offset || "0"),
          hasMore: result.admins.length === parseInt(limit || "50"),
        },
      });
    } catch (error) {
      console.error("Get all admins error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve admins",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get admin by ID
  static async getAdminById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const admin = await OnboardService.getAdminById(id);

      if (!admin) {
        sendResponse(res, 404, false, "Admin not found");
        return;
      }

      sendResponse(res, 200, true, "Admin retrieved successfully", { admin });
    } catch (error) {
      console.error("Get admin by ID error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve admin",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Process onboarding request (approve, reject, suspend)
  static async processOnboardingRequest(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { userId, action, reason, notes } = req.body;

      const result = await OnboardService.processOnboardingRequest(
        { userId, action, reason, notes },
        req.user
      );

      sendResponse(res, 200, true, result.message, {
        admin: {
          id: result.admin.id,
          email: result.admin.email,
          name: result.admin.name,
          role: result.admin.role,
          status: result.admin.status,
          updated_at: result.admin.updated_at,
        },
        action,
        performed_by: {
          id: req.user.id,
          name: req.user.name,
        },
      });
    } catch (error) {
      console.error("Process onboarding request error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to process onboarding request",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Reactivate admin
  static async reactivateAdmin(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { userId, notes } = req.body;

      const result = await OnboardService.reactivateAdmin(
        userId,
        req.user,
        notes
      );

      sendResponse(res, 200, true, result.message, {
        admin: {
          id: result.admin.id,
          email: result.admin.email,
          name: result.admin.name,
          role: result.admin.role,
          status: result.admin.status,
          updated_at: result.admin.updated_at,
        },
        performed_by: {
          id: req.user.id,
          name: req.user.name,
        },
      });
    } catch (error) {
      console.error("Reactivate admin error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to reactivate admin",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get onboarding statistics
  static async getOnboardingStats(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const stats = await OnboardService.getOnboardingStats();

      sendResponse(
        res,
        200,
        true,
        "Onboarding statistics retrieved successfully",
        {
          stats,
        }
      );
    } catch (error) {
      console.error("Get onboarding stats error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve onboarding statistics",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get admins onboarded by current super admin
  static async getMyOnboardedAdmins(
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

      const admins = await OnboardService.getAdminsByOnboarder(
        req.user.id,
        parseInt(limit || "50"),
        parseInt(offset || "0")
      );

      sendResponse(
        res,
        200,
        true,
        "Your onboarded admins retrieved successfully",
        {
          admins,
          count: admins.length,
          pagination: {
            limit: parseInt(limit || "50"),
            offset: parseInt(offset || "0"),
            hasMore: admins.length === parseInt(limit || "50"),
          },
        }
      );
    } catch (error) {
      console.error("Get my onboarded admins error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve your onboarded admins",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get pending admins count
  static async getPendingAdminsCount(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const count = await OnboardService.getPendingAdminsCount();

      sendResponse(
        res,
        200,
        true,
        "Pending admins count retrieved successfully",
        {
          count,
        }
      );
    } catch (error) {
      console.error("Get pending admins count error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve pending admins count",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
}
