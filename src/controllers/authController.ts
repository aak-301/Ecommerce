import { Request, Response } from "express";
import { AuthService } from "../services/authService";
import { sendResponse } from "../utils/response";
import { User } from "../types";

interface AuthRequest extends Request {
  user?: User;
}

export class AuthController {
  static async requestMagicLink(req: Request, res: Response): Promise<void> {
    try {
      const { email, name, role } = req.body;

      const result = await AuthService.requestMagicLink(email, name, role);

      sendResponse(res, 200, true, `Magic link sent successfully to ${email}`, {
        isNewUser: result.isNewUser,
        message: result.isNewUser
          ? "Account created. Please check your email for the magic link to complete registration."
          : "Please check your email for the magic link to sign in.",
      });
    } catch (error) {
      console.error("Request magic link error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to send magic link",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  static async verifyMagicLink(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.body;

      const result = await AuthService.verifyMagicLink(token);

      sendResponse(res, 200, true, "Authentication successful", {
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
          status: result.user.status,
        },
        token: result.token,
        expiresIn: process.env.JWT_EXPIRES_IN,
      });
    } catch (error) {
      console.error("Verify magic link error:", error);
      sendResponse(
        res,
        400,
        false,
        "Authentication failed",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  static async getCurrentUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const user = await AuthService.getCurrentUser(req.user.id);

      if (!user) {
        sendResponse(res, 404, false, "User not found");
        return;
      }

      sendResponse(res, 200, true, "User data retrieved successfully", {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        created_at: user.created_at,
        updated_at: user.updated_at,
      });
    } catch (error) {
      console.error("Get current user error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve user data",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  static async logout(req: Request, res: Response): Promise<void> {
    // Since we're using JWT, logout is handled on the client side
    // by removing the token from storage
    sendResponse(res, 200, true, "Logged out successfully", {
      message: "Please remove the token from your client storage",
    });
  }
}
