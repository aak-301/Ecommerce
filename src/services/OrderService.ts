// src/services/OrderService.ts
import { OrderModel } from "../models/OrderModel";
import { CartModel } from "../models/CartModel";
import { EmailService } from "./emailService";
import {
  Order,
  CreateOrderRequest,
  UpdateOrderRequest,
  OrderSearchParams,
  PaginatedResponse,
} from "../types/product";

export class OrderService {
  // Create order from cart
  static async createOrderFromCart(
    userId: string,
    orderData: CreateOrderRequest
  ): Promise<Order> {
    const cart = await CartModel.getActiveCart(userId);
    if (!cart) {
      throw new Error("No active cart found");
    }

    const cartWithItems = await CartModel.getCartWithItems(cart.id);
    if (
      !cartWithItems ||
      !cartWithItems.items ||
      cartWithItems.items.length === 0
    ) {
      throw new Error("Cart is empty");
    }

    // Validate stock availability before creating order
    for (const item of cartWithItems.items) {
      if (item.product?.track_quantity && !item.product?.allow_backorders) {
        const availableQuantity = item.variant_id
          ? item.variant?.quantity || 0
          : item.product?.quantity || 0;

        if (availableQuantity < item.quantity) {
          throw new Error(
            `Insufficient stock for ${item.product?.name}. Only ${availableQuantity} units available.`
          );
        }
      }
    }

    const order = await OrderModel.createFromCart(cart.id, userId, orderData);

    // Send order confirmation email
    try {
      await EmailService.sendOrderConfirmation(order);
    } catch (error) {
      console.error("Failed to send order confirmation email:", error);
    }

    return order;
  }

  // Get order by ID
  static async getOrderById(orderId: string): Promise<Order | null> {
    return await OrderModel.findById(orderId);
  }

  // Get order by order number
  static async getOrderByNumber(orderNumber: string): Promise<Order | null> {
    return await OrderModel.findByOrderNumber(orderNumber);
  }

  // Update order
  static async updateOrder(
    orderId: string,
    updates: UpdateOrderRequest
  ): Promise<Order | null> {
    return await OrderModel.update(orderId, updates);
  }

  // Search orders
  static async searchOrders(
    params: OrderSearchParams
  ): Promise<PaginatedResponse<Order>> {
    return await OrderModel.search(params);
  }

  // Get user orders
  static async getUserOrders(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<PaginatedResponse<Order>> {
    return await OrderModel.getUserOrders(userId, limit, offset);
  }

  // Cancel order
  static async cancelOrder(
    orderId: string,
    reason?: string
  ): Promise<Order | null> {
    return await OrderModel.cancelOrder(orderId, reason);
  }

  // Get order statistics
  static async getOrderStats(userId?: string): Promise<any> {
    return await OrderModel.getOrderStats(userId);
  }

  // Get recent orders
  static async getRecentOrders(
    limit: number = 10,
    userId?: string
  ): Promise<Order[]> {
    return await OrderModel.getRecentOrders(limit, userId);
  }

  // Get top selling products
  static async getTopSellingProducts(
    limit: number = 10,
    days: number = 30
  ): Promise<any[]> {
    return await OrderModel.getTopSellingProducts(limit, days);
  }
}
