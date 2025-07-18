// src/controllers/OrderController.ts
import { Request, Response } from "express";
import { OrderService } from "../services/OrderService";
import { CouponService } from "../services/CouponService";
import { SalesCampaignService } from "../services/SalesCampaignService";
import { BogoService } from "../services/BogoService";
import { AuthRequest } from "../types/auth";
import {
  OrderSearchParams,
  CreateOrderRequest,
  UpdateOrderRequest,
  OrderStatus,
  PaymentStatus,
} from "../types/product";
import { sendResponse } from "../utils/response";
import { validateOrderData } from "../utils/validation";

export class OrderController {
  // =============================================
  // ORDER CREATION
  // =============================================

  /**
   * Create order from cart with discount calculations
   */
  static async createOrder(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const orderData: CreateOrderRequest = {
        shipping_address: req.body.shipping_address,
        billing_address: req.body.billing_address,
        shipping_method: req.body.shipping_method,
        notes: req.body.notes,
        coupon_code: req.body.coupon_code,
        campaign_id: req.body.campaign_id,
        bogo_offers: req.body.bogo_offers || [],
      };

      // Validate order data
      const validation = validateOrderData(orderData);
      if (!validation.isValid) {
        sendResponse(
          res,
          400,
          false,
          "Invalid order data",
          null,
          validation.errors
        );
        return;
      }

      // Create order with all discount calculations
      const order = await OrderService.createOrderFromCart(
        req.user.id,
        orderData
      );

      sendResponse(res, 201, true, "Order created successfully", {
        order,
        message: "Order has been placed and is being processed",
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

  /**
   * Create order with manual discount application
   */
  static async createOrderWithDiscounts(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const {
        cart_items,
        shipping_address,
        billing_address,
        shipping_method,
        coupon_code,
        campaign_id,
        bogo_offers,
        notes,
      } = req.body;

      if (
        !cart_items ||
        !Array.isArray(cart_items) ||
        cart_items.length === 0
      ) {
        sendResponse(res, 400, false, "Cart items are required");
        return;
      }

      // Calculate order totals with discounts
      const orderCalculation = await OrderService.calculateOrderTotals(
        cart_items,
        {
          coupon_code,
          campaign_id,
          bogo_offers,
          user_id: req.user.id,
        }
      );

      // Create order with calculated totals
      const order = await OrderService.createOrderWithItems(
        req.user.id,
        cart_items,
        orderCalculation,
        {
          shipping_address,
          billing_address,
          shipping_method,
          notes,
        }
      );

      sendResponse(res, 201, true, "Order created successfully", {
        order,
        discount_breakdown: orderCalculation.discount_breakdown,
      });
    } catch (error) {
      console.error("Create order with discounts error:", error);
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

  // =============================================
  // ORDER RETRIEVAL
  // =============================================

  /**
   * Get order by ID
   */
  static async getOrder(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;

      if (!id) {
        sendResponse(res, 400, false, "Order ID is required");
        return;
      }

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

  /**
   * Get order by order number
   */
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

      if (!orderNumber) {
        sendResponse(res, 400, false, "Order number is required");
        return;
      }

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

  /**
   * Get user's orders
   */
  static async getUserOrders(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const searchParams: OrderSearchParams = {
        user_id: req.user.id,
        status: req.query.status as OrderStatus,
        payment_status: req.query.payment_status as PaymentStatus,
        date_from: req.query.date_from
          ? new Date(req.query.date_from as string)
          : undefined,
        date_to: req.query.date_to
          ? new Date(req.query.date_to as string)
          : undefined,
        search: req.query.search as string,
        sort_by: (req.query.sort_by as any) || "created_at",
        sort_order: (req.query.sort_order as any) || "desc",
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      const result = await OrderService.searchOrders(searchParams);

      sendResponse(res, 200, true, "Orders retrieved successfully", {
        orders: result.orders,
        pagination: {
          total: result.total,
          limit: searchParams.limit,
          offset: searchParams.offset,
          has_more:
            result.total >
            (searchParams.offset || 0) + (searchParams.limit || 20),
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

  // =============================================
  // ORDER STATUS MANAGEMENT
  // =============================================

  /**
   * Update order status
   */
  static async updateOrderStatus(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;
      const updateData: UpdateOrderRequest = req.body;

      if (!id) {
        sendResponse(res, 400, false, "Order ID is required");
        return;
      }

      // Get existing order to check permissions
      const existingOrder = await OrderService.getOrderById(id);
      if (!existingOrder) {
        sendResponse(res, 404, false, "Order not found");
        return;
      }

      // Check permissions
      if (!["admin", "super_admin"].includes(req.user.role)) {
        sendResponse(res, 403, false, "Access denied");
        return;
      }

      const updatedOrder = await OrderService.updateOrder(id, updateData);

      sendResponse(res, 200, true, "Order updated successfully", {
        order: updatedOrder,
      });
    } catch (error) {
      console.error("Update order status error:", error);
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

  /**
   * Cancel order
   */
  static async cancelOrder(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;
      const { reason } = req.body;

      if (!id) {
        sendResponse(res, 400, false, "Order ID is required");
        return;
      }

      // Get existing order to check permissions
      const existingOrder = await OrderService.getOrderById(id);
      if (!existingOrder) {
        sendResponse(res, 404, false, "Order not found");
        return;
      }

      // Check if user can cancel this order
      if (
        existingOrder.user_id !== req.user.id &&
        !["admin", "super_admin"].includes(req.user.role)
      ) {
        sendResponse(res, 403, false, "Access denied");
        return;
      }

      const cancelledOrder = await OrderService.cancelOrder(
        id,
        reason,
        req.user.id
      );

      sendResponse(res, 200, true, "Order cancelled successfully", {
        order: cancelledOrder,
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

  // =============================================
  // ADMIN FUNCTIONS
  // =============================================

  /**
   * Search all orders (Admin only)
   */
  static async searchOrders(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      if (!["admin", "super_admin"].includes(req.user.role)) {
        sendResponse(res, 403, false, "Access denied");
        return;
      }

      const searchParams: OrderSearchParams = {
        user_id: req.query.user_id as string,
        status: req.query.status as OrderStatus,
        payment_status: req.query.payment_status as PaymentStatus,
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
        orders: result.orders,
        pagination: {
          total: result.total,
          limit: searchParams.limit,
          offset: searchParams.offset,
          has_more:
            result.total >
            (searchParams.offset || 0) + (searchParams.limit || 50),
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

  /**
   * Get order statistics
   */
  static async getOrderStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const isAdmin = ["admin", "super_admin"].includes(req.user.role);
      const userId = isAdmin ? undefined : req.user.id;

      const stats = await OrderService.getOrderStatistics(userId);

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

  /**
   * Get recent orders
   */
  static async getRecentOrders(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const isAdmin = ["admin", "super_admin"].includes(req.user.role);
      const userId = isAdmin ? undefined : req.user.id;

      const orders = await OrderService.getRecentOrders(userId, limit);

      sendResponse(res, 200, true, "Recent orders retrieved successfully", {
        orders,
        count: orders.length,
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

  /**
   * Get top selling products
   */
  static async getTopSellingProducts(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      if (!["admin", "super_admin"].includes(req.user.role)) {
        sendResponse(res, 403, false, "Access denied");
        return;
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const dateFrom = req.query.date_from
        ? new Date(req.query.date_from as string)
        : undefined;
      const dateTo = req.query.date_to
        ? new Date(req.query.date_to as string)
        : undefined;

      const topProducts = await OrderService.getTopSellingProducts(
        limit,
        dateFrom,
        dateTo
      );

      sendResponse(
        res,
        200,
        true,
        "Top selling products retrieved successfully",
        {
          products: topProducts,
          count: topProducts.length,
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

  // =============================================
  // DISCOUNT VALIDATION & CALCULATION
  // =============================================

  /**
   * Validate coupon code for order
   */
  static async validateCoupon(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { coupon_code, order_amount, product_ids, category_ids } = req.body;

      if (!coupon_code || !order_amount) {
        sendResponse(
          res,
          400,
          false,
          "Coupon code and order amount are required"
        );
        return;
      }

      const validation = await CouponService.validateCoupon({
        code: coupon_code,
        user_id: req.user.id,
        order_amount,
        product_ids,
        category_ids,
      });

      sendResponse(res, 200, true, "Coupon validation completed", {
        validation,
      });
    } catch (error) {
      console.error("Validate coupon error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to validate coupon",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  /**
   * Calculate order totals with discounts
   */
  static async calculateOrderTotals(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const {
        cart_items,
        coupon_code,
        campaign_id,
        bogo_offers,
        shipping_method,
      } = req.body;

      if (
        !cart_items ||
        !Array.isArray(cart_items) ||
        cart_items.length === 0
      ) {
        sendResponse(res, 400, false, "Cart items are required");
        return;
      }

      const calculation = await OrderService.calculateOrderTotals(cart_items, {
        coupon_code,
        campaign_id,
        bogo_offers,
        shipping_method,
        user_id: req.user.id,
      });

      sendResponse(res, 200, true, "Order totals calculated successfully", {
        calculation,
      });
    } catch (error) {
      console.error("Calculate order totals error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to calculate order totals",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  /**
   * Get applicable discounts for cart
   */
  static async getApplicableDiscounts(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { cart_items } = req.body;

      if (
        !cart_items ||
        !Array.isArray(cart_items) ||
        cart_items.length === 0
      ) {
        sendResponse(res, 400, false, "Cart items are required");
        return;
      }

      const applicableDiscounts = await OrderService.getApplicableDiscounts(
        cart_items,
        req.user.id
      );

      sendResponse(
        res,
        200,
        true,
        "Applicable discounts retrieved successfully",
        {
          discounts: applicableDiscounts,
        }
      );
    } catch (error) {
      console.error("Get applicable discounts error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve applicable discounts",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // =============================================
  // ORDER EXPORT & REPORTING
  // =============================================

  /**
   * Export orders to CSV
   */
  static async exportOrders(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      if (!["admin", "super_admin"].includes(req.user.role)) {
        sendResponse(res, 403, false, "Access denied");
        return;
      }

      const searchParams: OrderSearchParams = {
        status: req.query.status as OrderStatus,
        payment_status: req.query.payment_status as PaymentStatus,
        date_from: req.query.date_from
          ? new Date(req.query.date_from as string)
          : undefined,
        date_to: req.query.date_to
          ? new Date(req.query.date_to as string)
          : undefined,
        search: req.query.search as string,
      };

      const csvData = await OrderService.exportOrders(searchParams);

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="orders-${
          new Date().toISOString().split("T")[0]
        }.csv"`
      );
      res.send(csvData);
    } catch (error) {
      console.error("Export orders error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to export orders",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  /**
   * Get order analytics
   */
  static async getOrderAnalytics(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      if (!["admin", "super_admin"].includes(req.user.role)) {
        sendResponse(res, 403, false, "Access denied");
        return;
      }

      const dateFrom = req.query.date_from
        ? new Date(req.query.date_from as string)
        : undefined;
      const dateTo = req.query.date_to
        ? new Date(req.query.date_to as string)
        : undefined;

      const analytics = await OrderService.getOrderAnalytics(dateFrom, dateTo);

      sendResponse(res, 200, true, "Order analytics retrieved successfully", {
        analytics,
      });
    } catch (error) {
      console.error("Get order analytics error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve order analytics",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
}
