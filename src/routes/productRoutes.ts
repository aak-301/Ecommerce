// src/routes/productRoutes.ts
import { Router } from "express";
import { ProductController } from "../controllers/ProductController";
import { authenticate, authorize } from "../middleware/auth";
import {
  validateCreateProduct,
  validateUpdateProduct,
  validateProductQuery,
  validateInventoryUpdate,
  validateBulkInventoryUpdate,
  validateCreateCategory,
  validateUpdateCategory,
  validateBulkCreateProducts,
  validateIdParam,
  validateAssignProduct,
  validateFileUpload,
} from "../middleware/product-validation";
import { authRateLimit } from "../middleware/rateLimit";
import multer from "multer";

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// =============================================
// PUBLIC ROUTES (No authentication required)
// =============================================

// Get all categories (public access for frontend)
router.get("/categories", ProductController.getAllCategories);

// Get specific category
router.get("/categories/:id", validateIdParam, ProductController.getCategory);

// Download Excel templates
router.get("/templates/products", ProductController.downloadProductTemplate);
router.get("/templates/inventory", ProductController.downloadInventoryTemplate);

// =============================================
// AUTHENTICATED ROUTES
// =============================================

// All routes below require authentication
router.use(authenticate);

// =============================================
// PRODUCT MANAGEMENT (Admin + Super Admin)
// =============================================

// Get all products (with filtering and pagination)
router.get(
  "/",
  authorize(["admin", "super_admin"]),
  validateProductQuery,
  ProductController.getAllProducts
);

// Get specific product
router.get(
  "/:id",
  authorize(["admin", "super_admin"]),
  validateIdParam,
  ProductController.getProduct
);

// Create new product
router.post(
  "/",
  authorize(["admin", "super_admin"]),
  authRateLimit,
  validateCreateProduct,
  ProductController.createProduct
);

// Update product
router.put(
  "/:id",
  authorize(["admin", "super_admin"]),
  authRateLimit,
  validateIdParam,
  validateUpdateProduct,
  ProductController.updateProduct
);

// Soft delete product
router.delete(
  "/:id",
  authorize(["admin", "super_admin"]),
  authRateLimit,
  validateIdParam,
  ProductController.deleteProduct
);

// =============================================
// INVENTORY MANAGEMENT (Admin + Super Admin)
// =============================================

// Update single product inventory
router.patch(
  "/inventory/update",
  authorize(["admin", "super_admin"]),
  authRateLimit,
  validateInventoryUpdate,
  ProductController.updateInventory
);

// Bulk update inventory
router.patch(
  "/inventory/bulk-update",
  authorize(["admin", "super_admin"]),
  authRateLimit,
  validateBulkInventoryUpdate,
  ProductController.bulkUpdateInventory
);

// Get low stock products
router.get(
  "/inventory/low-stock",
  authorize(["admin", "super_admin"]),
  ProductController.getLowStockProducts
);

// Get product statistics
router.get(
  "/stats/overview",
  authorize(["admin", "super_admin"]),
  ProductController.getProductStats
);

// =============================================
// BULK OPERATIONS (Admin + Super Admin)
// =============================================

// Bulk create products
router.post(
  "/bulk/create",
  authorize(["admin", "super_admin"]),
  authRateLimit,
  validateBulkCreateProducts,
  ProductController.bulkCreateProducts
);

// =============================================
// EXCEL IMPORT/EXPORT (Admin + Super Admin)
// =============================================

// Import products from Excel
router.post(
  "/import/products",
  authorize(["admin", "super_admin"]),
  authRateLimit,
  upload.single("file"),
  validateFileUpload,
  ProductController.importProductsFromExcel
);

// Import inventory updates from Excel
router.post(
  "/import/inventory",
  authorize(["admin", "super_admin"]),
  authRateLimit,
  upload.single("file"),
  validateFileUpload,
  ProductController.importInventoryFromExcel
);

// =============================================
// CATEGORY MANAGEMENT (Admin + Super Admin)
// =============================================

// Create category
router.post(
  "/categories",
  authorize(["admin", "super_admin"]),
  authRateLimit,
  validateCreateCategory,
  ProductController.createCategory
);

// Update category
router.put(
  "/categories/:id",
  authorize(["admin", "super_admin"]),
  authRateLimit,
  validateIdParam,
  validateUpdateCategory,
  ProductController.updateCategory
);

// Delete category
router.delete(
  "/categories/:id",
  authorize(["admin", "super_admin"]),
  authRateLimit,
  validateIdParam,
  ProductController.deleteCategory
);

// =============================================
// SUPER ADMIN ONLY ROUTES
// =============================================

// Restore soft-deleted product
router.patch(
  "/admin/restore/:id",
  authorize(["super_admin"]),
  authRateLimit,
  validateIdParam,
  ProductController.restoreProduct
);

// Permanently delete product
router.delete(
  "/admin/hard-delete/:id",
  authorize(["super_admin"]),
  authRateLimit,
  validateIdParam,
  ProductController.hardDeleteProduct
);

// Assign product to user (for selling/transferring products)
router.patch(
  "/admin/assign/:id",
  authorize(["super_admin"]),
  authRateLimit,
  validateIdParam,
  validateAssignProduct,
  ProductController.assignProductToUser
);

export default router;
