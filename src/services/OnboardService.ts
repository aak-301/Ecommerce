// src/services/OnboardService.ts
import { OnboardModel } from "../models/OnboardModel";
import { EmailService } from "./emailService";
import {
  OnboardingStats,
  AdminWithOnboardingInfo,
  OnboardRequest,
} from "../types/onboard";
import { User } from "../types";

export class OnboardService {
  // Get all pending admins
  static async getPendingAdmins(): Promise<AdminWithOnboardingInfo[]> {
    const admins = await OnboardModel.getPendingAdmins();

    // Add onboarding history for each admin
    for (const admin of admins) {
      admin.onboarding_history = await OnboardModel.getOnboardingHistory(
        admin.id
      );
    }

    return admins;
  }

  // Get all admins with filters
  static async getAllAdmins(
    status?: string,
    search?: string,
    limit = 50,
    offset = 0
  ): Promise<{
    admins: AdminWithOnboardingInfo[];
    total: number;
    stats: OnboardingStats;
  }> {
    let admins: AdminWithOnboardingInfo[];

    if (search) {
      admins = await OnboardModel.searchAdmins(search, status, limit, offset);
    } else {
      admins = await OnboardModel.getAllAdmins(status, limit, offset);
    }

    // Get onboarding history for each admin
    for (const admin of admins) {
      admin.onboarding_history = await OnboardModel.getOnboardingHistory(
        admin.id
      );
    }

    const stats = await OnboardModel.getOnboardingStats();

    return {
      admins,
      total: stats.total_admins,
      stats,
    };
  }

  // Get admin by ID
  static async getAdminById(
    id: string
  ): Promise<AdminWithOnboardingInfo | null> {
    const admin = await OnboardModel.getAdminById(id);

    if (admin) {
      admin.onboarding_history = await OnboardModel.getOnboardingHistory(
        admin.id
      );
    }

    return admin;
  }

  // Process onboarding request
  static async processOnboardingRequest(
    request: OnboardRequest,
    performedBy: User
  ): Promise<{ admin: User; message: string }> {
    const { userId, action, reason, notes } = request;

    // Check if admin exists
    const admin = await OnboardModel.getAdminById(userId);
    if (!admin) {
      throw new Error("Admin not found");
    }

    let updatedAdmin: User | null = null;
    let message = "";
    let emailSubject = "";
    let emailAction = "";

    switch (action) {
      case "approve":
        if (admin.status !== "pending" && admin.status !== "rejected") {
          throw new Error(
            "Admin can only be approved if status is pending or rejected"
          );
        }
        updatedAdmin = await OnboardModel.approveAdmin(
          userId,
          performedBy.id,
          notes
        );
        message = "Admin approved successfully";
        emailSubject = "Account Approved - Welcome!";
        emailAction = "approved";
        break;

      case "reject":
        if (admin.status !== "pending") {
          throw new Error("Admin can only be rejected if status is pending");
        }
        updatedAdmin = await OnboardModel.rejectAdmin(
          userId,
          performedBy.id,
          reason,
          notes
        );
        message = "Admin rejected successfully";
        emailSubject = "Account Application Rejected";
        emailAction = "rejected";
        break;

      case "suspend":
        if (admin.status !== "active") {
          throw new Error("Admin can only be suspended if status is active");
        }
        updatedAdmin = await OnboardModel.suspendAdmin(
          userId,
          performedBy.id,
          reason,
          notes
        );
        message = "Admin suspended successfully";
        emailSubject = "Account Suspended";
        emailAction = "suspended";
        break;

      default:
        throw new Error("Invalid action");
    }

    if (!updatedAdmin) {
      throw new Error("Failed to update admin status");
    }

    // Send notification email
    try {
      await EmailService.sendOnboardingNotification(
        updatedAdmin.email,
        updatedAdmin.name,
        emailAction,
        emailSubject,
        reason,
        notes
      );
    } catch (error) {
      console.error("Failed to send onboarding notification email:", error);
      // Don't throw error here as the main operation succeeded
    }

    return { admin: updatedAdmin, message };
  }

  // Reactivate admin
  static async reactivateAdmin(
    userId: string,
    performedBy: User,
    notes?: string
  ): Promise<{ admin: User; message: string }> {
    const admin = await OnboardModel.getAdminById(userId);
    if (!admin) {
      throw new Error("Admin not found");
    }

    if (admin.status !== "suspended" && admin.status !== "rejected") {
      throw new Error(
        "Admin can only be reactivated if status is suspended or rejected"
      );
    }

    const updatedAdmin = await OnboardModel.reactivateAdmin(
      userId,
      performedBy.id,
      notes
    );

    if (!updatedAdmin) {
      throw new Error("Failed to reactivate admin");
    }

    // Send notification email
    try {
      await EmailService.sendOnboardingNotification(
        updatedAdmin.email,
        updatedAdmin.name,
        "reactivated",
        "Account Reactivated",
        undefined,
        notes
      );
    } catch (error) {
      console.error("Failed to send reactivation notification email:", error);
    }

    return { admin: updatedAdmin, message: "Admin reactivated successfully" };
  }

  // Get onboarding statistics
  static async getOnboardingStats(): Promise<OnboardingStats> {
    return await OnboardModel.getOnboardingStats();
  }

  // Get admins onboarded by a specific super admin
  static async getAdminsByOnboarder(
    onboarderId: string,
    limit = 50,
    offset = 0
  ): Promise<AdminWithOnboardingInfo[]> {
    const admins = await OnboardModel.getAdminsByOnboarder(
      onboarderId,
      limit,
      offset
    );

    // Add onboarding history for each admin
    for (const admin of admins) {
      admin.onboarding_history = await OnboardModel.getOnboardingHistory(
        admin.id
      );
    }

    return admins;
  }

  // Get pending admins count
  static async getPendingAdminsCount(): Promise<number> {
    return await OnboardModel.getPendingAdminsCount();
  }
}
