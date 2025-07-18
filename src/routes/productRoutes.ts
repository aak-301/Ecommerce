// src/routes/productRoutes.ts
import { Router } from "express";
import { ProductController } from "../controllers/ProductController";
import { CategoryController } from "../controllers/CategoryController";
import { CartController } from "../controllers/CartController";
import { OrderController } from "../controllers/OrderController";
import { authenticate, authorize } from "../middleware/auth";
import { authRateLimit } from "../middleware/rateLimit";
import {
  validateCreateProduct,
  validateUpdateProduct,
  validateProductSearch,
  validateCreateCategory,
  validateUpdateCategory,
  validateAddToCart,
  validateUpdateCartItem,
  validateCreateOrder,
  validateUpdateOrder,
} from "../middleware/product-validation";
import multer from "multer";
import path from "path";

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "products-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only Excel files are allowed"));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// =============================================
// PUBLIC ROUTES (No authentication required)
// =============================================

// Get featured products
router.get("/featured", ProductController.getFeaturedProducts);

// Search products (public catalog)
router.get("/search", validateProductSearch, ProductController.searchProducts);

// Get product by slug (public)
router.get("/slug/:slug", ProductController.getProductBySlug);

// Get product by ID (public)
router.get("/:id", ProductController.getProduct);

// Get similar products
router.get("/:id/similar", ProductController.getSimilarProducts);

// Get products by category
router.get("/category/:categoryId", ProductController.getProductsByCategory);

// Search products by tags
router.get("/tags/search", ProductController.searchByTags);

// Get all categories (public)
router.get("/categories", CategoryController.getCategories);

// Get category by slug
router.get("/categories/slug/:slug", CategoryController.getCategoryBySlug);

// Get category tree
router.get("/categories/tree", CategoryController.getCategoryTree);

// =============================================
// AUTHENTICATED ROUTES (Require login)
// =============================================

// Apply authentication to all routes below
router.use(authenticate);

// =============================================
// SHOPPING CART ROUTES (Customer only)
// =============================================

// Get user's cart
router.get("/cart", CartController.getCart);

// Get cart summary
router.get("/cart/summary", CartController.getCartSummary);

// Add item to cart
router.post(
  "/cart/items",
  authRateLimit,
  validateAddToCart,
  CartController.addItem
);

// Update cart item
router.put(
  "/cart/items/:itemId",
  validateUpdateCartItem,
  CartController.updateItem
);

// Remove item from cart
router.delete("/cart/items/:itemId", CartController.removeItem);

// Clear cart
router.delete("/cart/clear", CartController.clearCart);

// =============================================
// ORDER ROUTES (Customer access)
// =============================================

// Create order from cart
router.post(
  "/orders",
  authRateLimit,
  validateCreateOrder,
  OrderController.createOrder
);

// Get user's orders
router.get("/orders", OrderController.getUserOrders);

// Get order by ID
router.get("/orders/:id", OrderController.getOrder);

// Get order by order number
router.get("/orders/number/:orderNumber", OrderController.getOrderByNumber);

// Cancel order (user can cancel their own orders)
router.post("/orders/:id/cancel", authRateLimit, OrderController.cancelOrder);

// Get order statistics (user's own stats)
router.get("/orders/stats", OrderController.getOrderStats);

// Get recent orders (user's own orders)
router.get("/orders/recent", OrderController.getRecentOrders);

// =============================================
// ADMIN ROUTES (Admin and Super Admin only)
// =============================================

// Apply admin authorization to all routes below
router.use(authorize(["admin", "super_admin"]));

// =============================================
// PRODUCT MANAGEMENT (Admin/Super Admin)
// =============================================

// Create product
router.post(
  "/admin/products",
  authRateLimit,
  validateCreateProduct,
  ProductController.createProduct
);

// Update product
router.put(
  "/admin/products/:id",
  validateUpdateProduct,
  ProductController.updateProduct
);

// Delete product (soft delete)
router.delete("/admin/products/:id", ProductController.deleteProduct);

// Update product quantity
router.patch("/admin/products/:id/quantity", ProductController.updateQuantity);

// Bulk update quantities
router.patch(
  "/admin/products/quantities/bulk",
  ProductController.bulkUpdateQuantities
);

// Toggle featured status
router.patch("/admin/products/:id/featured", ProductController.toggleFeatured);

// Duplicate product
router.post(
  "/admin/products/:id/duplicate",
  ProductController.duplicateProduct
);

// Get low stock products
router.get(
  "/admin/products/inventory/low-stock",
  ProductController.getLowStockProducts
);

// Get out of stock products
router.get(
  "/admin/products/inventory/out-of-stock",
  ProductController.getOutOfStockProducts
);

// Get product statistics
router.get("/admin/products/stats", ProductController.getProductStats);

// Import products from Excel
router.post(
  "/admin/products/import",
  authRateLimit,
  upload.single("file"),
  ProductController.importProducts
);

// Export products to Excel
router.get("/admin/products/export", ProductController.exportProducts);

// Get import history
router.get(
  "/admin/products/imports/history",
  ProductController.getImportHistory
);

// =============================================
// CATEGORY MANAGEMENT (Admin/Super Admin)
// =============================================

// Create category
router.post(
  "/admin/categories",
  authRateLimit,
  validateCreateCategory,
  CategoryController.createCategory
);

// Update category
router.put(
  "/admin/categories/:id",
  validateUpdateCategory,
  CategoryController.updateCategory
);

// Delete category (soft delete)
router.delete("/admin/categories/:id", CategoryController.deleteCategory);

// Toggle category active status
router.patch(
  "/admin/categories/:id/toggle-active",
  CategoryController.toggleActive
);

// Update category sort order
router.patch(
  "/admin/categories/:id/sort-order",
  CategoryController.updateSortOrder
);

// Bulk update sort orders
router.patch(
  "/admin/categories/sort-orders/bulk",
  CategoryController.bulkUpdateSortOrders
);

// Move category to different parent
router.patch("/admin/categories/:id/move", CategoryController.moveCategory);

// Get categories with product counts
router.get(
  "/admin/categories/with-counts",
  CategoryController.getCategoriesWithCounts
);

// Get popular categories
router.get(
  "/admin/categories/popular",
  CategoryController.getPopularCategories
);

// =============================================
// ORDER MANAGEMENT (Admin/Super Admin)
// =============================================

// Search all orders
router.get("/admin/orders/search", OrderController.searchOrders);

// Update order status
router.put(
  "/admin/orders/:id",
  validateUpdateOrder,
  OrderController.updateOrderStatus
);

// Get all order statistics
router.get("/admin/orders/stats", OrderController.getOrderStats);

// Get recent orders (all orders)
router.get("/admin/orders/recent", OrderController.getRecentOrders);

// Get top selling products
router.get("/admin/orders/top-products", OrderController.getTopSellingProducts);

// Cancel any order (admin action)
router.post(
  "/admin/orders/:id/cancel",
  authRateLimit,
  OrderController.cancelOrder
);

// =============================================
// SUPER ADMIN ROUTES (Super Admin only)
// =============================================

// Apply super admin authorization to all routes below
router.use(authorize(["super_admin"]));

// Restore deleted product
router.post(
  "/super-admin/products/:id/restore",
  ProductController.restoreProduct
);

// Restore deleted category
router.post(
  "/super-admin/categories/:id/restore",
  CategoryController.restoreCategory
);

// Hard delete product (permanent deletion)
router.delete(
  "/super-admin/products/:id/hard-delete",
  ProductController.hardDeleteProduct
);

// Hard delete category (permanent deletion)
router.delete(
  "/super-admin/categories/:id/hard-delete",
  CategoryController.hardDeleteCategory
);

// Get deleted products
router.get(
  "/super-admin/products/deleted",
  ProductController.getDeletedProducts
);

// Get deleted categories
router.get(
  "/super-admin/categories/deleted",
  CategoryController.getDeletedCategories
);

// System maintenance routes
router.post(
  "/super-admin/maintenance/cleanup-carts",
  CartController.cleanupExpiredCarts
);
router.post(
  "/super-admin/maintenance/recalculate-inventory",
  ProductController.recalculateInventory
);

export default router;
