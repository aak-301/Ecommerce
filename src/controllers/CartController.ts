// src/controllers/CartController.ts
import { Request, Response } from "express";
import { CartService } from "../services/CartService";
import { sendResponse } from "../utils/response";
import { User } from "../types";

interface AuthRequest extends Request {
  user?: User;
}

export class CartController {
  // Get user's cart
  static async getCart(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const cart = await CartService.getUserCart(req.user.id);

      sendResponse(res, 200, true, "Cart retrieved successfully", {
        cart,
      });
    } catch (error) {
      console.error("Get cart error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve cart",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Add item to cart
  static async addItem(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { product_id, variant_id, quantity } = req.body;

      if (!product_id || !quantity || quantity <= 0) {
        sendResponse(
          res,
          400,
          false,
          "Product ID and valid quantity are required"
        );
        return;
      }

      const cartItem = await CartService.addItemToCart(req.user.id, {
        product_id,
        variant_id,
        quantity,
      });

      sendResponse(res, 200, true, "Item added to cart successfully", {
        cart_item: cartItem,
      });
    } catch (error) {
      console.error("Add to cart error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to add item to cart",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Update cart item quantity
  static async updateItem(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { itemId } = req.params;
      const { quantity } = req.body;

      if (typeof quantity !== "number" || quantity < 0) {
        sendResponse(res, 400, false, "Valid quantity is required");
        return;
      }

      const cartItem = await CartService.updateCartItem(itemId, req.user.id, {
        quantity,
      });

      if (!cartItem && quantity > 0) {
        sendResponse(res, 404, false, "Cart item not found");
        return;
      }

      const message =
        quantity === 0
          ? "Item removed from cart successfully"
          : "Cart item updated successfully";

      sendResponse(res, 200, true, message, {
        cart_item: cartItem,
      });
    } catch (error) {
      console.error("Update cart item error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to update cart item",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Remove item from cart
  static async removeItem(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { itemId } = req.params;

      const success = await CartService.removeCartItem(itemId, req.user.id);

      if (!success) {
        sendResponse(res, 404, false, "Cart item not found");
        return;
      }

      sendResponse(res, 200, true, "Item removed from cart successfully");
    } catch (error) {
      console.error("Remove cart item error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to remove cart item",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Clear cart
  static async clearCart(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const success = await CartService.clearUserCart(req.user.id);

      if (!success) {
        sendResponse(res, 404, false, "Cart not found");
        return;
      }

      sendResponse(res, 200, true, "Cart cleared successfully");
    } catch (error) {
      console.error("Clear cart error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to clear cart",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get cart summary (item count and total)
  static async getCartSummary(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const summary = await CartService.getCartSummary(req.user.id);

      sendResponse(res, 200, true, "Cart summary retrieved successfully", {
        summary,
      });
    } catch (error) {
      console.error("Get cart summary error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve cart summary",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
}
