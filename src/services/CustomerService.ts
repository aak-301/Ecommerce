// src/services/CustomerService.ts
import { CustomerModel } from "../models/CustomerModel";
import { ProductModel } from "../models/ProductModel";
import { User } from "../types";
import {
  CustomerAddress,
  CartItem,
  Order,
  ProductReview,
  WishlistItem,
  CreateAddressRequest,
  UpdateAddressRequest,
  AddToCartRequest,
  UpdateCartItemRequest,
  PlaceOrderRequest,
  CreateReviewRequest,
  UpdateReviewRequest,
  CustomerOrderQueryParams,
  CustomerProductQueryParams,
  OrderWithItems,
  CartSummary,
  CustomerOrderStats,
  ProductWithReviews,
  CancelOrderRequest,
} from "../types/customer";

export class CustomerService {
  // =============================================
  // ADDRESS MANAGEMENT
  // =============================================

  static async createAddress(
    user: User,
    addressData: CreateAddressRequest
  ): Promise<CustomerAddress> {
    if (user.role !== "customer") {
      throw new Error("Only customers can manage addresses");
    }

    // Validate required fields
    if (!addressData.first_name || !addressData.last_name) {
      throw new Error("First name and last name are required");
    }

    if (
      !addressData.address_line_1 ||
      !addressData.city ||
      !addressData.state ||
      !addressData.postal_code
    ) {
      throw new Error(
        "Address line 1, city, state, and postal code are required"
      );
    }

    // Validate postal code format (basic validation for India)
    if (!/^\d{6}$/.test(addressData.postal_code)) {
      throw new Error("Invalid postal code format");
    }

    return await CustomerModel.createAddress(user.id, addressData);
  }

  static async getCustomerAddresses(
    user: User,
    type?: "shipping" | "billing"
  ): Promise<CustomerAddress[]> {
    if (user.role !== "customer") {
      throw new Error("Only customers can view addresses");
    }

    return await CustomerModel.getCustomerAddresses(user.id, type);
  }

  static async updateAddress(
    user: User,
    addressId: string,
    updates: UpdateAddressRequest
  ): Promise<CustomerAddress> {
    if (user.role !== "customer") {
      throw new Error("Only customers can update addresses");
    }

    // Validate the address belongs to the user
    const existingAddress = await CustomerModel.getAddressById(
      addressId,
      user.id
    );
    if (!existingAddress) {
      throw new Error("Address not found or access denied");
    }

    // Validate postal code if being updated
    if (updates.postal_code && !/^\d{6}$/.test(updates.postal_code)) {
      throw new Error("Invalid postal code format");
    }

    const updatedAddress = await CustomerModel.updateAddress(
      addressId,
      user.id,
      updates
    );
    if (!updatedAddress) {
      throw new Error("Failed to update address");
    }

    return updatedAddress;
  }

  static async deleteAddress(
    user: User,
    addressId: string
  ): Promise<{ message: string }> {
    if (user.role !== "customer") {
      throw new Error("Only customers can delete addresses");
    }

    // Validate the address belongs to the user
    const existingAddress = await CustomerModel.getAddressById(
      addressId,
      user.id
    );
    if (!existingAddress) {
      throw new Error("Address not found or access denied");
    }

    const success = await CustomerModel.deleteAddress(addressId, user.id);
    if (!success) {
      throw new Error("Failed to delete address");
    }

    return { message: "Address deleted successfully" };
  }

  // =============================================
  // SHOPPING CART MANAGEMENT
  // =============================================

  static async addToCart(
    user: User,
    request: AddToCartRequest
  ): Promise<{ message: string }> {
    if (user.role !== "customer") {
      throw new Error("Only customers can manage shopping cart");
    }

    const { product_id, variant_id, quantity = 1 } = request;

    if (quantity <= 0) {
      throw new Error("Quantity must be greater than 0");
    }

    if (quantity > 100) {
      throw new Error("Cannot add more than 100 items at once");
    }

    // Validate product exists and is active
    const product = await ProductModel.findById(product_id);
    if (!product || product.status !== "active") {
      throw new Error("Product not found or not available");
    }

    // Check stock availability
    let availableQuantity = product.quantity;
    let price = product.sale_price || product.price;

    if (variant_id) {
      const variants = await CustomerModel.getProductVariants(product_id);
      const variant = variants.find((v) => v.id === variant_id && v.is_active);

      if (!variant) {
        throw new Error("Product variant not found or not available");
      }

      availableQuantity = variant.quantity;
      price = variant.sale_price || variant.price || price;
    }

    if (product.track_quantity && availableQuantity < quantity) {
      throw new Error(`Only ${availableQuantity} items available in stock`);
    }

    const success = await CustomerModel.addToCart(
      user.id,
      product_id,
      variant_id || null,
      quantity,
      price
    );
    if (!success) {
      throw new Error("Failed to add item to cart");
    }

    return { message: "Item added to cart successfully" };
  }

  static async getCart(user: User): Promise<CartSummary> {
    if (user.role !== "customer") {
      throw new Error("Only customers can view shopping cart");
    }

    return await CustomerModel.getCartSummary(user.id);
  }

  static async updateCartItem(
    user: User,
    productId: string,
    request: UpdateCartItemRequest,
    variantId?: string
  ): Promise<{ message: string }> {
    if (user.role !== "customer") {
      throw new Error("Only customers can update shopping cart");
    }

    const { quantity } = request;

    if (quantity <= 0) {
      throw new Error("Quantity must be greater than 0");
    }

    if (quantity > 100) {
      throw new Error("Cannot have more than 100 items of the same product");
    }

    // Validate product and stock
    const product = await ProductModel.findById(productId);
    if (!product || product.status !== "active") {
      throw new Error("Product not found or not available");
    }

    let availableQuantity = product.quantity;

    if (variantId) {
      const variants = await CustomerModel.getProductVariants(productId);
      const variant = variants.find((v) => v.id === variantId && v.is_active);

      if (!variant) {
        throw new Error("Product variant not found or not available");
      }

      availableQuantity = variant.quantity;
    }

    if (product.track_quantity && availableQuantity < quantity) {
      throw new Error(`Only ${availableQuantity} items available in stock`);
    }

    const success = await CustomerModel.updateCartItem(
      user.id,
      productId,
      variantId || null,
      quantity
    );
    if (!success) {
      throw new Error("Failed to update cart item or item not found in cart");
    }

    return { message: "Cart item updated successfully" };
  }

  static async removeFromCart(
    user: User,
    productId: string,
    variantId?: string
  ): Promise<{ message: string }> {
    if (user.role !== "customer") {
      throw new Error("Only customers can manage shopping cart");
    }

    const success = await CustomerModel.removeFromCart(
      user.id,
      productId,
      variantId || null
    );
    if (!success) {
      throw new Error("Failed to remove item from cart or item not found");
    }

    return { message: "Item removed from cart successfully" };
  }

  static async clearCart(user: User): Promise<{ message: string }> {
    if (user.role !== "customer") {
      throw new Error("Only customers can manage shopping cart");
    }

    const success = await CustomerModel.clearCart(user.id);
    if (!success) {
      throw new Error("Failed to clear cart");
    }

    return { message: "Cart cleared successfully" };
  }

  // =============================================
  // ORDER MANAGEMENT
  // =============================================

  static async placeOrder(
    user: User,
    orderData: PlaceOrderRequest
  ): Promise<Order> {
    if (user.role !== "customer") {
      throw new Error("Only customers can place orders");
    }

    // Validate addresses exist and belong to user
    const [shippingAddress, billingAddress] = await Promise.all([
      CustomerModel.getAddressById(orderData.shipping_address_id, user.id),
      CustomerModel.getAddressById(orderData.billing_address_id, user.id),
    ]);

    if (!shippingAddress) {
      throw new Error("Invalid shipping address");
    }

    if (!billingAddress) {
      throw new Error("Invalid billing address");
    }

    // Validate payment method
    const allowedPaymentMethods = [
      "credit_card",
      "debit_card",
      "upi",
      "net_banking",
      "cod",
    ];
    if (!allowedPaymentMethods.includes(orderData.payment_method)) {
      throw new Error("Invalid payment method");
    }

    // Get cart to validate it's not empty
    const cart = await CustomerModel.getCart(user.id);
    if (cart.length === 0) {
      throw new Error("Cannot place order with empty cart");
    }

    // Check if all items are still available
    const unavailableItems = cart.filter((item) => !item.is_available);
    if (unavailableItems.length > 0) {
      throw new Error(
        `Some items are no longer available: ${unavailableItems
          .map((i) => i.product_name)
          .join(", ")}`
      );
    }

    return await CustomerModel.placeOrder(user.id, orderData);
  }

  static async getCustomerOrders(
    user: User,
    params: CustomerOrderQueryParams = {}
  ): Promise<{
    orders: OrderWithItems[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    if (user.role !== "customer") {
      throw new Error("Only customers can view their orders");
    }

    // Validate date range if provided
    if (params.start_date && params.end_date) {
      const startDate = new Date(params.start_date);
      const endDate = new Date(params.end_date);

      if (startDate > endDate) {
        throw new Error("Start date cannot be after end date");
      }
    }

    return await CustomerModel.getCustomerOrders(user.id, params);
  }

  static async getOrderById(
    user: User,
    orderId: string
  ): Promise<OrderWithItems> {
    if (user.role !== "customer") {
      throw new Error("Only customers can view their orders");
    }

    const order = await CustomerModel.getOrderById(orderId, user.id);
    if (!order) {
      throw new Error("Order not found or access denied");
    }

    return order;
  }

  static async cancelOrder(
    user: User,
    orderId: string,
    request: CancelOrderRequest = {}
  ): Promise<{ message: string; refund_info?: any }> {
    if (user.role !== "customer") {
      throw new Error("Only customers can cancel their orders");
    }

    // Verify order belongs to user and get current status
    const order = await CustomerModel.getOrderById(orderId, user.id);
    if (!order) {
      throw new Error("Order not found or access denied");
    }

    // Check if order can be cancelled
    if (!["pending", "confirmed"].includes(order.status)) {
      throw new Error("Order cannot be cancelled at this stage");
    }

    if (order.status === "cancelled") {
      throw new Error("Order is already cancelled");
    }

    const success = await CustomerModel.cancelOrder(
      orderId,
      user.id,
      request.reason
    );
    if (!success) {
      throw new Error("Failed to cancel order");
    }

    let refundInfo = undefined;
    if (order.payment_status === "paid") {
      refundInfo = {
        refund_amount: order.total_amount,
        refund_method: order.payment_method,
        estimated_refund_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      };
    }

    return {
      message: "Order cancelled successfully",
      refund_info: refundInfo,
    };
  }

  static async getOrderStats(user: User): Promise<CustomerOrderStats> {
    if (user.role !== "customer") {
      throw new Error("Only customers can view their order statistics");
    }

    return await CustomerModel.getCustomerOrderStats(user.id);
  }

  // =============================================
  // PRODUCT REVIEWS
  // =============================================

  static async createReview(
    user: User,
    reviewData: CreateReviewRequest
  ): Promise<ProductReview> {
    if (user.role !== "customer") {
      throw new Error("Only customers can create reviews");
    }

    // Validate rating
    if (reviewData.rating < 1 || reviewData.rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }

    // Validate product exists
    const product = await ProductModel.findById(reviewData.product_id);
    if (!product || product.status !== "active") {
      throw new Error("Product not found or not available for review");
    }

    // Check if user already reviewed this product
    const existingReviews = await CustomerModel.getCustomerReviews(user.id);
    const hasReviewed = existingReviews.some(
      (review) => review.product_id === reviewData.product_id
    );

    if (hasReviewed) {
      throw new Error("You have already reviewed this product");
    }

    // Validate review text length
    if (reviewData.review_text && reviewData.review_text.length > 2000) {
      throw new Error("Review text cannot exceed 2000 characters");
    }

    if (reviewData.title && reviewData.title.length > 255) {
      throw new Error("Review title cannot exceed 255 characters");
    }

    return await CustomerModel.createReview(user.id, reviewData);
  }

  static async updateReview(
    user: User,
    reviewId: string,
    updates: UpdateReviewRequest
  ): Promise<ProductReview> {
    if (user.role !== "customer") {
      throw new Error("Only customers can update reviews");
    }

    // Validate rating if provided
    if (updates.rating && (updates.rating < 1 || updates.rating > 5)) {
      throw new Error("Rating must be between 1 and 5");
    }

    // Validate text lengths
    if (updates.review_text && updates.review_text.length > 2000) {
      throw new Error("Review text cannot exceed 2000 characters");
    }

    if (updates.title && updates.title.length > 255) {
      throw new Error("Review title cannot exceed 255 characters");
    }

    const updatedReview = await CustomerModel.updateReview(
      reviewId,
      user.id,
      updates
    );
    if (!updatedReview) {
      throw new Error("Review not found or access denied");
    }

    return updatedReview;
  }

  static async deleteReview(
    user: User,
    reviewId: string
  ): Promise<{ message: string }> {
    if (user.role !== "customer") {
      throw new Error("Only customers can delete reviews");
    }

    const success = await CustomerModel.deleteReview(reviewId, user.id);
    if (!success) {
      throw new Error("Review not found or access denied");
    }

    return { message: "Review deleted successfully" };
  }

  static async getCustomerReviews(
    user: User,
    limit = 50,
    offset = 0
  ): Promise<ProductReview[]> {
    if (user.role !== "customer") {
      throw new Error("Only customers can view their reviews");
    }

    return await CustomerModel.getCustomerReviews(user.id, limit, offset);
  }

  // =============================================
  // WISHLIST MANAGEMENT
  // =============================================

  static async addToWishlist(
    user: User,
    productId: string
  ): Promise<{ message: string }> {
    if (user.role !== "customer") {
      throw new Error("Only customers can manage wishlists");
    }

    // Validate product exists and is active
    const product = await ProductModel.findById(productId);
    if (!product || product.status !== "active") {
      throw new Error("Product not found or not available");
    }

    await CustomerModel.addToWishlist(user.id, productId);
    return { message: "Product added to wishlist successfully" };
  }

  static async removeFromWishlist(
    user: User,
    productId: string
  ): Promise<{ message: string }> {
    if (user.role !== "customer") {
      throw new Error("Only customers can manage wishlists");
    }

    const success = await CustomerModel.removeFromWishlist(user.id, productId);
    if (!success) {
      throw new Error("Product not found in wishlist");
    }

    return { message: "Product removed from wishlist successfully" };
  }

  static async getWishlist(user: User): Promise<WishlistItem[]> {
    if (user.role !== "customer") {
      throw new Error("Only customers can view their wishlist");
    }

    return await CustomerModel.getWishlist(user.id);
  }

  static async isInWishlist(
    user: User,
    productId: string
  ): Promise<{ in_wishlist: boolean }> {
    if (user.role !== "customer") {
      return { in_wishlist: false };
    }

    const inWishlist = await CustomerModel.isInWishlist(user.id, productId);
    return { in_wishlist: inWishlist };
  }

  // =============================================
  // PRODUCT BROWSING (CUSTOMER VIEW)
  // =============================================

  static async getProducts(params: CustomerProductQueryParams = {}): Promise<{
    products: ProductWithReviews[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    // Validate pagination parameters
    if (params.page && params.page < 1) {
      throw new Error("Page number must be greater than 0");
    }

    if (params.limit && (params.limit < 1 || params.limit > 100)) {
      throw new Error("Limit must be between 1 and 100");
    }

    // Validate price range
    if (params.min_price && params.min_price < 0) {
      throw new Error("Minimum price cannot be negative");
    }

    if (params.max_price && params.max_price < 0) {
      throw new Error("Maximum price cannot be negative");
    }

    if (
      params.min_price &&
      params.max_price &&
      params.min_price > params.max_price
    ) {
      throw new Error("Minimum price cannot be greater than maximum price");
    }

    return await CustomerModel.getCustomerProducts(params);
  }

  static async getProductById(productId: string): Promise<ProductWithReviews> {
    const product = await CustomerModel.getCustomerProductById(productId);
    if (!product) {
      throw new Error("Product not found or not available");
    }

    return product;
  }

  static async getProductReviews(
    productId: string,
    limit = 20,
    offset = 0
  ): Promise<ProductReview[]> {
    // Validate product exists
    const product = await ProductModel.findById(productId);
    if (!product) {
      throw new Error("Product not found");
    }

    return await CustomerModel.getProductReviews(
      productId,
      true,
      limit,
      offset
    );
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  static async getCustomerProfile(user: User): Promise<{
    user: Partial<User>;
    addresses: CustomerAddress[];
    order_stats: CustomerOrderStats;
    recent_orders: OrderWithItems[];
    wishlist_count: number;
    cart_count: number;
  }> {
    if (user.role !== "customer") {
      throw new Error("Only customers can view customer profiles");
    }

    const [addresses, orderStats, recentOrders, wishlist, cart] =
      await Promise.all([
        CustomerModel.getCustomerAddresses(user.id),
        CustomerModel.getCustomerOrderStats(user.id),
        CustomerModel.getCustomerOrders(user.id, {
          limit: 5,
          sort_by: "created_at",
          sort_order: "desc",
        }),
        CustomerModel.getWishlist(user.id),
        CustomerModel.getCart(user.id),
      ]);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      addresses,
      order_stats: orderStats,
      recent_orders: recentOrders.orders,
      wishlist_count: wishlist.length,
      cart_count: cart.length,
    };
  }

  static async searchProducts(
    searchQuery: string,
    params: Omit<CustomerProductQueryParams, "search"> = {}
  ): Promise<{
    products: ProductWithReviews[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    search_query: string;
  }> {
    if (!searchQuery || searchQuery.trim().length < 2) {
      throw new Error("Search query must be at least 2 characters long");
    }

    if (searchQuery.length > 100) {
      throw new Error("Search query cannot exceed 100 characters");
    }

    const searchParams = {
      ...params,
      search: searchQuery.trim(),
    };

    const result = await CustomerModel.getCustomerProducts(searchParams);

    return {
      ...result,
      search_query: searchQuery.trim(),
    };
  }

  // Get categories for customer browsing
  static async getCategories(): Promise<any[]> {
    return await ProductModel.findAllCategories(true); // Only active categories
  }

  // Get featured products
  static async getFeaturedProducts(limit = 10): Promise<ProductWithReviews[]> {
    const result = await CustomerModel.getCustomerProducts({
      featured: true,
      limit,
      sort_by: "created_at",
      sort_order: "desc",
    });

    return result.products;
  }

  // Get related products (by category)
  static async getRelatedProducts(
    productId: string,
    limit = 8
  ): Promise<ProductWithReviews[]> {
    const product = await ProductModel.findById(productId);
    if (!product || !product.category_id) {
      return [];
    }

    const result = await CustomerModel.getCustomerProducts({
      category_id: product.category_id,
      limit: limit + 1, // Get one extra to exclude current product
      sort_by: "created_at",
      sort_order: "desc",
    });

    // Filter out the current product
    return result.products.filter((p) => p.id !== productId).slice(0, limit);
  }
}
