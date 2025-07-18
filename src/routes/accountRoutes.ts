// src/routes/accountRoutes.ts
import { Router } from "express";
import { AccountController } from "../controllers/AccountController";
import { authenticate, authorize } from "../middleware/auth";
import {
  validateLogout,
  validateDeleteAccount,
  validateAdminDeleteAccount,
  validateForceLogout,
  validateRestoreAccount,
  validateGetDeletedAccountsQuery,
  validateUserIdParam,
  validateLogoutHistoryQuery,
} from "../middleware/account-validation";
import { authRateLimit } from "../middleware/rateLimit";

const router = Router();

// Public/Self-service routes (require authentication)
router.use(authenticate);

// Enhanced logout with session tracking
router.post("/logout", authRateLimit, validateLogout, AccountController.logout);

// Self-delete account
router.delete(
  "/delete",
  authRateLimit,
  validateDeleteAccount,
  AccountController.deleteAccount
);

// Get own logout history
router.get(
  "/logout-history",
  validateLogoutHistoryQuery,
  AccountController.getLogoutHistory
);

// Check token status (useful for debugging)
router.get("/token-status", AccountController.checkTokenStatus);

// Admin-only routes (require super_admin or admin role)
router.use(authorize(["super_admin", "admin"]));

// Admin delete user account
router.delete(
  "/admin/delete",
  authRateLimit,
  validateAdminDeleteAccount,
  AccountController.adminDeleteAccount
);

// Force logout user
router.post(
  "/admin/force-logout",
  authRateLimit,
  validateForceLogout,
  AccountController.forceLogoutUser
);

// Get user by ID (admin view)
router.get(
  "/admin/users/:id",
  validateUserIdParam,
  AccountController.getUserById
);

// Super admin only routes
router.use(authorize(["super_admin"]));

// Restore deleted account
router.post(
  "/admin/restore",
  authRateLimit,
  validateRestoreAccount,
  AccountController.restoreAccount
);

// Get all deleted accounts
router.get(
  "/admin/deleted",
  validateGetDeletedAccountsQuery,
  AccountController.getDeletedAccounts
);

// Get account deletion statistics
router.get("/admin/deletion-stats", AccountController.getAccountDeletionStats);

export default router;
