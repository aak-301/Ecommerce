// src/services/ProductService.ts
import { ProductModel } from "../models/ProductModel";
import { UserModel } from "../models/User";
import {
  Product,
  ProductWithDetails,
  CreateProductRequest,
  UpdateProductRequest,
  ProductQueryParams,
  BulkCreateProductsRequest,
  BulkCreateResponse,
  ExcelImportRequest,
  ExcelImportResponse,
  ProductExcelRow,
  InventoryExcelRow,
  InventoryUpdateRequest,
  BulkInventoryUpdateRequest,
  Category,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from "../types/product";
import { User } from "../types";
import * as XLSX from "xlsx";

export class ProductService {
  // =============================================
  // PRODUCT MANAGEMENT
  // =============================================

  static async createProduct(
    productData: CreateProductRequest,
    user: User
  ): Promise<Product> {
    // Validate permissions
    if (user.role !== "admin" && user.role !== "super_admin") {
      throw new Error("Insufficient permissions to create products");
    }

    // Validate required fields
    if (!productData.name || !productData.price) {
      throw new Error("Product name and price are required");
    }

    if (productData.price < 0) {
      throw new Error("Product price cannot be negative");
    }

    if (productData.sale_price && productData.sale_price < 0) {
      throw new Error("Sale price cannot be negative");
    }

    if (productData.cost_price && productData.cost_price < 0) {
      throw new Error("Cost price cannot be negative");
    }

    if (productData.quantity && productData.quantity < 0) {
      throw new Error("Quantity cannot be negative");
    }

    if (productData.min_quantity && productData.min_quantity < 0) {
      throw new Error("Minimum quantity cannot be negative");
    }

    // Check for duplicate SKU if provided
    if (productData.sku) {
      const existingProduct = await ProductModel.findBySku(productData.sku);
      if (existingProduct) {
        throw new Error("Product with this SKU already exists");
      }
    }

    // Validate category if provided
    if (productData.category_id) {
      const category = await ProductModel.findCategoryById(
        productData.category_id
      );
      if (!category || !category.is_active) {
        throw new Error("Invalid or inactive category");
      }
    }

    // Validate sale price is less than regular price
    if (productData.sale_price && productData.sale_price >= productData.price) {
      throw new Error("Sale price must be less than regular price");
    }

    return await ProductModel.create(productData, user.id);
  }

  static async getProductById(
    id: string,
    user: User
  ): Promise<ProductWithDetails | null> {
    const product = await ProductModel.findById(id);

    if (!product) {
      return null;
    }

    // Check permissions - users can only see their own products unless super_admin
    if (user.role === "admin" && product.created_by !== user.id) {
      throw new Error("Access denied - you can only view your own products");
    }

    return product;
  }

  static async updateProduct(
    id: string,
    updates: UpdateProductRequest,
    user: User
  ): Promise<Product> {
    const existingProduct = await ProductModel.findById(id);

    if (!existingProduct) {
      throw new Error("Product not found");
    }

    // Check permissions
    if (user.role === "admin" && existingProduct.created_by !== user.id) {
      throw new Error("Access denied - you can only update your own products");
    }

    // Validate price if being updated
    if (updates.price !== undefined && updates.price < 0) {
      throw new Error("Product price cannot be negative");
    }

    if (updates.sale_price !== undefined && updates.sale_price < 0) {
      throw new Error("Sale price cannot be negative");
    }

    if (updates.cost_price !== undefined && updates.cost_price < 0) {
      throw new Error("Cost price cannot be negative");
    }

    if (updates.quantity !== undefined && updates.quantity < 0) {
      throw new Error("Quantity cannot be negative");
    }

    if (updates.min_quantity !== undefined && updates.min_quantity < 0) {
      throw new Error("Minimum quantity cannot be negative");
    }

    // Check for duplicate SKU if being updated
    if (updates.sku && updates.sku !== existingProduct.sku) {
      const existingWithSku = await ProductModel.findBySku(updates.sku);
      if (existingWithSku && existingWithSku.id !== id) {
        throw new Error("Product with this SKU already exists");
      }
    }

    // Validate category if being updated
    if (updates.category_id) {
      const category = await ProductModel.findCategoryById(updates.category_id);
      if (!category || !category.is_active) {
        throw new Error("Invalid or inactive category");
      }
    }

    // Validate sale price vs regular price
    const newPrice = updates.price || existingProduct.price;
    const newSalePrice = updates.sale_price;
    if (newSalePrice && newSalePrice >= newPrice) {
      throw new Error("Sale price must be less than regular price");
    }

    const updatedProduct = await ProductModel.update(id, updates, user.id);
    if (!updatedProduct) {
      throw new Error("Failed to update product");
    }

    return updatedProduct;
  }

  static async deleteProduct(
    id: string,
    user: User
  ): Promise<{ message: string }> {
    const product = await ProductModel.findById(id);

    if (!product) {
      throw new Error("Product not found");
    }

    // Check permissions
    if (user.role === "admin" && product.created_by !== user.id) {
      throw new Error("Access denied - you can only delete your own products");
    }

    const success = await ProductModel.softDelete(id, user.id);
    if (!success) {
      throw new Error("Failed to delete product");
    }

    return { message: "Product deleted successfully" };
  }

  static async getAllProducts(
    params: ProductQueryParams,
    user: User
  ): Promise<{
    products: ProductWithDetails[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    // For admin users, filter to only their products unless super_admin
    if (user.role === "admin") {
      params.created_by = user.id;
    }

    // Validate pagination parameters
    if (params.page && params.page < 1) {
      throw new Error("Page number must be greater than 0");
    }

    if (params.limit && (params.limit < 1 || params.limit > 100)) {
      throw new Error("Limit must be between 1 and 100");
    }

    return await ProductModel.findAll(params);
  }

  // =============================================
  // INVENTORY MANAGEMENT
  // =============================================

  static async updateInventory(
    request: InventoryUpdateRequest,
    user: User
  ): Promise<{ message: string }> {
    if (!request.product_id && !request.variant_id) {
      throw new Error("Either product ID or variant ID is required");
    }

    if (request.product_id && request.variant_id) {
      throw new Error("Cannot specify both product ID and variant ID");
    }

    if (!request.change_type) {
      throw new Error("Change type is required");
    }

    const validChangeTypes = [
      "stock_in",
      "stock_out",
      "adjustment",
      "sale",
      "return",
      "damaged",
    ];
    if (!validChangeTypes.includes(request.change_type)) {
      throw new Error("Invalid change type");
    }

    if (request.quantity_change === 0) {
      throw new Error("Quantity change cannot be zero");
    }

    // Note: We need to handle variant inventory updates differently
    // since ProductModel.findByVariantId doesn't exist yet
    if (request.variant_id) {
      // For now, we'll throw an error until variant support is implemented
      throw new Error("Variant inventory updates are not yet implemented");
    }

    const product = await ProductModel.findById(request.product_id!);

    if (!product) {
      throw new Error("Product not Found");
    }

    // Check permissions
    if (user.role === "admin" && product.created_by !== user.id) {
      throw new Error(
        "Access denied - you can only update inventory for your own products"
      );
    }

    const success = await ProductModel.updateQuantity(
      request.product_id || product.id,
      request.quantity_change,
      request.change_type,
      user.id,
      request.reason,
      request.reference_id,
      request.variant_id
    );

    if (!success) {
      throw new Error("Failed to update inventory");
    }

    return { message: "Inventory updated successfully" };
  }

  static async bulkUpdateInventory(
    request: BulkInventoryUpdateRequest,
    user: User
  ): Promise<{
    successful: number;
    failed: number;
    message: string;
    errors?: Array<{ index: number; error: string }>;
  }> {
    if (!request.updates || request.updates.length === 0) {
      throw new Error("At least one inventory update is required");
    }

    if (request.updates.length > 100) {
      throw new Error("Cannot update more than 100 items at once");
    }

    let successful = 0;
    let failed = 0;
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < request.updates.length; i++) {
      try {
        await this.updateInventory(request.updates[i], user);
        successful++;
      } catch (error) {
        failed++;
        errors.push({
          index: i,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return {
      successful,
      failed,
      message: `Bulk inventory update completed: ${successful} successful, ${failed} failed`,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  static async getLowStockProducts(user: User) {
    const userId = user.role === "admin" ? user.id : undefined;
    return await ProductModel.getLowStockProducts(userId);
  }

  static async getProductStats(user: User) {
    const userId = user.role === "admin" ? user.id : undefined;
    return await ProductModel.getProductStats(userId);
  }

  // =============================================
  // BULK OPERATIONS
  // =============================================

  static async bulkCreateProducts(
    request: BulkCreateProductsRequest,
    user: User
  ): Promise<BulkCreateResponse> {
    if (user.role !== "admin" && user.role !== "super_admin") {
      throw new Error("Insufficient permissions to bulk create products");
    }

    if (!request.products || request.products.length === 0) {
      throw new Error("At least one product is required");
    }

    if (request.products.length > 100) {
      throw new Error("Cannot create more than 100 products at once");
    }

    // Validate each product before processing
    for (let i = 0; i < request.products.length; i++) {
      const product = request.products[i];
      if (!product.name || !product.price) {
        throw new Error(`Product at index ${i}: name and price are required`);
      }
      if (product.price < 0) {
        throw new Error(`Product at index ${i}: price cannot be negative`);
      }
    }

    const result = await ProductModel.bulkCreate(request.products, user.id);

    return {
      successful: result.successful,
      failed: result.failed,
      total: request.products.length,
      errors: result.errors,
      created_products: result.createdProducts,
    };
  }

  // =============================================
  // EXCEL IMPORT/EXPORT
  // =============================================

  static async importFromExcel(
    file: Express.Multer.File,
    user: User
  ): Promise<ExcelImportResponse> {
    if (user.role !== "admin" && user.role !== "super_admin") {
      throw new Error("Insufficient permissions to import products");
    }

    if (!file) {
      throw new Error("File is required");
    }

    if (file.size > 10 * 1024 * 1024) {
      // 10MB limit
      throw new Error("File size cannot exceed 10MB");
    }

    try {
      const workbook = XLSX.read(file.buffer, { type: "buffer" });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error("Excel file contains no sheets");
      }

      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as ProductExcelRow[];

      if (jsonData.length === 0) {
        throw new Error("Excel file is empty or contains no valid data");
      }

      if (jsonData.length > 1000) {
        throw new Error("Cannot import more than 1000 products at once");
      }

      // Convert Excel data to CreateProductRequest format
      const products: CreateProductRequest[] = [];
      const errors: any[] = [];

      for (let i = 0; i < jsonData.length; i++) {
        try {
          const row = jsonData[i];

          // Validate required fields
          if (!row.name || row.name.trim() === "") {
            errors.push({
              row: i + 2, // Excel row number (1-indexed + header)
              error: "Product name is required",
            });
            continue;
          }

          if (!row.price || isNaN(Number(row.price)) || Number(row.price) < 0) {
            errors.push({
              row: i + 2,
              error: "Valid price is required and must be non-negative",
            });
            continue;
          }

          // Find category by name if provided
          let categoryId: string | undefined;
          if (
            row.category_name &&
            typeof row.category_name === "string" &&
            row.category_name.trim() !== ""
          ) {
            try {
              const categories = await ProductModel.findAllCategories();
              const category = categories.find(
                (c) =>
                  c.name.toLowerCase().trim() ===
                  row.category_name!.toLowerCase().trim()
              );
              if (category) {
                categoryId = category.id;
              } else {
                errors.push({
                  row: i + 2,
                  error: `Category '${row.category_name}' not found`,
                });
                continue;
              }
            } catch (error) {
              errors.push({
                row: i + 2,
                error: "Failed to validate category",
              });
              continue;
            }
          }

          // Validate numeric fields
          const price = Number(row.price);
          const sale_price = row.sale_price
            ? Number(row.sale_price)
            : undefined;
          const cost_price = row.cost_price
            ? Number(row.cost_price)
            : undefined;
          const quantity = row.quantity ? Number(row.quantity) : 0;
          const min_quantity = row.min_quantity ? Number(row.min_quantity) : 0;
          const max_quantity = row.max_quantity
            ? Number(row.max_quantity)
            : undefined;
          const weight = row.weight ? Number(row.weight) : undefined;
          const length = row.length ? Number(row.length) : undefined;
          const width = row.width ? Number(row.width) : undefined;
          const height = row.height ? Number(row.height) : undefined;

          // Validate sale price vs regular price
          if (sale_price && sale_price >= price) {
            errors.push({
              row: i + 2,
              error: "Sale price must be less than regular price",
            });
            continue;
          }

          // Validate status
          const validStatuses = ["draft", "active", "inactive", "out_of_stock"];
          const status =
            row.status && validStatuses.includes(row.status)
              ? row.status
              : "draft";

          const product: CreateProductRequest = {
            name: row.name.trim(),
            description: row.description?.trim(),
            short_description: row.short_description?.trim(),
            sku: row.sku?.trim(),
            category_id: categoryId,
            price: price,
            sale_price: sale_price,
            cost_price: cost_price,
            quantity: quantity,
            min_quantity: min_quantity,
            max_quantity: max_quantity,
            track_quantity: row.track_quantity ?? true,
            allow_backorder: row.allow_backorder ?? false,
            status: status as any,
            is_featured: row.is_featured ?? false,
            is_digital: row.is_digital ?? false,
            meta_title: row.meta_title?.trim(),
            meta_description: row.meta_description?.trim(),
            tags: row.tags
              ? row.tags
                  .split(",")
                  .map((t) => t.trim())
                  .filter((t) => t.length > 0)
              : undefined,
            featured_image: row.featured_image?.trim(),
            gallery_images: row.gallery_images
              ? row.gallery_images
                  .split(",")
                  .map((img) => img.trim())
                  .filter((img) => img.length > 0)
              : undefined,
            weight: weight,
            length: length,
            width: width,
            height: height,
            shipping_class: row.shipping_class?.trim(),
          };

          products.push(product);
        } catch (error) {
          errors.push({
            row: i + 2,
            error:
              error instanceof Error ? error.message : "Invalid data format",
          });
        }
      }

      if (products.length === 0) {
        throw new Error("No valid products found in Excel file");
      }

      // Bulk create products
      const result = await this.bulkCreateProducts({ products }, user);

      return {
        import_id: `import_${Date.now()}_${user.id}`,
        status: result.failed > 0 ? "partial" : "completed",
        total_rows: jsonData.length,
        successful_rows: result.successful,
        failed_rows: result.failed,
        errors: [...errors, ...(result.errors || [])],
      };
    } catch (error) {
      throw new Error(
        `Excel import failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  static async importInventoryFromExcel(
    file: Express.Multer.File,
    user: User
  ): Promise<ExcelImportResponse> {
    if (user.role !== "admin" && user.role !== "super_admin") {
      throw new Error("Insufficient permissions to import inventory");
    }

    if (!file) {
      throw new Error("File is required");
    }

    if (file.size > 10 * 1024 * 1024) {
      // 10MB limit
      throw new Error("File size cannot exceed 10MB");
    }

    try {
      const workbook = XLSX.read(file.buffer, { type: "buffer" });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error("Excel file contains no sheets");
      }

      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(
        worksheet
      ) as InventoryExcelRow[];

      if (jsonData.length === 0) {
        throw new Error("Excel file is empty or contains no valid data");
      }

      if (jsonData.length > 1000) {
        throw new Error(
          "Cannot import more than 1000 inventory updates at once"
        );
      }

      const updates: InventoryUpdateRequest[] = [];
      const errors: any[] = [];

      for (let i = 0; i < jsonData.length; i++) {
        try {
          const row = jsonData[i];

          if (!row.sku || row.sku.trim() === "") {
            errors.push({
              row: i + 2,
              error: "SKU is required",
            });
            continue;
          }

          if (!row.quantity_change || isNaN(Number(row.quantity_change))) {
            errors.push({
              row: i + 2,
              error: "Valid quantity change is required",
            });
            continue;
          }

          if (!row.change_type || row.change_type.trim() === "") {
            errors.push({
              row: i + 2,
              error: "Change type is required",
            });
            continue;
          }

          const validChangeTypes = [
            "stock_in",
            "stock_out",
            "adjustment",
            "sale",
            "return",
            "damaged",
          ];
          if (!validChangeTypes.includes(row.change_type)) {
            errors.push({
              row: i + 2,
              error: `Invalid change type. Must be one of: ${validChangeTypes.join(
                ", "
              )}`,
            });
            continue;
          }

          // Find product by SKU
          const product = await ProductModel.findBySku(row.sku.trim());
          if (!product) {
            errors.push({
              row: i + 2,
              error: `Product with SKU '${row.sku}' not found`,
            });
            continue;
          }

          // Check permissions for admin users
          if (user.role === "admin" && product.created_by !== user.id) {
            errors.push({
              row: i + 2,
              error: `Access denied for product with SKU '${row.sku}'`,
            });
            continue;
          }

          updates.push({
            product_id: product.id,
            quantity_change: Number(row.quantity_change),
            change_type: row.change_type as any,
            reason: row.reason?.trim(),
          });
        } catch (error) {
          errors.push({
            row: i + 2,
            error:
              error instanceof Error ? error.message : "Invalid data format",
          });
        }
      }

      if (updates.length === 0) {
        throw new Error("No valid inventory updates found in Excel file");
      }

      // Bulk update inventory
      const result = await this.bulkUpdateInventory({ updates }, user);

      return {
        import_id: `inventory_import_${Date.now()}_${user.id}`,
        status: result.failed > 0 ? "partial" : "completed",
        total_rows: jsonData.length,
        successful_rows: result.successful,
        failed_rows: result.failed,
        errors: [...errors, ...(result.errors || [])],
      };
    } catch (error) {
      throw new Error(
        `Inventory import failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  static generateProductExcelTemplate(): Buffer {
    const templateData = [
      {
        name: "Sample Product",
        description: "Product description here",
        short_description: "Short description",
        sku: "SAMPLE-001",
        category_name: "Electronics",
        price: 99.99,
        sale_price: 79.99,
        cost_price: 50.0,
        quantity: 100,
        min_quantity: 10,
        max_quantity: 1000,
        track_quantity: true,
        allow_backorder: false,
        status: "active",
        is_featured: false,
        is_digital: false,
        meta_title: "SEO Title",
        meta_description: "SEO Description",
        tags: "tag1, tag2, tag3",
        featured_image: "https://example.com/image.jpg",
        gallery_images:
          "https://example.com/img1.jpg, https://example.com/img2.jpg",
        weight: 1.5,
        length: 10,
        width: 5,
        height: 3,
        shipping_class: "standard",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");

    return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  }

  static generateInventoryExcelTemplate(): Buffer {
    const templateData = [
      {
        sku: "SAMPLE-001",
        quantity_change: 10,
        change_type: "stock_in",
        reason: "New inventory received",
      },
      {
        sku: "SAMPLE-002",
        quantity_change: -5,
        change_type: "adjustment",
        reason: "Damaged items removed",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");

    return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  }

  // =============================================
  // CATEGORY MANAGEMENT
  // =============================================

  static async createCategory(
    categoryData: CreateCategoryRequest,
    user: User
  ): Promise<Category> {
    if (user.role !== "admin" && user.role !== "super_admin") {
      throw new Error("Insufficient permissions to create categories");
    }

    if (!categoryData.name || categoryData.name.trim() === "") {
      throw new Error("Category name is required");
    }

    // Check for duplicate name
    const categories = await ProductModel.findAllCategories(false);
    const existing = categories.find(
      (c) =>
        c.name.toLowerCase().trim() === categoryData.name.toLowerCase().trim()
    );

    if (existing) {
      throw new Error("Category with this name already exists");
    }

    // Validate parent category if provided
    if (categoryData.parent_id) {
      const parentCategory = await ProductModel.findCategoryById(
        categoryData.parent_id
      );
      if (!parentCategory) {
        throw new Error("Parent category not found");
      }
      if (!parentCategory.is_active) {
        throw new Error("Parent category is not active");
      }
    }

    return await ProductModel.createCategory(categoryData, user.id);
  }

  static async updateCategory(
    id: string,
    updates: UpdateCategoryRequest,
    user: User
  ): Promise<Category> {
    if (user.role !== "admin" && user.role !== "super_admin") {
      throw new Error("Insufficient permissions to update categories");
    }

    const category = await ProductModel.findCategoryById(id);
    if (!category) {
      throw new Error("Category not found");
    }

    // Check for duplicate name if name is being updated
    if (
      updates.name &&
      updates.name.trim() !== "" &&
      updates.name !== category.name
    ) {
      const categories = await ProductModel.findAllCategories(false);
      const existing = categories.find(
        (c) =>
          c.name.toLowerCase().trim() === updates.name!.toLowerCase().trim() &&
          c.id !== id
      );

      if (existing) {
        throw new Error("Category with this name already exists");
      }
    }

    // Validate parent category if being updated
    if (updates.parent_id) {
      const parentCategory = await ProductModel.findCategoryById(
        updates.parent_id
      );
      if (!parentCategory) {
        throw new Error("Parent category not found");
      }

      // Prevent circular reference
      if (updates.parent_id === id) {
        throw new Error("Category cannot be its own parent");
      }

      if (!parentCategory.is_active) {
        throw new Error("Parent category is not active");
      }
    }

    const updatedCategory = await ProductModel.updateCategory(id, updates);
    if (!updatedCategory) {
      throw new Error("Failed to update category");
    }

    return updatedCategory;
  }

  static async deleteCategory(
    id: string,
    user: User
  ): Promise<{ message: string }> {
    if (user.role !== "admin" && user.role !== "super_admin") {
      throw new Error("Insufficient permissions to delete categories");
    }

    const category = await ProductModel.findCategoryById(id);
    if (!category) {
      throw new Error("Category not found");
    }

    try {
      const success = await ProductModel.deleteCategory(id);
      if (!success) {
        throw new Error("Failed to delete category");
      }

      return { message: "Category deleted successfully" };
    } catch (error) {
      if (error instanceof Error && error.message.includes("active products")) {
        throw new Error("Cannot delete category that contains active products");
      }
      throw error;
    }
  }

  static async getAllCategories(
    activeOnly: boolean = true
  ): Promise<Category[]> {
    return await ProductModel.findAllCategories(activeOnly);
  }

  static async getCategoryById(id: string): Promise<Category | null> {
    return await ProductModel.findCategoryById(id);
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  static async restoreProduct(
    id: string,
    user: User
  ): Promise<{ message: string }> {
    if (user.role !== "super_admin") {
      throw new Error("Only super admins can restore deleted products");
    }

    const success = await ProductModel.restore(id);
    if (!success) {
      throw new Error("Failed to restore product or product not found");
    }

    return { message: "Product restored successfully" };
  }

  static async hardDeleteProduct(
    id: string,
    user: User
  ): Promise<{ message: string }> {
    if (user.role !== "super_admin") {
      throw new Error("Only super admins can permanently delete products");
    }

    const success = await ProductModel.hardDelete(id);
    if (!success) {
      throw new Error("Failed to delete product or product not found");
    }

    return { message: "Product permanently deleted" };
  }

  // For super admin to sell products to users (assign products to different users)
  static async assignProductToUser(
    productId: string,
    targetUserId: string,
    user: User
  ): Promise<Product> {
    if (user.role !== "super_admin") {
      throw new Error("Only super admins can assign products to users");
    }

    const product = await ProductModel.findById(productId);
    if (!product) {
      throw new Error("Product not found");
    }

    // Validate target user exists and is active
    const targetUser = await UserModel.findById(targetUserId);
    if (!targetUser) {
      throw new Error("Target user not found");
    }

    if (targetUser.deleted_at) {
      throw new Error("Cannot assign product to deleted user");
    }

    if (targetUser.status !== "active") {
      throw new Error("Target user is not active");
    }

    if (targetUser.role !== "admin" && targetUser.role !== "super_admin") {
      throw new Error("Can only assign products to admin or super admin users");
    }

    const updatedProduct = await ProductModel.update(
      productId,
      { created_by: targetUserId },
      user.id
    );

    if (!updatedProduct) {
      throw new Error("Failed to assign product to user");
    }

    return updatedProduct;
  }
}
