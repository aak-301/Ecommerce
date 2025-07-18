// src/controllers/ProductController.ts
import { Request, Response } from "express";
import { ProductService } from "../services/ProductService";
import { sendResponse } from "../utils/response";
import { User } from "../types";
import { ProductSearchParams } from "../types/product";

interface AuthRequest extends Request {
  user?: User;
}

export class ProductController {
  // Create a new product (Admin/Super Admin)
  static async createProduct(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const product = await ProductService.createProduct(req.body, req.user.id);

      sendResponse(res, 201, true, "Product created successfully", {
        product,
      });
    } catch (error) {
      console.error("Create product error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to create product",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Update a product (Admin/Super Admin)
  static async updateProduct(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;
      const product = await ProductService.updateProduct(
        id,
        req.body,
        req.user.id
      );

      if (!product) {
        sendResponse(res, 404, false, "Product not found");
        return;
      }

      sendResponse(res, 200, true, "Product updated successfully", {
        product,
      });
    } catch (error) {
      console.error("Update product error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to update product",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get product by ID
  static async getProduct(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const product = await ProductService.getProductById(id);

      if (!product) {
        sendResponse(res, 404, false, "Product not found");
        return;
      }

      sendResponse(res, 200, true, "Product retrieved successfully", {
        product,
      });
    } catch (error) {
      console.error("Get product error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve product",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get product by slug (for public access)
  static async getProductBySlug(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      const product = await ProductService.getProductBySlug(slug);

      if (!product) {
        sendResponse(res, 404, false, "Product not found");
        return;
      }

      sendResponse(res, 200, true, "Product retrieved successfully", {
        product,
      });
    } catch (error) {
      console.error("Get product by slug error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve product",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Search/list products with filters
  static async searchProducts(req: Request, res: Response): Promise<void> {
    try {
      const searchParams: ProductSearchParams = {
        search: req.query.search as string,
        category_id: req.query.category_id as string,
        status: req.query.status as any,
        visibility: req.query.visibility as any,
        featured: req.query.featured === "true",
        min_price: req.query.min_price
          ? parseFloat(req.query.min_price as string)
          : undefined,
        max_price: req.query.max_price
          ? parseFloat(req.query.max_price as string)
          : undefined,
        in_stock: req.query.in_stock === "true",
        low_stock: req.query.low_stock === "true",
        tags: req.query.tags
          ? (req.query.tags as string).split(",")
          : undefined,
        sort_by: (req.query.sort_by as any) || "created_at",
        sort_order: (req.query.sort_order as any) || "desc",
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      const result = await ProductService.searchProducts(searchParams);

      sendResponse(res, 200, true, "Products retrieved successfully", {
        products: result.data,
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
          has_more: result.has_more,
        },
      });
    } catch (error) {
      console.error("Search products error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to search products",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Delete product (Admin/Super Admin)
  static async deleteProduct(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;
      const success = await ProductService.deleteProduct(id, req.user.id);

      if (!success) {
        sendResponse(res, 404, false, "Product not found");
        return;
      }

      sendResponse(res, 200, true, "Product deleted successfully");
    } catch (error) {
      console.error("Delete product error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to delete product",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Restore deleted product (Super Admin)
  static async restoreProduct(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;
      const success = await ProductService.restoreProduct(id);

      if (!success) {
        sendResponse(res, 404, false, "Product not found or not deleted");
        return;
      }

      sendResponse(res, 200, true, "Product restored successfully");
    } catch (error) {
      console.error("Restore product error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to restore product",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get featured products (Public)
  static async getFeaturedProducts(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const products = await ProductService.getFeaturedProducts(limit);

      sendResponse(res, 200, true, "Featured products retrieved successfully", {
        products,
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

  // Get products by category (Public)
  static async getProductsByCategory(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { categoryId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const offset = req.query.offset
        ? parseInt(req.query.offset as string)
        : 0;

      const result = await ProductService.getProductsByCategory(
        categoryId,
        limit,
        offset
      );

      sendResponse(res, 200, true, "Products retrieved successfully", {
        products: result.data,
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
          has_more: result.has_more,
        },
      });
    } catch (error) {
      console.error("Get products by category error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve products",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get similar products (Public)
  static async getSimilarProducts(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      const products = await ProductService.getSimilarProducts(id, limit);

      sendResponse(res, 200, true, "Similar products retrieved successfully", {
        products,
      });
    } catch (error) {
      console.error("Get similar products error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve similar products",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Update product quantity (Admin/Super Admin)
  static async updateQuantity(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;
      const { quantity } = req.body;

      if (typeof quantity !== "number" || quantity < 0) {
        sendResponse(res, 400, false, "Invalid quantity value");
        return;
      }

      const product = await ProductService.updateProductQuantity(
        id,
        quantity,
        req.user.id
      );

      if (!product) {
        sendResponse(res, 404, false, "Product not found");
        return;
      }

      sendResponse(res, 200, true, "Product quantity updated successfully", {
        product: {
          id: product.id,
          name: product.name,
          sku: product.sku,
          quantity: product.quantity,
        },
      });
    } catch (error) {
      console.error("Update quantity error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to update product quantity",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Bulk update quantities (Admin/Super Admin)
  static async bulkUpdateQuantities(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { updates } = req.body;

      if (!Array.isArray(updates)) {
        sendResponse(res, 400, false, "Updates must be an array");
        return;
      }

      await ProductService.bulkUpdateQuantities(updates, req.user.id);

      sendResponse(res, 200, true, "Product quantities updated successfully", {
        updated_count: updates.length,
      });
    } catch (error) {
      console.error("Bulk update quantities error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to update product quantities",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get low stock products (Admin/Super Admin)
  static async getLowStockProducts(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const products = await ProductService.getLowStockProducts(limit);

      sendResponse(
        res,
        200,
        true,
        "Low stock products retrieved successfully",
        {
          products,
          count: products.length,
        }
      );
    } catch (error) {
      console.error("Get low stock products error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve low stock products",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get out of stock products (Admin/Super Admin)
  static async getOutOfStockProducts(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const products = await ProductService.getOutOfStockProducts(limit);

      sendResponse(
        res,
        200,
        true,
        "Out of stock products retrieved successfully",
        {
          products,
          count: products.length,
        }
      );
    } catch (error) {
      console.error("Get out of stock products error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve out of stock products",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get product statistics (Admin/Super Admin)
  static async getProductStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const stats = await ProductService.getProductStats();

      sendResponse(
        res,
        200,
        true,
        "Product statistics retrieved successfully",
        {
          stats,
        }
      );
    } catch (error) {
      console.error("Get product stats error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve product statistics",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Import products from Excel (Admin/Super Admin)
  static async importProducts(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      if (!req.file) {
        sendResponse(res, 400, false, "No file uploaded");
        return;
      }

      const result = await ProductService.importProductsFromExcel(
        req.file,
        req.user.id
      );

      sendResponse(res, 200, true, "Products import completed", {
        import_result: result,
      });
    } catch (error) {
      console.error("Import products error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to import products",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Export products to Excel (Admin/Super Admin)
  static async exportProducts(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const searchParams: ProductSearchParams = {
        status: req.query.status as any,
        category_id: req.query.category_id as string,
        featured: req.query.featured === "true",
        in_stock: req.query.in_stock === "true",
        low_stock: req.query.low_stock === "true",
      };

      const buffer = await ProductService.exportProductsToExcel(searchParams);

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=products-export-${
          new Date().toISOString().split("T")[0]
        }.xlsx`
      );
      res.send(buffer);
    } catch (error) {
      console.error("Export products error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to export products",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get import history (Admin/Super Admin)
  static async getImportHistory(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const offset = req.query.offset
        ? parseInt(req.query.offset as string)
        : 0;

      const history = await ProductService.getImportHistory(limit, offset);

      sendResponse(res, 200, true, "Import history retrieved successfully", {
        imports: history,
        pagination: {
          limit,
          offset,
          has_more: history.length === limit,
        },
      });
    } catch (error) {
      console.error("Get import history error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve import history",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Search products by tags (Public)
  static async searchByTags(req: Request, res: Response): Promise<void> {
    try {
      const { tags } = req.query;

      if (!tags || typeof tags !== "string") {
        sendResponse(res, 400, false, "Tags parameter is required");
        return;
      }

      const tagArray = tags.split(",").map((tag) => tag.trim());
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

      const products = await ProductService.searchProductsByTags(
        tagArray,
        limit
      );

      sendResponse(res, 200, true, "Products retrieved successfully", {
        products,
        tags: tagArray,
      });
    } catch (error) {
      console.error("Search by tags error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to search products by tags",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Toggle product featured status (Admin/Super Admin)
  static async toggleFeatured(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;
      const product = await ProductService.toggleProductFeatured(
        id,
        req.user.id
      );

      if (!product) {
        sendResponse(res, 404, false, "Product not found");
        return;
      }

      sendResponse(
        res,
        200,
        true,
        "Product featured status updated successfully",
        {
          product: {
            id: product.id,
            name: product.name,
            featured: product.featured,
          },
        }
      );
    } catch (error) {
      console.error("Toggle featured error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to update product featured status",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Duplicate product (Admin/Super Admin)
  static async duplicateProduct(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;
      const { name } = req.body;

      const product = await ProductService.duplicateProduct(
        id,
        name,
        req.user.id
      );

      sendResponse(res, 201, true, "Product duplicated successfully", {
        product,
      });
    } catch (error) {
      console.error("Duplicate product error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to duplicate product",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
}
