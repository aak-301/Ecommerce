// src/routes/customerRoutes.ts
import { Router } from "express";
import { CustomerController } from "../controllers/CustomerController";
import { authenticate, authorize } from "../middleware/auth";
import {
  validateCreateAddress,
  validateUpdateAddress,
  validateAddToCart,
  validateUpdateCartItem,
  validatePlaceOrder,
  validateCreateReview,
  validateUpdateReview,
  validateCancelOrder,
  validateIdParam,
  validateCustomerProductQuery,
  validateCustomerOrderQuery,
  validateSearchQuery,
} from "../middleware/customer-validation";
import { authRateLimit } from "../middleware/rateLimit";

const router = Router();

// =============================================
// PUBLIC ROUTES (No authentication required)
// =============================================

// Product browsing (available to all users)
router.get(
  "/products",
  validateCustomerProductQuery,
  CustomerController.getProducts
);
router.get(
  "/products/search",
  validateSearchQuery,
  CustomerController.searchProducts
);
router.get("/products/featured", CustomerController.getFeaturedProducts);
router.get(
  "/products/:productId",
  validateIdParam,
  CustomerController.getProductById
);
router.get(
  "/products/:productId/reviews",
  validateIdParam,
  CustomerController.getProductReviews
);
router.get(
  "/products/:productId/related",
  validateIdParam,
  CustomerController.getRelatedProducts
);

// Categories (public access)
router.get("/categories", CustomerController.getCategories);

// =============================================
// CUSTOMER ONLY ROUTES (Authentication required)
// =============================================

// All routes below require customer authentication
router.use(authenticate);
router.use(authorize(["customer"]));

// =============================================
// CUSTOMER PROFILE
// =============================================

// Get customer profile with summary
router.get("/profile", CustomerController.getProfile);

// =============================================
// ADDRESS MANAGEMENT
// =============================================

// Create new address
router.post(
  "/addresses",
  authRateLimit,
  validateCreateAddress,
  CustomerController.createAddress
);

// Get all customer addresses
router.get("/addresses", CustomerController.getAddresses);

// Update address
router.put(
  "/addresses/:id",
  authRateLimit,
  validateIdParam,
  validateUpdateAddress,
  CustomerController.updateAddress
);

// Delete address
router.delete(
  "/addresses/:id",
  authRateLimit,
  validateIdParam,
  CustomerController.deleteAddress
);

// =============================================
// SHOPPING CART MANAGEMENT
// =============================================

// Add item to cart
router.post(
  "/cart/add",
  authRateLimit,
  validateAddToCart,
  CustomerController.addToCart
);

// Get cart contents with summary
router.get("/cart", CustomerController.getCart);

// Update cart item quantity
router.put(
  "/cart/items/:productId",
  authRateLimit,
  validateIdParam,
  validateUpdateCartItem,
  CustomerController.updateCartItem
);

// Remove item from cart
router.delete(
  "/cart/items/:productId",
  authRateLimit,
  validateIdParam,
  CustomerController.removeFromCart
);

// Clear entire cart
router.delete("/cart/clear", authRateLimit, CustomerController.clearCart);

// =============================================
// ORDER MANAGEMENT
// =============================================

// Place new order
router.post(
  "/orders",
  authRateLimit,
  validatePlaceOrder,
  CustomerController.placeOrder
);

// Get customer orders with filtering
router.get("/orders", validateCustomerOrderQuery, CustomerController.getOrders);

// Get specific order details
router.get(
  "/orders/:orderId",
  validateIdParam,
  CustomerController.getOrderById
);

// Cancel order
router.patch(
  "/orders/:orderId/cancel",
  authRateLimit,
  validateIdParam,
  validateCancelOrder,
  CustomerController.cancelOrder
);

// Get order statistics
router.get("/orders/stats/summary", CustomerController.getOrderStats);

// =============================================
// PRODUCT REVIEWS
// =============================================

// Create product review
router.post(
  "/reviews",
  authRateLimit,
  validateCreateReview,
  CustomerController.createReview
);

// Get customer's reviews
router.get("/reviews", CustomerController.getMyReviews);

// Update review
router.put(
  "/reviews/:reviewId",
  authRateLimit,
  validateIdParam,
  validateUpdateReview,
  CustomerController.updateReview
);

// Delete review
router.delete(
  "/reviews/:reviewId",
  authRateLimit,
  validateIdParam,
  CustomerController.deleteReview
);

// =============================================
// WISHLIST MANAGEMENT
// =============================================

// Add product to wishlist
router.post(
  "/wishlist/:productId",
  authRateLimit,
  validateIdParam,
  CustomerController.addToWishlist
);

// Get customer wishlist
router.get("/wishlist", CustomerController.getWishlist);

// Remove product from wishlist
router.delete(
  "/wishlist/:productId",
  authRateLimit,
  validateIdParam,
  CustomerController.removeFromWishlist
);

// Check if product is in wishlist
router.get(
  "/wishlist/:productId/status",
  validateIdParam,
  CustomerController.checkWishlistStatus
);

export default router;
