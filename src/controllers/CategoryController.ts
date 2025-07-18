// src/controllers/CategoryController.ts
import { Request, Response } from "express";
import { CategoryService } from "../services/CategoryService";
import { sendResponse } from "../utils/response";
import { User } from "../types";

interface AuthRequest extends Request {
  user?: User;
}

export class CategoryController {
  // Create a new category (Admin/Super Admin)
  static async createCategory(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const category = await CategoryService.createCategory(
        req.body,
        req.user.id
      );

      sendResponse(res, 201, true, "Category created successfully", {
        category,
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

  // Update a category (Admin/Super Admin)
  static async updateCategory(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;
      const category = await CategoryService.updateCategory(id, req.body);

      if (!category) {
        sendResponse(res, 404, false, "Category not found");
        return;
      }

      sendResponse(res, 200, true, "Category updated successfully", {
        category,
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

  // Get category by ID (Public)
  static async getCategory(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const category = await CategoryService.getCategoryById(id);

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

  // Get category by slug (Public)
  static async getCategoryBySlug(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      const category = await CategoryService.getCategoryBySlug(slug);

      if (!category) {
        sendResponse(res, 404, false, "Category not found");
        return;
      }

      sendResponse(res, 200, true, "Category retrieved successfully", {
        category,
      });
    } catch (error) {
      console.error("Get category by slug error:", error);
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

  // Get all categories (Public)
  static async getCategories(req: Request, res: Response): Promise<void> {
    try {
      const includeInactive = req.query.include_inactive === "true";
      const categories = await CategoryService.getAllCategories(
        includeInactive
      );

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

  // Get category tree (Public)
  static async getCategoryTree(req: Request, res: Response): Promise<void> {
    try {
      const tree = await CategoryService.getCategoryTree();

      sendResponse(res, 200, true, "Category tree retrieved successfully", {
        category_tree: tree,
        count: tree.length,
      });
    } catch (error) {
      console.error("Get category tree error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve category tree",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get root categories (Public)
  static async getRootCategories(req: Request, res: Response): Promise<void> {
    try {
      const categories = await CategoryService.getRootCategories();

      sendResponse(res, 200, true, "Root categories retrieved successfully", {
        categories,
        count: categories.length,
      });
    } catch (error) {
      console.error("Get root categories error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve root categories",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get subcategories (Public)
  static async getSubcategories(req: Request, res: Response): Promise<void> {
    try {
      const { parentId } = req.params;
      const categories = await CategoryService.getSubcategories(parentId);

      sendResponse(res, 200, true, "Subcategories retrieved successfully", {
        categories,
        parent_id: parentId,
        count: categories.length,
      });
    } catch (error) {
      console.error("Get subcategories error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve subcategories",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Search categories (Public)
  static async searchCategories(req: Request, res: Response): Promise<void> {
    try {
      const { search } = req.query;

      if (!search || typeof search !== "string") {
        sendResponse(res, 400, false, "Search term is required");
        return;
      }

      const includeInactive = req.query.include_inactive === "true";
      const categories = await CategoryService.searchCategories(
        search,
        includeInactive
      );

      sendResponse(res, 200, true, "Categories search completed", {
        categories,
        search_term: search,
        count: categories.length,
      });
    } catch (error) {
      console.error("Search categories error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to search categories",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Delete category (Admin/Super Admin)
  static async deleteCategory(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;
      const success = await CategoryService.deleteCategory(id, req.user.id);

      if (!success) {
        sendResponse(
          res,
          404,
          false,
          "Category not found or cannot be deleted"
        );
        return;
      }

      sendResponse(res, 200, true, "Category deleted successfully");
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

  // Restore deleted category (Super Admin)
  static async restoreCategory(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;
      const success = await CategoryService.restoreCategory(id);

      if (!success) {
        sendResponse(res, 404, false, "Category not found or not deleted");
        return;
      }

      sendResponse(res, 200, true, "Category restored successfully");
    } catch (error) {
      console.error("Restore category error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to restore category",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Toggle category active status (Admin/Super Admin)
  static async toggleActive(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;
      const category = await CategoryService.toggleCategoryActive(id);

      if (!category) {
        sendResponse(res, 404, false, "Category not found");
        return;
      }

      const status = category.is_active ? "activated" : "deactivated";
      sendResponse(res, 200, true, `Category ${status} successfully`, {
        category: {
          id: category.id,
          name: category.name,
          is_active: category.is_active,
        },
      });
    } catch (error) {
      console.error("Toggle category active error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to toggle category status",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Update category sort order (Admin/Super Admin)
  static async updateSortOrder(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;
      const { sort_order } = req.body;

      if (typeof sort_order !== "number" || sort_order < 0) {
        sendResponse(res, 400, false, "Valid sort order is required");
        return;
      }

      const category = await CategoryService.updateCategorySortOrder(
        id,
        sort_order
      );

      if (!category) {
        sendResponse(res, 404, false, "Category not found");
        return;
      }

      sendResponse(res, 200, true, "Category sort order updated successfully", {
        category: {
          id: category.id,
          name: category.name,
          sort_order: category.sort_order,
        },
      });
    } catch (error) {
      console.error("Update category sort order error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to update category sort order",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Bulk update sort orders (Admin/Super Admin)
  static async bulkUpdateSortOrders(
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

      await CategoryService.bulkUpdateSortOrders(updates);

      sendResponse(
        res,
        200,
        true,
        "Category sort orders updated successfully",
        {
          updated_count: updates.length,
        }
      );
    } catch (error) {
      console.error("Bulk update sort orders error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to update category sort orders",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Move category to different parent (Admin/Super Admin)
  static async moveCategory(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const { id } = req.params;
      const { parent_id } = req.body;

      const category = await CategoryService.moveCategory(id, parent_id);

      if (!category) {
        sendResponse(res, 404, false, "Category not found");
        return;
      }

      sendResponse(res, 200, true, "Category moved successfully", {
        category: {
          id: category.id,
          name: category.name,
          parent_id: category.parent_id,
        },
      });
    } catch (error) {
      console.error("Move category error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to move category",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get categories with product counts (Admin/Super Admin)
  static async getCategoriesWithCounts(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const categories = await CategoryService.getCategoriesWithProductCounts();

      sendResponse(
        res,
        200,
        true,
        "Categories with counts retrieved successfully",
        {
          categories,
          count: categories.length,
        }
      );
    } catch (error) {
      console.error("Get categories with counts error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve categories with counts",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get popular categories (Admin/Super Admin)
  static async getPopularCategories(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const categories = await CategoryService.getPopularCategories(limit);

      sendResponse(
        res,
        200,
        true,
        "Popular categories retrieved successfully",
        {
          categories,
          count: categories.length,
        }
      );
    } catch (error) {
      console.error("Get popular categories error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve popular categories",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get category path/breadcrumb (Public)
  static async getCategoryPath(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const path = await CategoryService.getCategoryPath(id);

      if (!path || path.length === 0) {
        sendResponse(res, 404, false, "Category not found");
        return;
      }

      sendResponse(res, 200, true, "Category path retrieved successfully", {
        path,
        depth: path.length,
      });
    } catch (error) {
      console.error("Get category path error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve category path",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get deleted categories (Super Admin)
  static async getDeletedCategories(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user || req.user.role !== "super_admin") {
        sendResponse(res, 403, false, "Super admin access required");
        return;
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const offset = req.query.offset
        ? parseInt(req.query.offset as string)
        : 0;

      const categories = await CategoryService.getDeletedCategories(
        limit,
        offset
      );

      sendResponse(
        res,
        200,
        true,
        "Deleted categories retrieved successfully",
        {
          categories,
          pagination: {
            limit,
            offset,
            has_more: categories.length === limit,
          },
        }
      );
    } catch (error) {
      console.error("Get deleted categories error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve deleted categories",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Hard delete category (Super Admin)
  static async hardDeleteCategory(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user || req.user.role !== "super_admin") {
        sendResponse(res, 403, false, "Super admin access required");
        return;
      }

      const { id } = req.params;
      const success = await CategoryService.hardDeleteCategory(id);

      if (!success) {
        sendResponse(res, 404, false, "Category not found");
        return;
      }

      sendResponse(res, 200, true, "Category permanently deleted");
    } catch (error) {
      console.error("Hard delete category error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to permanently delete category",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get category statistics (Admin/Super Admin)
  static async getCategoryStats(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const stats = await CategoryService.getCategoryStats();

      sendResponse(
        res,
        200,
        true,
        "Category statistics retrieved successfully",
        {
          stats,
        }
      );
    } catch (error) {
      console.error("Get category stats error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve category statistics",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Export categories to CSV/Excel (Admin/Super Admin)
  static async exportCategories(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      const format = req.query.format || "csv";
      const includeInactive = req.query.include_inactive === "true";

      const buffer = await CategoryService.exportCategories(
        format as string,
        includeInactive
      );

      const filename = `categories-export-${
        new Date().toISOString().split("T")[0]
      }.${format}`;

      if (format === "csv") {
        res.setHeader("Content-Type", "text/csv");
      } else {
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
      }

      res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
      res.send(buffer);
    } catch (error) {
      console.error("Export categories error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to export categories",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Import categories from CSV/Excel (Admin/Super Admin)
  static async importCategories(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        sendResponse(res, 401, false, "User not authenticated");
        return;
      }

      if (!req.file) {
        sendResponse(res, 400, false, "No file uploaded");
        return;
      }

      const result = await CategoryService.importCategoriesFromFile(
        req.file,
        req.user.id
      );

      sendResponse(res, 200, true, "Categories import completed", {
        import_result: result,
      });
    } catch (error) {
      console.error("Import categories error:", error);
      sendResponse(
        res,
        400,
        false,
        "Failed to import categories",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Get category performance report (Admin/Super Admin)
  static async getCategoryPerformanceReport(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const days = req.query.days ? parseInt(req.query.days as string) : 30;

      const report = await CategoryService.getCategoryPerformanceReport(
        id,
        days
      );

      if (!report) {
        sendResponse(res, 404, false, "Category not found");
        return;
      }

      sendResponse(
        res,
        200,
        true,
        "Category performance report retrieved successfully",
        {
          report,
          period_days: days,
        }
      );
    } catch (error) {
      console.error("Get category performance report error:", error);
      sendResponse(
        res,
        500,
        false,
        "Failed to retrieve category performance report",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
}
