// src/services/AccountService.ts - Fixed version
import { AccountModel } from "../models/AccountModel";
import { UserModel } from "../models/User"; // Add this import
import { EmailService } from "./emailService";
import { User } from "../types";
import {
  LogoutRequest,
  DeleteAccountRequest,
  AdminDeleteAccountRequest,
} from "../types/account";

export class AccountService {
  // Enhanced logout with session tracking
  static async logout(
    user: User,
    token: string,
    request: LogoutRequest = {},
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ message: string; sessionId: string }> {
    const { reason = "manual" } = request;

    // Create logout session record
    const logoutSession = await AccountModel.createLogoutSession(
      user.id,
      token,
      reason,
      ipAddress,
      userAgent
    );

    // Send logout notification email for security reasons (optional)
    if (reason === "security") {
      try {
        await EmailService.sendSecurityLogoutNotification(
          user.email,
          user.name,
          ipAddress
        );
      } catch (error) {
        console.error("Failed to send logout notification:", error);
        // Don't throw error as logout should succeed even if email fails
      }
    }

    return {
      message: "Logged out successfully",
      sessionId: logoutSession.id,
    };
  }

  // Delete user account (self-service)
  static async deleteAccount(
    user: User,
    request: DeleteAccountRequest = {}
  ): Promise<{ message: string; deletedAccountId: string }> {
    const { reason = "User requested account deletion", feedback } = request;

    // Soft delete the user account
    const success = await AccountModel.softDeleteUser(
      user.id,
      undefined, // self-deletion, no deletedBy
      "user_request",
      feedback || reason
    );

    if (!success) {
      throw new Error("Failed to delete account");
    }

    // Send account deletion confirmation email
    try {
      await EmailService.sendAccountDeletionConfirmation(user.email, user.name);
    } catch (error) {
      console.error("Failed to send deletion confirmation email:", error);
      // Don't throw error as deletion succeeded
    }

    // Get the deleted account record for reference
    const deletedAccount = await AccountModel.getDeletedAccountById(user.id);

    return {
      message: "Account deleted successfully",
      deletedAccountId: deletedAccount?.id || "unknown",
    };
  }

  // Admin delete user account
  static async adminDeleteAccount(
    request: AdminDeleteAccountRequest,
    performedBy: User
  ): Promise<{ message: string; deletedAccountId: string }> {
    const { userId, reason, notes } = request;

    // Get user before deletion for email notification
    const targetUser = await UserModel.findById(userId); // Use UserModel instead
    if (!targetUser) {
      throw new Error("User not found");
    }

    if (targetUser.deleted_at) {
      throw new Error("User account is already deleted");
    }

    // Prevent super admins from being deleted by other admins
    if (
      targetUser.role === "super_admin" &&
      performedBy.role !== "super_admin"
    ) {
      throw new Error("Insufficient permissions to delete super admin account");
    }

    // Soft delete the user account
    const success = await AccountModel.softDeleteUser(
      userId,
      performedBy.id,
      reason,
      notes
    );

    if (!success) {
      throw new Error("Failed to delete account");
    }

    // Send notification to the deleted user
    try {
      await EmailService.sendAdminAccountDeletionNotification(
        targetUser.email,
        targetUser.name,
        reason,
        notes,
        performedBy.name
      );
    } catch (error) {
      console.error("Failed to send admin deletion notification:", error);
    }

    // Get the deleted account record for reference
    const deletedAccount = await AccountModel.getDeletedAccountById(userId);

    return {
      message: `Account deleted successfully by ${performedBy.name}`,
      deletedAccountId: deletedAccount?.id || "unknown",
    };
  }

  // Force logout user (admin action)
  static async forceLogoutUser(
    userId: string,
    performedBy: User,
    reason: string = "admin_forced"
  ): Promise<{ message: string }> {
    // Get user for notification
    const targetUser = await UserModel.findById(userId); // Use UserModel instead
    if (!targetUser) {
      throw new Error("User not found");
    }

    // Force logout all sessions
    await AccountModel.forceLogoutAllUserSessions(
      userId,
      performedBy.id,
      reason
    );

    // Send notification email
    try {
      await EmailService.sendForcedLogoutNotification(
        targetUser.email,
        targetUser.name,
        reason,
        performedBy.name
      );
    } catch (error) {
      console.error("Failed to send forced logout notification:", error);
    }

    return {
      message: `User ${targetUser.name} has been logged out from all devices`,
    };
  }

  // Restore deleted account (admin only)
  static async restoreAccount(
    userId: string,
    performedBy: User
  ): Promise<{ message: string; user: User }> {
    // Check if account exists in deleted records
    const deletedAccount = await AccountModel.getDeletedAccountById(userId);
    if (!deletedAccount) {
      throw new Error("Deleted account not found");
    }

    // Restore the account
    const success = await AccountModel.restoreDeletedUser(userId);
    if (!success) {
      throw new Error("Failed to restore account");
    }

    // Get restored user data
    const restoredUser = await UserModel.findById(userId); // Use UserModel instead
    if (!restoredUser) {
      throw new Error("Failed to retrieve restored user data");
    }

    // Send restoration notification
    try {
      await EmailService.sendAccountRestorationNotification(
        restoredUser.email,
        restoredUser.name,
        performedBy.name
      );
    } catch (error) {
      console.error("Failed to send restoration notification:", error);
    }

    return {
      message: "Account restored successfully",
      user: restoredUser,
    };
  }

  // Get user by ID
  static async getUserById(
    id: string,
    includeSoftDeleted: boolean = false
  ): Promise<User | null> {
    return await UserModel.findById(id, includeSoftDeleted);
  }

  // Get user logout history
  static async getUserLogoutHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ) {
    return await AccountModel.getUserLogoutHistory(userId, limit, offset);
  }

  // Get deleted accounts (admin only)
  static async getDeletedAccounts(
    limit: number = 50,
    offset: number = 0,
    deletedBy?: string
  ) {
    const accounts = await AccountModel.getDeletedAccounts(
      limit,
      offset,
      deletedBy
    );
    const stats = await AccountModel.getAccountDeletionStats();

    return {
      accounts,
      stats,
      pagination: {
        limit,
        offset,
        hasMore: accounts.length === limit,
      },
    };
  }

  // Check if token is blacklisted
  static async isTokenBlacklisted(token: string): Promise<boolean> {
    return await AccountModel.isTokenBlacklisted(token);
  }

  // Get account deletion statistics
  static async getAccountDeletionStats() {
    return await AccountModel.getAccountDeletionStats();
  }
}
