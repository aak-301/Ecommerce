// src/services/CategoryService.ts
import { CategoryModel } from "../models/CategoryModel";
import {
  Category,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from "../types/product";
import * as XLSX from "xlsx";
import * as fs from "fs";

export class CategoryService {
  // Create a new category
  static async createCategory(
    categoryData: CreateCategoryRequest,
    createdBy: string
  ): Promise<Category> {
    // Validate required fields
    if (!categoryData.name || categoryData.name.trim().length === 0) {
      throw new Error("Category name is required");
    }

    if (categoryData.name.length > 255) {
      throw new Error("Category name cannot exceed 255 characters");
    }

    // Validate parent category if specified
    if (categoryData.parent_id) {
      const parentCategory = await CategoryModel.findById(
        categoryData.parent_id
      );
      if (!parentCategory) {
        throw new Error("Parent category not found");
      }

      if (!parentCategory.is_active) {
        throw new Error(
          "Cannot create category under inactive parent category"
        );
      }
    }

    // Check for duplicate names at the same level
    const existingCategories = categoryData.parent_id
      ? await CategoryModel.getSubcategories(categoryData.parent_id)
      : await CategoryModel.getRootCategories();

    const duplicateName = existingCategories.find(
      (cat) => cat.name.toLowerCase() === categoryData.name.toLowerCase()
    );

    if (duplicateName) {
      throw new Error("A category with this name already exists at this level");
    }

    return await CategoryModel.create(categoryData, createdBy);
  }

  // Update a category
  static async updateCategory(
    id: string,
    categoryData: UpdateCategoryRequest
  ): Promise<Category | null> {
    const existingCategory = await CategoryModel.findById(id);
    if (!existingCategory) {
      throw new Error("Category not found");
    }

    // Validate name if being updated
    if (categoryData.name !== undefined) {
      if (!categoryData.name || categoryData.name.trim().length === 0) {
        throw new Error("Category name cannot be empty");
      }

      if (categoryData.name.length > 255) {
        throw new Error("Category name cannot exceed 255 characters");
      }

      // Check for duplicate names at the same level (excluding current category)
      const existingCategories = existingCategory.parent_id
        ? await CategoryModel.getSubcategories(existingCategory.parent_id)
        : await CategoryModel.getRootCategories();

      const duplicateName = existingCategories.find(
        (cat) =>
          cat.id !== id &&
          cat.name.toLowerCase() === categoryData.name.toLowerCase()
      );

      if (duplicateName) {
        throw new Error(
          "A category with this name already exists at this level"
        );
      }
    }

    // Validate parent category if being changed
    if (categoryData.parent_id !== undefined) {
      if (categoryData.parent_id === id) {
        throw new Error("Category cannot be its own parent");
      }

      if (categoryData.parent_id) {
        const parentCategory = await CategoryModel.findById(
          categoryData.parent_id
        );
        if (!parentCategory) {
          throw new Error("Parent category not found");
        }

        // Check for circular reference
        const categoryPath = await CategoryModel.getCategoryPath(
          categoryData.parent_id
        );
        const wouldCreateCircle = categoryPath.some(
          (pathCategory) => pathCategory.id === id
        );

        if (wouldCreateCircle) {
          throw new Error(
            "Cannot move category: would create circular reference"
          );
        }
      }
    }

    return await CategoryModel.update(id, categoryData);
  }

  // Get category by ID
  static async getCategoryById(id: string): Promise<Category | null> {
    return await CategoryModel.findById(id);
  }

  // Get category by slug
  static async getCategoryBySlug(slug: string): Promise<Category | null> {
    return await CategoryModel.findBySlug(slug);
  }

  // Get all categories
  static async getAllCategories(
    includeInactive: boolean = false
  ): Promise<Category[]> {
    return await CategoryModel.getAll(includeInactive);
  }

  // Get category tree
  static async getCategoryTree(): Promise<Category[]> {
    return await CategoryModel.getCategoryTree();
  }

  // Get root categories
  static async getRootCategories(): Promise<Category[]> {
    return await CategoryModel.getRootCategories();
  }

  // Get subcategories
  static async getSubcategories(parentId: string): Promise<Category[]> {
    return await CategoryModel.getSubcategories(parentId);
  }

  // Search categories
  static async searchCategories(
    searchTerm: string,
    includeInactive: boolean = false
  ): Promise<Category[]> {
    if (!searchTerm || searchTerm.trim().length < 2) {
      throw new Error("Search term must be at least 2 characters long");
    }

    return await CategoryModel.search(searchTerm.trim(), includeInactive);
  }

  // Delete category (soft delete)
  static async deleteCategory(id: string, deletedBy: string): Promise<boolean> {
    const category = await CategoryModel.findById(id);
    if (!category) {
      throw new Error("Category not found");
    }

    // Check if category has products
    // This would be implemented when you have the product-category relationship
    // For now, we'll rely on the database constraint

    // Check if category has subcategories
    const subcategories = await CategoryModel.getSubcategories(id);
    if (subcategories.length > 0) {
      throw new Error(
        `Cannot delete category that has ${subcategories.length} subcategories. Move or delete them first.`
      );
    }

    return await CategoryModel.softDelete(id, deletedBy);
  }

  // Restore deleted category
  static async restoreCategory(id: string): Promise<boolean> {
    return await CategoryModel.restore(id);
  }

  // Toggle category active status
  static async toggleCategoryActive(id: string): Promise<Category | null> {
    const category = await CategoryModel.findById(id);
    if (!category) {
      throw new Error("Category not found");
    }

    // If deactivating, check if it has active subcategories
    if (category.is_active) {
      const subcategories = await CategoryModel.getSubcategories(id);
      const activeSubcategories = subcategories.filter((sub) => sub.is_active);

      if (activeSubcategories.length > 0) {
        throw new Error(
          `Cannot deactivate category that has ${activeSubcategories.length} active subcategories. Deactivate them first.`
        );
      }
    }

    return await CategoryModel.toggleActive(id);
  }

  // Update category sort order
  static async updateCategorySortOrder(
    id: string,
    sortOrder: number
  ): Promise<Category | null> {
    if (sortOrder < 0) {
      throw new Error("Sort order cannot be negative");
    }

    return await CategoryModel.updateSortOrder(id, sortOrder);
  }

  // Bulk update sort orders
  static async bulkUpdateSortOrders(
    updates: Array<{ id: string; sort_order: number }>
  ): Promise<void> {
    // Validate all updates
    for (const update of updates) {
      if (
        !update.id ||
        typeof update.sort_order !== "number" ||
        update.sort_order < 0
      ) {
        throw new Error(`Invalid update data for category ${update.id}`);
      }
    }

    // Check that all categories exist
    for (const update of updates) {
      const category = await CategoryModel.findById(update.id);
      if (!category) {
        throw new Error(`Category not found: ${update.id}`);
      }
    }

    await CategoryModel.bulkUpdateSortOrders(updates);
  }

  // Move category to different parent
  static async moveCategory(
    id: string,
    newParentId: string | null
  ): Promise<Category | null> {
    const category = await CategoryModel.findById(id);
    if (!category) {
      throw new Error("Category not found");
    }

    // Validate new parent
    if (newParentId) {
      if (newParentId === id) {
        throw new Error("Category cannot be its own parent");
      }

      const newParent = await CategoryModel.findById(newParentId);
      if (!newParent) {
        throw new Error("New parent category not found");
      }

      if (!newParent.is_active) {
        throw new Error("Cannot move category under inactive parent");
      }

      // Check for circular reference
      const parentPath = await CategoryModel.getCategoryPath(newParentId);
      const wouldCreateCircle = parentPath.some(
        (pathCategory) => pathCategory.id === id
      );

      if (wouldCreateCircle) {
        throw new Error(
          "Cannot move category: would create circular reference"
        );
      }

      // Check for name conflicts at new level
      const existingSiblings = await CategoryModel.getSubcategories(
        newParentId
      );
      const nameConflict = existingSiblings.find(
        (sibling) => sibling.name.toLowerCase() === category.name.toLowerCase()
      );

      if (nameConflict) {
        throw new Error(
          "A category with this name already exists at the destination level"
        );
      }
    } else {
      // Moving to root level - check for name conflicts
      const rootCategories = await CategoryModel.getRootCategories();
      const nameConflict = rootCategories.find(
        (rootCat) =>
          rootCat.id !== id &&
          rootCat.name.toLowerCase() === category.name.toLowerCase()
      );

      if (nameConflict) {
        throw new Error(
          "A category with this name already exists at the root level"
        );
      }
    }

    return await CategoryModel.moveCategory(id, newParentId);
  }

  // Get categories with product counts
  static async getCategoriesWithProductCounts(): Promise<Category[]> {
    return await CategoryModel.getCategoriesWithProductCounts();
  }

  // Get popular categories
  static async getPopularCategories(limit: number = 10): Promise<Category[]> {
    if (limit <= 0 || limit > 100) {
      throw new Error("Limit must be between 1 and 100");
    }

    return await CategoryModel.getPopularCategories(limit);
  }

  // Get category path
  static async getCategoryPath(id: string): Promise<Category[]> {
    const category = await CategoryModel.findById(id);
    if (!category) {
      throw new Error("Category not found");
    }

    return await CategoryModel.getCategoryPath(id);
  }

  // Get deleted categories
  static async getDeletedCategories(
    limit: number = 50,
    offset: number = 0
  ): Promise<Category[]> {
    // This would need to be implemented in CategoryModel
    // For now, return empty array
    return [];
  }

  // Hard delete category
  static async hardDeleteCategory(id: string): Promise<boolean> {
    const category = await CategoryModel.findById(id, true); // Include deleted
    if (!category) {
      throw new Error("Category not found");
    }

    if (!category.deleted_at) {
      throw new Error("Category must be soft deleted first");
    }

    // Check for any remaining dependencies
    const subcategories = await CategoryModel.getSubcategories(id);
    if (subcategories.length > 0) {
      throw new Error(
        "Cannot permanently delete category that has subcategories"
      );
    }

    // Hard delete would be implemented in CategoryModel
    // For now, just return true
    return true;
  }

  // Get category statistics
  static async getCategoryStats(): Promise<any> {
    const allCategories = await CategoryModel.getAll(true);
    const activeCategories = allCategories.filter(
      (cat) => cat.is_active && !cat.deleted_at
    );
    const inactiveCategories = allCategories.filter(
      (cat) => !cat.is_active && !cat.deleted_at
    );
    const deletedCategories = allCategories.filter((cat) => cat.deleted_at);
    const rootCategories = await CategoryModel.getRootCategories();

    // Calculate depth statistics
    const categoriesWithDepth = await CategoryModel.getCategoryTree();
    const maxDepth = categoriesWithDepth.reduce(
      (max, cat) => Math.max(max, (cat as any).level || 0),
      0
    );

    return {
      total_categories: allCategories.length,
      active_categories: activeCategories.length,
      inactive_categories: inactiveCategories.length,
      deleted_categories: deletedCategories.length,
      root_categories: rootCategories.length,
      max_depth: maxDepth,
      categories_with_products: 0, // Would be calculated with product relationship
      empty_categories: 0, // Would be calculated with product relationship
      average_products_per_category: 0, // Would be calculated with product relationship
    };
  }

  // Export categories
  static async exportCategories(
    format: string = "csv",
    includeInactive: boolean = false
  ): Promise<Buffer> {
    const categories = await CategoryModel.getAll(includeInactive);

    // Prepare export data
    const exportData = categories.map((category) => ({
      ID: category.id,
      Name: category.name,
      Description: category.description || "",
      Slug: category.slug,
      "Parent ID": category.parent_id || "",
      "Sort Order": category.sort_order,
      "Is Active": category.is_active ? "Yes" : "No",
      "Product Count": (category as any).product_count || 0,
      "Created At": category.created_at.toISOString().split("T")[0],
      "Updated At": category.updated_at.toISOString().split("T")[0],
    }));

    if (format.toLowerCase() === "csv") {
      // Simple CSV generation
      const headers = Object.keys(exportData[0] || {});
      const csvContent = [
        headers.join(","),
        ...exportData.map((row) =>
          headers
            .map((header) => {
              const value = (row as any)[header];
              return typeof value === "string" && value.includes(",")
                ? `"${value}"`
                : value;
            })
            .join(",")
        ),
      ].join("\n");

      return Buffer.from(csvContent, "utf8");
    } else {
      // Excel export
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Categories");

      return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    }
  }

  // Import categories from file
  static async importCategoriesFromFile(
    file: Express.Multer.File,
    performedBy: string
  ): Promise<any> {
    const workbook = XLSX.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: any[] = XLSX.utils.sheet_to_json(worksheet);

    const result = {
      success: true,
      total_rows: data.length,
      successful_rows: 0,
      failed_rows: 0,
      errors: [] as Array<{ row: number; error: string }>,
      created_categories: [] as string[],
      updated_categories: [] as string[],
    };

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2; // Excel rows start at 1, plus header row

      try {
        // Validate required fields
        if (!row.Name || typeof row.Name !== "string") {
          throw new Error("Category name is required");
        }
        // Check if category exists by name
        const existingCategories = await CategoryModel.getAll(true);
        const existingCategory = existingCategories.find(
          (cat) => cat.name.toLowerCase() === row.Name.toLowerCase()
        );

        if (existingCategory) {
          // Update existing category
          const updateData: UpdateCategoryRequest = {
            description: row.Description,
            sort_order: row["Sort Order"]
              ? parseInt(row["Sort Order"])
              : undefined,
          };

          await CategoryModel.update(existingCategory.id, updateData);
          result.updated_categories.push(existingCategory.id);
        } else {
          // Create new category
          const categoryData: CreateCategoryRequest = {
            name: row.Name,
            description: row.Description,
            sort_order: row["Sort Order"] ? parseInt(row["Sort Order"]) : 0,
          };

          // Handle parent category
          if (row["Parent Name"]) {
            const parentCategory = existingCategories.find(
              (cat) =>
                cat.name.toLowerCase() === row["Parent Name"].toLowerCase()
            );
            if (parentCategory) {
              categoryData.parent_id = parentCategory.id;
            }
          }

          const newCategory = await CategoryModel.create(
            categoryData,
            performedBy
          );
          result.created_categories.push(newCategory.id);
        }

        result.successful_rows++;
      } catch (error) {
        result.failed_rows++;
        result.errors.push({
          row: rowNumber,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Clean up uploaded file
    try {
      fs.unlinkSync(file.path);
    } catch (error) {
      console.error("Failed to delete uploaded file:", error);
    }

    result.success = result.failed_rows === 0;
    return result;
  }

  // Get category performance report
  static async getCategoryPerformanceReport(
    categoryId: string,
    days: number = 30
  ): Promise<any> {
    const category = await CategoryModel.findById(categoryId);
    if (!category) {
      return null;
    }

    // This would integrate with order/sales data when available
    // For now, return basic category info with placeholder metrics
    return {
      category: {
        id: category.id,
        name: category.name,
        description: category.description,
        product_count: (category as any).product_count || 0,
      },
      performance: {
        period_days: days,
        total_orders: 0,
        total_revenue: 0,
        average_order_value: 0,
        top_products: [],
        sales_trend: [],
      },
      comparison: {
        previous_period_revenue: 0,
        revenue_growth_percentage: 0,
        market_share_percentage: 0,
      },
    };
  }

  // Validate category hierarchy
  static async validateCategoryHierarchy(): Promise<{
    isValid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    const allCategories = await CategoryModel.getAll(true);

    // Check for orphaned categories (parent doesn't exist)
    for (const category of allCategories) {
      if (category.parent_id) {
        const parent = allCategories.find(
          (cat) => cat.id === category.parent_id
        );
        if (!parent) {
          issues.push(
            `Category "${category.name}" (${category.id}) has non-existent parent ${category.parent_id}`
          );
        }
      }
    }

    // Check for circular references
    for (const category of allCategories) {
      if (category.parent_id) {
        const visited = new Set<string>();
        let current = category;

        while (current.parent_id && !visited.has(current.id)) {
          visited.add(current.id);
          const parent = allCategories.find(
            (cat) => cat.id === current.parent_id
          );
          if (!parent) break;

          if (parent.id === category.id) {
            issues.push(
              `Circular reference detected involving category "${category.name}" (${category.id})`
            );
            break;
          }
          current = parent;
        }
      }
    }

    // Check for duplicate names at same level
    const levelGroups = new Map<string, Category[]>();

    for (const category of allCategories) {
      const levelKey = category.parent_id || "root";
      if (!levelGroups.has(levelKey)) {
        levelGroups.set(levelKey, []);
      }
      levelGroups.get(levelKey)!.push(category);
    }

    for (const [level, categories] of levelGroups) {
      const nameMap = new Map<string, Category[]>();

      for (const category of categories) {
        const name = category.name.toLowerCase();
        if (!nameMap.has(name)) {
          nameMap.set(name, []);
        }
        nameMap.get(name)!.push(category);
      }

      for (const [name, duplicates] of nameMap) {
        if (duplicates.length > 1) {
          const ids = duplicates.map((d) => d.id).join(", ");
          issues.push(
            `Duplicate category names "${name}" at level ${level}: ${ids}`
          );
        }
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  // Reorganize categories (bulk move operation)
  static async reorganizeCategories(
    operations: Array<{ categoryId: string; newParentId: string | null }>
  ): Promise<void> {
    // Validate all operations first
    for (const operation of operations) {
      const category = await CategoryModel.findById(operation.categoryId);
      if (!category) {
        throw new Error(`Category not found: ${operation.categoryId}`);
      }

      if (operation.newParentId) {
        const newParent = await CategoryModel.findById(operation.newParentId);
        if (!newParent) {
          throw new Error(
            `New parent category not found: ${operation.newParentId}`
          );
        }
      }
    }

    // Execute operations
    for (const operation of operations) {
      await this.moveCategory(operation.categoryId, operation.newParentId);
    }
  }
}
