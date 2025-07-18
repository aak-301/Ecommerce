// src/routes/onboardRoutes.ts
import { Router } from "express";
import { OnboardController } from "../controllers/OnboardController";
import { authenticate, authorize } from "../middleware/auth";
import {
  validateProcessOnboarding,
  validateReactivateAdmin,
  validateGetAdminsQuery,
  validateAdminIdParam,
} from "../middleware/onboard-validation";
import { authRateLimit } from "../middleware/rateLimit";

const router = Router();

// All onboard routes require super_admin authentication
router.use(authenticate);
router.use(authorize(["super_admin"]));

// Get onboarding statistics
router.get("/stats", OnboardController.getOnboardingStats);

// Get pending admins count (for notifications/badges)
router.get("/pending/count", OnboardController.getPendingAdminsCount);

// Get all pending admins
router.get("/pending", OnboardController.getPendingAdmins);

// Get all admins with filters and pagination
router.get("/admins", validateGetAdminsQuery, OnboardController.getAllAdmins);

// Get admins onboarded by current super admin
router.get(
  "/my-admins",
  validateGetAdminsQuery,
  OnboardController.getMyOnboardedAdmins
);

// Get specific admin by ID
router.get("/admins/:id", validateAdminIdParam, OnboardController.getAdminById);

// Process onboarding request (approve, reject, suspend)
router.post(
  "/process",
  authRateLimit, // Rate limit for security
  validateProcessOnboarding,
  OnboardController.processOnboardingRequest
);

// Reactivate admin (for suspended or rejected admins)
router.post(
  "/reactivate",
  authRateLimit,
  validateReactivateAdmin,
  OnboardController.reactivateAdmin
);

export default router;
