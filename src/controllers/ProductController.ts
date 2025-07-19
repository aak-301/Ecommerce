// src/controllers/ProductController.ts
import { Request, Response } from "express";
import { ProductService } from "../services/ProductService";
import { sendResponse } from "../utils/response";
import { User } from "../types";
import { ProductQueryParams } from "../types/product";

interface AuthRequest extends Request {
  user?: User;
}

export class ProductController {
  // =============================================
  // PRODUCT CRUD OPERATIONS
  // =============================================

  static async createProduct(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const product = await ProductService.createProduct(req.body, req.user);

      sendResponse(res, 201, true, "Product created successfully", {
        product: {
          id: product.id,
          name: product.name,
          sku: product.sku,
          slug: product.slug,
          price: product.price,
          quantity: product.quantity,
          status: product.status,
          created_at: product.created_at,
        },
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

  static async getProduct(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;
      const product = await ProductService.getProductById(id, req.user);

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
        400,
        false,
        "Failed to retrieve product",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

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
        req.user
      );

      sendResponse(res, 200, true, "Product updated successfully", {
        product: {
          id: product.id,
          name: product.name,
          sku: product.sku,
          price: product.price,
          quantity: product.quantity,
          status: product.status,
          updated_at: product.updated_at,
        },
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

  static async deleteProduct(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;
      const result = await ProductService.deleteProduct(id, req.user);

      sendResponse(res, 200, true, result.message, {
        deleted_at: new Date().toISOString(),
        deleted_by: {
          id: req.user.id,
          name: req.user.name,
        },
      });
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

  static async getAllProducts(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const queryParams: ProductQueryParams = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
        search: req.query.search as string,
        category_id: req.query.category_id as string,
        status: req.query.status as any,
        is_featured: req.query.is_featured === "true",
        min_price: req.query.min_price
          ? parseFloat(req.query.min_price as string)
          : undefined,
        max_price: req.query.max_price
          ? parseFloat(req.query.max_price as string)
          : undefined,
        in_stock: req.query.in_stock === "true",
        low_stock: req.query.low_stock === "true",
        sort_by: (req.query.sort_by as any) || "created_at",
        sort_order: (req.query.sort_order as any) || "desc",
      };

      const result = await ProductService.getAllProducts(queryParams, req.user);

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
      console.error("Get all products error:", error);
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

  // =============================================
  // INVENTORY MANAGEMENT
  // =============================================

  static async updateInventory(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const result = await ProductService.updateInventory(req.body, req.user);

      sendResponse(res, 200, true, result.message, {
        updated_at: new Date().toISOString(),
        updated_by: {
          id: req.user.id,
          name: req.user.name,
        },
      });
    } catch (error) {
      console.error("Update inventory error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to update inventory",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  static async bulkUpdateInventory(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const result = await ProductService.bulkUpdateInventory(
        req.body,
        req.user
      );

      sendResponse(res, 200, true, result.message, {
        successful: result.successful,
        failed: result.failed,
        total: result.successful + result.failed,
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Bulk update inventory error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to bulk update inventory",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  static async getLowStockProducts(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const products = await ProductService.getLowStockProducts(req.user);

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

  static async getProductStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const stats = await ProductService.getProductStats(req.user);

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

  // =============================================
  // BULK OPERATIONS
  // =============================================

  static async bulkCreateProducts(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const result = await ProductService.bulkCreateProducts(
        req.body,
        req.user
      );

      const statusCode = result.failed > 0 ? 207 : 201; // 207 Multi-Status for partial success

      sendResponse(res, statusCode, true, "Bulk product creation completed", {
        successful: result.successful,
        failed: result.failed,
        total: result.total,
        errors: result.errors,
        created_products: result.created_products?.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          price: p.price,
        })),
      });
    } catch (error) {
      console.error("Bulk create products error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to bulk create products",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // =============================================
  // EXCEL IMPORT/EXPORT
  // =============================================

  static async importProductsFromExcel(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      if (!req.file) {
        sendResponse(res, 400, false, "Excel file is required");
        return;
      }

      const result = await ProductService.importFromExcel(req.file, req.user);

      const statusCode = result.status === "partial" ? 207 : 200;

      sendResponse(res, statusCode, true, "Excel import completed", {
        import_id: result.import_id,
        status: result.status,
        total_rows: result.total_rows,
        successful_rows: result.successful_rows,
        failed_rows: result.failed_rows,
        errors: result.errors?.slice(0, 10), // Limit errors shown to first 10
      });
    } catch (error) {
      console.error("Import products from Excel error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to import products from Excel",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  static async importInventoryFromExcel(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      if (!req.file) {
        sendResponse(res, 400, false, "Excel file is required");
        return;
      }

      const result = await ProductService.importInventoryFromExcel(
        req.file,
        req.user
      );

      const statusCode = result.status === "partial" ? 207 : 200;

      sendResponse(res, statusCode, true, "Inventory import completed", {
        import_id: result.import_id,
        status: result.status,
        total_rows: result.total_rows,
        successful_rows: result.successful_rows,
        failed_rows: result.failed_rows,
        errors: result.errors?.slice(0, 10),
      });
    } catch (error) {
      console.error("Import inventory from Excel error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to import inventory from Excel",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  static async downloadProductTemplate(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const buffer = ProductService.generateProductExcelTemplate();

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=product_import_template.xlsx"
      );
      res.send(buffer);
    } catch (error) {
      console.error("Download product template error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to generate template",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  static async downloadInventoryTemplate(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const buffer = ProductService.generateInventoryExcelTemplate();

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=inventory_import_template.xlsx"
      );
      res.send(buffer);
    } catch (error) {
      console.error("Download inventory template error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to generate template",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // =============================================
  // CATEGORY MANAGEMENT
  // =============================================

  static async createCategory(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const category = await ProductService.createCategory(req.body, req.user);

      sendResponse(res, 201, true, "Category created successfully", {
        category: {
          id: category.id,
          name: category.name,
          slug: category.slug,
          is_active: category.is_active,
          created_at: category.created_at,
        },
      });
    } catch (error) {
      console.error("Create category error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to create category",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  static async updateCategory(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;
      const category = await ProductService.updateCategory(
        id,
        req.body,
        req.user
      );

      sendResponse(res, 200, true, "Category updated successfully", {
        category: {
          id: category.id,
          name: category.name,
          slug: category.slug,
          is_active: category.is_active,
          updated_at: category.updated_at,
        },
      });
    } catch (error) {
      console.error("Update category error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to update category",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  static async deleteCategory(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;
      const result = await ProductService.deleteCategory(id, req.user);

      sendResponse(res, 200, true, result.message);
    } catch (error) {
      console.error("Delete category error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to delete category",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  static async getAllCategories(req: Request, res: Response): Promise<void> {
    try {
      const activeOnly = req.query.active_only !== "false";
      const categories = await ProductService.getAllCategories(activeOnly);

      sendResponse(res, 200, true, "Categories retrieved successfully", {
        categories,
        count: categories.length,
      });
    } catch (error) {
      console.error("Get all categories error:", error);
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

  static async getCategory(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const category = await ProductService.getCategoryById(id);

      if (!category) {
        sendResponse(res, 404, false, "Category not found");
        return;
      }

      sendResponse(res, 200, true, "Category retrieved successfully", {
        category,
      });
    } catch (error) {
      console.error("Get category error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve category",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // =============================================
  // SUPER ADMIN ONLY OPERATIONS
  // =============================================

  static async restoreProduct(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;
      const result = await ProductService.restoreProduct(id, req.user);

      sendResponse(res, 200, true, result.message, {
        restored_at: new Date().toISOString(),
        restored_by: {
          id: req.user.id,
          name: req.user.name,
        },
      });
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

  static async hardDeleteProduct(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;
      const result = await ProductService.hardDeleteProduct(id, req.user);

      sendResponse(res, 200, true, result.message, {
        permanently_deleted_at: new Date().toISOString(),
        deleted_by: {
          id: req.user.id,
          name: req.user.name,
        },
      });
    } catch (error) {
      console.error("Hard delete product error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to permanently delete product",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  static async assignProductToUser(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;
      const { target_user_id } = req.body;

      if (!target_user_id) {
        sendResponse(res, 400, false, "Target user ID is required");
        return;
      }

      const product = await ProductService.assignProductToUser(
        id,
        target_user_id,
        req.user
      );

      sendResponse(res, 200, true, "Product assigned to user successfully", {
        product: {
          id: product.id,
          name: product.name,
          sku: product.sku,
          created_by: product.created_by,
        },
        assigned_at: new Date().toISOString(),
        assigned_by: {
          id: req.user.id,
          name: req.user.name,
        },
      });
    } catch (error) {
      console.error("Assign product to user error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to assign product to user",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
}
