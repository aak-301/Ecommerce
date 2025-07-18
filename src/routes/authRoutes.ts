import { Router } from "express";
import { AuthController } from "../controllers/authController";
import { authenticate } from "../middleware/auth";
import {
  validateRequestMagicLink,
  validateVerifyMagicLink,
} from "../middleware/validation";
import { authRateLimit, verifyRateLimit } from "../middleware/rateLimit";

const router = Router();

// Public routes
router.post(
  "/request-magic-link",
  authRateLimit,
  validateRequestMagicLink,
  AuthController.requestMagicLink
);
router.post(
  "/verify-magic-link",
  verifyRateLimit,
  validateVerifyMagicLink,
  AuthController.verifyMagicLink
);

// Protected routes
router.get("/me", authenticate, AuthController.getCurrentUser);
router.post("/logout", authenticate, AuthController.logout);

export default router;
