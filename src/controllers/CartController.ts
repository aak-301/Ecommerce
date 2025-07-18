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

// src/controllers/OrderController.ts
import { OrderService } from "../services/OrderService";
import { OrderSearchParams } from "../types/product";

export class OrderController {
  // Create order from cart
  static async createOrder(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const orderData = {
        shipping_address: req.body.shipping_address,
        billing_address: req.body.billing_address,
        shipping_method: req.body.shipping_method,
        notes: req.body.notes,
      };

      const order = await OrderService.createOrderFromCart(
        req.user.id,
        orderData
      );

      sendResponse(res, 201, true, "Order created successfully", {
        order,
      });
    } catch (error) {
      console.error("Create order error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to create order",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get order by ID
  static async getOrder(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;
      const order = await OrderService.getOrderById(id);

      if (!order) {
        sendResponse(res, 404, false, "Order not found");
        return;
      }

      // Check if user can access this order
      if (
        order.user_id !== req.user.id &&
        !["admin", "super_admin"].includes(req.user.role)
      ) {
        sendResponse(res, 403, false, "Access denied");
        return;
      }

      sendResponse(res, 200, true, "Order retrieved successfully", {
        order,
      });
    } catch (error) {
      console.error("Get order error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve order",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get order by order number
  static async getOrderByNumber(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { orderNumber } = req.params;
      const order = await OrderService.getOrderByNumber(orderNumber);

      if (!order) {
        sendResponse(res, 404, false, "Order not found");
        return;
      }

      // Check if user can access this order
      if (
        order.user_id !== req.user.id &&
        !["admin", "super_admin"].includes(req.user.role)
      ) {
        sendResponse(res, 403, false, "Access denied");
        return;
      }

      sendResponse(res, 200, true, "Order retrieved successfully", {
        order,
      });
    } catch (error) {
      console.error("Get order by number error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve order",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get user's orders
  static async getUserOrders(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const offset = req.query.offset
        ? parseInt(req.query.offset as string)
        : 0;

      const result = await OrderService.getUserOrders(
        req.user.id,
        limit,
        offset
      );

      sendResponse(res, 200, true, "Orders retrieved successfully", {
        orders: result.data,
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
          has_more: result.has_more,
        },
      });
    } catch (error) {
      console.error("Get user orders error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve orders",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Search orders (Admin/Super Admin)
  static async searchOrders(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user || !["admin", "super_admin"].includes(req.user.role)) {
        sendResponse(res, 403, false, "Access denied");
        return;
      }

      const searchParams: OrderSearchParams = {
        user_id: req.query.user_id as string,
        status: req.query.status as any,
        payment_status: req.query.payment_status as any,
        date_from: req.query.date_from
          ? new Date(req.query.date_from as string)
          : undefined,
        date_to: req.query.date_to
          ? new Date(req.query.date_to as string)
          : undefined,
        search: req.query.search as string,
        sort_by: (req.query.sort_by as any) || "created_at",
        sort_order: (req.query.sort_order as any) || "desc",
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      const result = await OrderService.searchOrders(searchParams);

      sendResponse(res, 200, true, "Orders retrieved successfully", {
        orders: result.data,
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
          has_more: result.has_more,
        },
      });
    } catch (error) {
      console.error("Search orders error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to search orders",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Update order status (Admin/Super Admin)
  static async updateOrderStatus(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user || !["admin", "super_admin"].includes(req.user.role)) {
        sendResponse(res, 403, false, "Access denied");
        return;
      }

      const { id } = req.params;
      const updates = req.body;

      const order = await OrderService.updateOrder(id, updates);

      if (!order) {
        sendResponse(res, 404, false, "Order not found");
        return;
      }

      sendResponse(res, 200, true, "Order updated successfully", {
        order,
      });
    } catch (error) {
      console.error("Update order error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to update order",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Cancel order
  static async cancelOrder(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;
      const { reason } = req.body;

      // Get order to check permissions
      const existingOrder = await OrderService.getOrderById(id);

      if (!existingOrder) {
        sendResponse(res, 404, false, "Order not found");
        return;
      }

      // Users can only cancel their own orders, admins can cancel any order
      if (
        existingOrder.user_id !== req.user.id &&
        !["admin", "super_admin"].includes(req.user.role)
      ) {
        sendResponse(res, 403, false, "Access denied");
        return;
      }

      const order = await OrderService.cancelOrder(id, reason);

      sendResponse(res, 200, true, "Order cancelled successfully", {
        order,
      });
    } catch (error) {
      console.error("Cancel order error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to cancel order",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get order statistics
  static async getOrderStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      let userId: string | undefined;

      // Customers can only see their own stats
      if (req.user.role === "customer") {
        userId = req.user.id;
      } else if (req.query.user_id) {
        // Admins can query specific user stats
        userId = req.query.user_id as string;
      }

      const stats = await OrderService.getOrderStats(userId);

      sendResponse(res, 200, true, "Order statistics retrieved successfully", {
        stats,
      });
    } catch (error) {
      console.error("Get order stats error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve order statistics",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get recent orders
  static async getRecentOrders(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      let userId: string | undefined;

      // Customers can only see their own orders
      if (req.user.role === "customer") {
        userId = req.user.id;
      } else if (req.query.user_id) {
        // Admins can query specific user orders
        userId = req.query.user_id as string;
      }

      const orders = await OrderService.getRecentOrders(limit, userId);

      sendResponse(res, 200, true, "Recent orders retrieved successfully", {
        orders,
      });
    } catch (error) {
      console.error("Get recent orders error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve recent orders",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get top selling products (Admin/Super Admin)
  static async getTopSellingProducts(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user || !["admin", "super_admin"].includes(req.user.role)) {
        sendResponse(res, 403, false, "Access denied");
        return;
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const days = req.query.days ? parseInt(req.query.days as string) : 30;

      const products = await OrderService.getTopSellingProducts(limit, days);

      sendResponse(
        res,
        200,
        true,
        "Top selling products retrieved successfully",
        {
          products,
          period_days: days,
        }
      );
    } catch (error) {
      console.error("Get top selling products error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve top selling products",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
}
