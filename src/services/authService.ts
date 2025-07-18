import { UserModel } from "../models/User";
import { MagicTokenModel } from "../models/MagicToken";
import { EmailService } from "./emailService";
import { User, UserRole } from "../types";
import { generateToken } from "../utils/jwt";

export class AuthService {
  static async requestMagicLink(
    email: string,
    name?: string,
    role?: UserRole
  ): Promise<{ isNewUser: boolean }> {
    let user = await UserModel.findByEmail(email);
    let isNewUser = false;

    if (!user) {
      // New user - create account
      if (!name) {
        throw new Error("Name is required for new users");
      }
      user = await UserModel.create(email, name, role || "customer");
      isNewUser = true;
    }

    // Generate magic token
    const token = await MagicTokenModel.create(email);

    // Send magic link email
    await EmailService.sendMagicLink(email, token, isNewUser);

    return { isNewUser };
  }

  static async verifyMagicLink(
    token: string
  ): Promise<{ user: User; token: string }> {
    // Validate token
    const isValid = await MagicTokenModel.isValid(token);
    if (!isValid) {
      throw new Error("Invalid or expired magic link");
    }

    // Get token details
    const magicToken = await MagicTokenModel.findByToken(token);
    if (!magicToken) {
      throw new Error("Invalid magic link");
    }

    // Get user
    const user = await UserModel.findByEmail(magicToken.email);
    if (!user) {
      throw new Error("User not found");
    }

    // Check if user is active
    if (user.status === "suspended") {
      throw new Error("Account is suspended");
    }

    if (user.status === "rejected") {
      throw new Error("Account has been rejected");
    }

    if (user.role === "admin" && user.status === "pending") {
      throw new Error("Account is pending approval from super admin");
    }

    // Mark token as used
    await MagicTokenModel.markAsUsed(token);

    // Generate JWT token
    const jwtToken = generateToken(user);

    return { user, token: jwtToken };
  }

  static async getCurrentUser(userId: string): Promise<User | null> {
    return await UserModel.findById(userId);
  }
}
