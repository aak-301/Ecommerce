// src/controllers/CustomerController.ts
import { Request, Response } from "express";
import { CustomerService } from "../services/CustomerService";
import { sendResponse } from "../utils/response";
import { User } from "../types";
import {
  CreateAddressRequest,
  UpdateAddressRequest,
  AddToCartRequest,
  UpdateCartItemRequest,
  PlaceOrderRequest,
  CreateReviewRequest,
  UpdateReviewRequest,
  CustomerOrderQueryParams,
  CustomerProductQueryParams,
  CancelOrderRequest,
} from "../types/customer";

interface AuthRequest extends Request {
  user?: User;
}

export class CustomerController {
  // =============================================
  // ADDRESS MANAGEMENT
  // =============================================

  static async createAddress(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const addressData: CreateAddressRequest = req.body;
      const address = await CustomerService.createAddress(
        req.user,
        addressData
      );

      sendResponse(res, 201, true, "Address created successfully", {
        address: {
          id: address.id,
          type: address.type,
          is_default: address.is_default,
          first_name: address.first_name,
          last_name: address.last_name,
          address_line_1: address.address_line_1,
          city: address.city,
          state: address.state,
          postal_code: address.postal_code,
          country: address.country,
          created_at: address.created_at,
        },
      });
    } catch (error) {
      console.error("Create address error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to create address",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  static async getAddresses(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { type } = req.query as { type?: "shipping" | "billing" };
      const addresses = await CustomerService.getCustomerAddresses(
        req.user,
        type
      );

      sendResponse(res, 200, true, "Addresses retrieved successfully", {
        addresses,
        count: addresses.length,
      });
    } catch (error) {
      console.error("Get addresses error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve addresses",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  static async updateAddress(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;
      const updates: UpdateAddressRequest = req.body;

      const address = await CustomerService.updateAddress(
        req.user,
        id,
        updates
      );

      sendResponse(res, 200, true, "Address updated successfully", {
        address: {
          id: address.id,
          type: address.type,
          is_default: address.is_default,
          first_name: address.first_name,
          last_name: address.last_name,
          address_line_1: address.address_line_1,
          city: address.city,
          state: address.state,
          postal_code: address.postal_code,
          country: address.country,
          updated_at: address.updated_at,
        },
      });
    } catch (error) {
      console.error("Update address error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to update address",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  static async deleteAddress(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;
      const result = await CustomerService.deleteAddress(req.user, id);

      sendResponse(res, 200, true, result.message);
    } catch (error) {
      console.error("Delete address error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to delete address",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // =============================================
  // SHOPPING CART MANAGEMENT
  // =============================================

  static async addToCart(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const cartRequest: AddToCartRequest = req.body;
      const result = await CustomerService.addToCart(req.user, cartRequest);

      sendResponse(res, 200, true, result.message, {
        added_at: new Date().toISOString(),
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

  static async getCart(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const cart = await CustomerService.getCart(req.user);

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

  static async updateCartItem(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { productId } = req.params;
      const { variantId } = req.query as { variantId?: string };
      const updateRequest: UpdateCartItemRequest = req.body;

      const result = await CustomerService.updateCartItem(
        req.user,
        productId,
        updateRequest,
        variantId
      );

      sendResponse(res, 200, true, result.message, {
        updated_at: new Date().toISOString(),
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

  static async removeFromCart(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { productId } = req.params;
      const { variantId } = req.query as { variantId?: string };

      const result = await CustomerService.removeFromCart(
        req.user,
        productId,
        variantId
      );

      sendResponse(res, 200, true, result.message);
    } catch (error) {
      console.error("Remove from cart error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to remove item from cart",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  static async clearCart(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const result = await CustomerService.clearCart(req.user);

      sendResponse(res, 200, true, result.message);
    } catch (error) {
      console.error("Clear cart error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to clear cart",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // =============================================
  // ORDER MANAGEMENT
  // =============================================

  static async placeOrder(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const orderData: PlaceOrderRequest = req.body;
      const order = await CustomerService.placeOrder(req.user, orderData);

      sendResponse(res, 201, true, "Order placed successfully", {
        order: {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          payment_status: order.payment_status,
          total_amount: order.total_amount,
          created_at: order.created_at,
        },
        message: "You will receive an order confirmation email shortly.",
      });
    } catch (error) {
      console.error("Place order error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to place order",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  static async getOrders(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const queryParams: CustomerOrderQueryParams = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        status: req.query.status as any,
        payment_status: req.query.payment_status as any,
        start_date: req.query.start_date as string,
        end_date: req.query.end_date as string,
        sort_by: (req.query.sort_by as any) || "created_at",
        sort_order: (req.query.sort_order as any) || "desc",
      };

      const result = await CustomerService.getCustomerOrders(
        req.user,
        queryParams
      );

      sendResponse(res, 200, true, "Orders retrieved successfully", {
        orders: result.orders,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
          hasNext: result.page < result.totalPages,
          hasPrev: result.page > 1,
        },
      });
    } catch (error) {
      console.error("Get orders error:", error);
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

  static async getOrderById(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { orderId } = req.params;
      const order = await CustomerService.getOrderById(req.user, orderId);

      sendResponse(res, 200, true, "Order retrieved successfully", {
        order,
      });
    } catch (error) {
      console.error("Get order by ID error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to retrieve order",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  static async cancelOrder(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { orderId } = req.params;
      const cancelRequest: CancelOrderRequest = req.body;

      const result = await CustomerService.cancelOrder(
        req.user,
        orderId,
        cancelRequest
      );

      sendResponse(res, 200, true, result.message, {
        cancelled_at: new Date().toISOString(),
        refund_info: result.refund_info,
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

  static async getOrderStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const stats = await CustomerService.getOrderStats(req.user);

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

  // =============================================
  // PRODUCT REVIEWS
  // =============================================

  static async createReview(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const reviewData: CreateReviewRequest = req.body;
      const review = await CustomerService.createReview(req.user, reviewData);

      sendResponse(res, 201, true, "Review created successfully", {
        review: {
          id: review.id,
          product_id: review.product_id,
          rating: review.rating,
          title: review.title,
          is_verified_purchase: review.is_verified_purchase,
          created_at: review.created_at,
        },
        message:
          "Your review is pending approval and will be visible once approved.",
      });
    } catch (error) {
      console.error("Create review error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to create review",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  static async updateReview(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { reviewId } = req.params;
      const updates: UpdateReviewRequest = req.body;

      const review = await CustomerService.updateReview(
        req.user,
        reviewId,
        updates
      );

      sendResponse(res, 200, true, "Review updated successfully", {
        review: {
          id: review.id,
          product_id: review.product_id,
          rating: review.rating,
          title: review.title,
          updated_at: review.updated_at,
        },
      });
    } catch (error) {
      console.error("Update review error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to update review",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  static async deleteReview(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { reviewId } = req.params;
      const result = await CustomerService.deleteReview(req.user, reviewId);

      sendResponse(res, 200, true, result.message);
    } catch (error) {
      console.error("Delete review error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to delete review",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  static async getMyReviews(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { limit, offset } = req.query as {
        limit?: string;
        offset?: string;
      };

      const reviews = await CustomerService.getCustomerReviews(
        req.user,
        parseInt(limit || "50"),
        parseInt(offset || "0")
      );

      sendResponse(res, 200, true, "Reviews retrieved successfully", {
        reviews,
        count: reviews.length,
        pagination: {
          limit: parseInt(limit || "50"),
          offset: parseInt(offset || "0"),
          hasMore: reviews.length === parseInt(limit || "50"),
        },
      });
    } catch (error) {
      console.error("Get my reviews error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve reviews",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // =============================================
  // WISHLIST MANAGEMENT
  // =============================================

  static async addToWishlist(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { productId } = req.params;
      const result = await CustomerService.addToWishlist(req.user, productId);

      sendResponse(res, 200, true, result.message, {
        added_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Add to wishlist error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to add to wishlist",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  static async removeFromWishlist(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { productId } = req.params;
      const result = await CustomerService.removeFromWishlist(
        req.user,
        productId
      );

      sendResponse(res, 200, true, result.message);
    } catch (error) {
      console.error("Remove from wishlist error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to remove from wishlist",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  static async getWishlist(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const wishlist = await CustomerService.getWishlist(req.user);

      sendResponse(res, 200, true, "Wishlist retrieved successfully", {
        wishlist,
        count: wishlist.length,
      });
    } catch (error) {
      console.error("Get wishlist error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve wishlist",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  static async checkWishlistStatus(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { productId } = req.params;
      const result = await CustomerService.isInWishlist(req.user, productId);

      sendResponse(res, 200, true, "Wishlist status checked", result);
    } catch (error) {
      console.error("Check wishlist status error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to check wishlist status",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // =============================================
  // PRODUCT BROWSING (CUSTOMER VIEW)
  // =============================================

  static async getProducts(req: Request, res: Response): Promise<void> {
    try {
      const queryParams: CustomerProductQueryParams = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        search: req.query.search as string,
        category_id: req.query.category_id as string,
        min_price: req.query.min_price
          ? parseFloat(req.query.min_price as string)
          : undefined,
        max_price: req.query.max_price
          ? parseFloat(req.query.max_price as string)
          : undefined,
        in_stock: req.query.in_stock === "true",
        featured: req.query.featured === "true",
        sort_by: (req.query.sort_by as any) || "created_at",
        sort_order: (req.query.sort_order as any) || "desc",
        tags: req.query.tags
          ? (req.query.tags as string).split(",")
          : undefined,
      };

      const result = await CustomerService.getProducts(queryParams);

      sendResponse(res, 200, true, "Products retrieved successfully", {
        products: result.products,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
          hasNext: result.page < result.totalPages,
          hasPrev: result.page > 1,
        },
      });
    } catch (error) {
      console.error("Get products error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to retrieve products",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  static async getProductById(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const product = await CustomerService.getProductById(productId);

      sendResponse(res, 200, true, "Product retrieved successfully", {
        product,
      });
    } catch (error) {
      console.error("Get product by ID error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to retrieve product",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  static async getProductReviews(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const { limit, offset } = req.query as {
        limit?: string;
        offset?: string;
      };

      const reviews = await CustomerService.getProductReviews(
        productId,
        parseInt(limit || "20"),
        parseInt(offset || "0")
      );

      sendResponse(res, 200, true, "Product reviews retrieved successfully", {
        reviews,
        count: reviews.length,
        pagination: {
          limit: parseInt(limit || "20"),
          offset: parseInt(offset || "0"),
          hasMore: reviews.length === parseInt(limit || "20"),
        },
      });
    } catch (error) {
      console.error("Get product reviews error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve product reviews",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  static async searchProducts(req: Request, res: Response): Promise<void> {
    try {
      const { q: searchQuery } = req.query as { q: string };

      if (!searchQuery) {
        sendResponse(res, 400, false, "Search query is required");
        return;
      }

      const queryParams: Omit<CustomerProductQueryParams, "search"> = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        category_id: req.query.category_id as string,
        min_price: req.query.min_price
          ? parseFloat(req.query.min_price as string)
          : undefined,
        max_price: req.query.max_price
          ? parseFloat(req.query.max_price as string)
          : undefined,
        in_stock: req.query.in_stock === "true",
        sort_by: (req.query.sort_by as any) || "created_at",
        sort_order: (req.query.sort_order as any) || "desc",
        tags: req.query.tags
          ? (req.query.tags as string).split(",")
          : undefined,
      };

      const result = await CustomerService.searchProducts(
        searchQuery,
        queryParams
      );

      sendResponse(res, 200, true, "Products search completed", {
        products: result.products,
        search_query: result.search_query,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
          hasNext: result.page < result.totalPages,
          hasPrev: result.page > 1,
        },
      });
    } catch (error) {
      console.error("Search products error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to search products",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  static async getCategories(req: Request, res: Response): Promise<void> {
    try {
      const categories = await CustomerService.getCategories();

      sendResponse(res, 200, true, "Categories retrieved successfully", {
        categories,
        count: categories.length,
      });
    } catch (error) {
      console.error("Get categories error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve categories",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  static async getFeaturedProducts(req: Request, res: Response): Promise<void> {
    try {
      const { limit } = req.query as { limit?: string };
      const products = await CustomerService.getFeaturedProducts(
        parseInt(limit || "10")
      );

      sendResponse(res, 200, true, "Featured products retrieved successfully", {
        products,
        count: products.length,
      });
    } catch (error) {
      console.error("Get featured products error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve featured products",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  static async getRelatedProducts(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const { limit } = req.query as { limit?: string };

      const products = await CustomerService.getRelatedProducts(
        productId,
        parseInt(limit || "8")
      );

      sendResponse(res, 200, true, "Related products retrieved successfully", {
        products,
        count: products.length,
      });
    } catch (error) {
      console.error("Get related products error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve related products",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // =============================================
  // CUSTOMER PROFILE
  // =============================================

  static async getProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const profile = await CustomerService.getCustomerProfile(req.user);

      sendResponse(res, 200, true, "Customer profile retrieved successfully", {
        profile,
      });
    } catch (error) {
      console.error("Get customer profile error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve customer profile",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
}
