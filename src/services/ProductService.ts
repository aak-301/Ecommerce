// src/services/ProductService.ts
import { ProductModel } from "../models/ProductModel";
import { CategoryModel } from "../models/CategoryModel";
import { EmailService } from "./emailService";
import {
  Product,
  CreateProductRequest,
  UpdateProductRequest,
  ProductSearchParams,
  PaginatedResponse,
  ProductStats,
  ImportResult,
  ProductExcelRow,
} from "../types/product";
import * as XLSX from "xlsx";
import * as path from "path";
import * as fs from "fs";

export class ProductService {
  // Create a new product
  static async createProduct(
    productData: CreateProductRequest,
    createdBy: string
  ): Promise<Product> {
    // Validate category exists
    const category = await CategoryModel.findById(productData.category_id);
    if (!category) {
      throw new Error("Category not found");
    }

    // Validate required fields
    if (!productData.name || !productData.price) {
      throw new Error("Name and price are required");
    }

    if (productData.price <= 0) {
      throw new Error("Price must be greater than 0");
    }

    if (productData.sale_price && productData.sale_price >= productData.price) {
      throw new Error("Sale price must be less than regular price");
    }

    const product = await ProductModel.create(productData, createdBy);

    // Send notification for new product (if configured)
    try {
      await this.notifyLowStockIfNeeded(product);
    } catch (error) {
      console.error("Failed to send low stock notification:", error);
    }

    return product;
  }

  // Update a product
  static async updateProduct(
    id: string,
    productData: UpdateProductRequest,
    updatedBy: string
  ): Promise<Product | null> {
    const existingProduct = await ProductModel.findById(id);
    if (!existingProduct) {
      throw new Error("Product not found");
    }

    // Validate category if being changed
    if (
      productData.category_id &&
      productData.category_id !== existingProduct.category_id
    ) {
      const category = await CategoryModel.findById(productData.category_id);
      if (!category) {
        throw new Error("Category not found");
      }
    }

    // Validate price changes
    if (productData.price !== undefined && productData.price <= 0) {
      throw new Error("Price must be greater than 0");
    }

    if (productData.sale_price && productData.price) {
      if (productData.sale_price >= productData.price) {
        throw new Error("Sale price must be less than regular price");
      }
    }

    const product = await ProductModel.update(id, productData, updatedBy);

    if (product) {
      // Check for low stock after update
      try {
        await this.notifyLowStockIfNeeded(product);
      } catch (error) {
        console.error("Failed to send low stock notification:", error);
      }
    }

    return product;
  }

  // Get product by ID
  static async getProductById(id: string): Promise<Product | null> {
    return await ProductModel.findById(id);
  }

  // Get product by slug
  static async getProductBySlug(slug: string): Promise<Product | null> {
    const products = await ProductModel.search({
      search: slug,
      status: "published",
      visibility: "public",
      limit: 1,
    });

    return products.data.find((p) => p.slug === slug) || null;
  }

  // Search products
  static async searchProducts(
    params: ProductSearchParams
  ): Promise<PaginatedResponse<Product>> {
    return await ProductModel.search(params);
  }

  // Delete product (soft delete)
  static async deleteProduct(id: string, deletedBy: string): Promise<boolean> {
    return await ProductModel.softDelete(id, deletedBy);
  }

  // Restore deleted product
  static async restoreProduct(id: string): Promise<boolean> {
    return await ProductModel.restore(id);
  }

  // Update product quantity
  static async updateProductQuantity(
    id: string,
    quantity: number,
    updatedBy: string
  ): Promise<Product | null> {
    if (quantity < 0) {
      throw new Error("Quantity cannot be negative");
    }

    const product = await ProductModel.updateQuantity(id, quantity, updatedBy);

    if (product) {
      try {
        await this.notifyLowStockIfNeeded(product);
      } catch (error) {
        console.error("Failed to send low stock notification:", error);
      }
    }

    return product;
  }

  // Bulk update quantities
  static async bulkUpdateQuantities(
    updates: Array<{ id: string; quantity: number }>,
    updatedBy: string
  ): Promise<void> {
    // Validate all quantities
    for (const update of updates) {
      if (update.quantity < 0) {
        throw new Error(`Quantity cannot be negative for product ${update.id}`);
      }
    }

    await ProductModel.bulkUpdateQuantities(updates, updatedBy);

    // Check for low stock notifications
    for (const update of updates) {
      try {
        const product = await ProductModel.findById(update.id);
        if (product) {
          await this.notifyLowStockIfNeeded(product);
        }
      } catch (error) {
        console.error(
          `Failed to send low stock notification for product ${update.id}:`,
          error
        );
      }
    }
  }

  // Get featured products
  static async getFeaturedProducts(limit: number = 20): Promise<Product[]> {
    return await ProductModel.getFeaturedProducts(limit);
  }

  // Get products by category
  static async getProductsByCategory(
    categoryId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<PaginatedResponse<Product>> {
    return await ProductModel.getByCategory(categoryId, limit, offset);
  }

  // Get similar products
  static async getSimilarProducts(
    productId: string,
    limit: number = 10
  ): Promise<Product[]> {
    return await ProductModel.getSimilarProducts(productId, limit);
  }

  // Search products by tags
  static async searchProductsByTags(
    tags: string[],
    limit: number = 50
  ): Promise<Product[]> {
    return await ProductModel.searchByTags(tags, limit);
  }

  // Get low stock products
  static async getLowStockProducts(limit: number = 50): Promise<Product[]> {
    return await ProductModel.getLowStockProducts(limit);
  }

  // Get out of stock products
  static async getOutOfStockProducts(limit: number = 50): Promise<Product[]> {
    return await ProductModel.getOutOfStockProducts(limit);
  }

  // Get product statistics
  static async getProductStats(): Promise<ProductStats> {
    return await ProductModel.getStats();
  }

  // Toggle product featured status
  static async toggleProductFeatured(
    id: string,
    updatedBy: string
  ): Promise<Product | null> {
    const product = await ProductModel.findById(id);
    if (!product) {
      throw new Error("Product not found");
    }

    return await ProductModel.update(
      id,
      { featured: !product.featured },
      updatedBy
    );
  }

  // Duplicate product
  static async duplicateProduct(
    id: string,
    newName: string,
    createdBy: string
  ): Promise<Product> {
    const originalProduct = await ProductModel.findById(id);
    if (!originalProduct) {
      throw new Error("Product not found");
    }

    const duplicateData: CreateProductRequest = {
      name: newName || `${originalProduct.name} (Copy)`,
      description: originalProduct.description,
      short_description: originalProduct.short_description,
      category_id: originalProduct.category_id,
      price: originalProduct.price,
      sale_price: originalProduct.sale_price,
      cost_price: originalProduct.cost_price,
      quantity: 0, // Start with 0 quantity for duplicated products
      low_stock_threshold: originalProduct.low_stock_threshold,
      track_quantity: originalProduct.track_quantity,
      allow_backorders: originalProduct.allow_backorders,
      weight: originalProduct.weight,
      dimensions_length: originalProduct.dimensions_length,
      dimensions_width: originalProduct.dimensions_width,
      dimensions_height: originalProduct.dimensions_height,
      status: "draft", // Start as draft
      visibility: originalProduct.visibility,
      featured: false, // Don't copy featured status
      meta_title: originalProduct.meta_title,
      meta_description: originalProduct.meta_description,
      meta_keywords: originalProduct.meta_keywords,
      tags: originalProduct.tags,
      attributes: originalProduct.attributes,
    };

    return await ProductModel.create(duplicateData, createdBy);
  }

  // Import products from Excel
  static async importProductsFromExcel(
    file: Express.Multer.File,
    performedBy: string
  ): Promise<ImportResult> {
    const workbook = XLSX.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: ProductExcelRow[] = XLSX.utils.sheet_to_json(worksheet);

    const result: ImportResult = {
      success: true,
      total_rows: data.length,
      successful_rows: 0,
      failed_rows: 0,
      errors: [],
      created_products: [],
      updated_products: [],
    };

    // Get all categories for mapping
    const categories = await CategoryModel.getAll(true);
    const categoryMap = new Map();
    categories.forEach((cat) => {
      categoryMap.set(cat.name.toLowerCase(), cat.id);
      categoryMap.set(cat.slug.toLowerCase(), cat.id);
    });

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2; // Excel rows start at 1, plus header row

      try {
        // Validate required fields
        if (!row.name || !row.price || !row.category) {
          throw new Error("Missing required fields: name, price, or category");
        }

        // Find category
        const categoryId = categoryMap.get(row.category.toLowerCase());
        if (!categoryId) {
          throw new Error(`Category '${row.category}' not found`);
        }

        // Check if product exists by SKU
        const existingProduct = row.sku
          ? await ProductModel.findBySku(row.sku)
          : null;

        const productData: CreateProductRequest = {
          name: row.name,
          description: row.description,
          category_id: categoryId,
          price: parseFloat(row.price.toString()),
          sale_price: row.sale_price
            ? parseFloat(row.sale_price.toString())
            : undefined,
          quantity: row.quantity ? parseInt(row.quantity.toString()) : 0,
          weight: row.weight ? parseFloat(row.weight.toString()) : undefined,
          status: (row.status as any) || "draft",
          featured:
            row.featured === true ||
            row.featured === "true" ||
            row.featured === 1,
          tags: row.tags
            ? row.tags.split(",").map((tag) => tag.trim())
            : undefined,
        };

        if (existingProduct) {
          // Update existing product
          await ProductModel.update(
            existingProduct.id,
            productData,
            performedBy
          );
          result.updated_products.push(existingProduct.id);
        } else {
          // Create new product
          const newProduct = await ProductModel.create(
            productData,
            performedBy
          );
          result.created_products.push(newProduct.id);
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

  // Export products to Excel
  static async exportProductsToExcel(
    searchParams: ProductSearchParams
  ): Promise<Buffer> {
    const products = await ProductModel.search({
      ...searchParams,
      limit: 10000, // Export all matching products
    });

    const exportData = products.data.map((product) => ({
      ID: product.id,
      Name: product.name,
      Description: product.description,
      SKU: product.sku,
      Category: product.category?.name || "",
      Price: product.price,
      "Sale Price": product.sale_price || "",
      Quantity: product.quantity,
      "Low Stock Threshold": product.low_stock_threshold,
      Weight: product.weight || "",
      Status: product.status,
      Visibility: product.visibility,
      Featured: product.featured ? "Yes" : "No",
      Tags: product.tags?.join(", ") || "",
      "Created At": product.created_at.toISOString().split("T")[0],
      "Updated At": product.updated_at.toISOString().split("T")[0],
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");

    return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  }

  // Get import history
  static async getImportHistory(
    limit: number = 20,
    offset: number = 0
  ): Promise<any[]> {
    // This would typically be implemented in a separate ImportModel
    // For now, return empty array as placeholder
    return [];
  }

  // Private helper method to check and notify about low stock
  private static async notifyLowStockIfNeeded(product: Product): Promise<void> {
    if (
      product.track_quantity &&
      product.quantity <= product.low_stock_threshold
    ) {
      // Get admin users to notify
      // This would typically be implemented with a notification service
      console.log(
        `Low stock alert: Product ${product.name} (${product.sku}) has ${product.quantity} units remaining`
      );

      // Here you could send email notifications, push notifications, etc.
      // await EmailService.sendLowStockAlert(product);
    }
  }
}

// src/services/CartService.ts
import { CartModel } from "../models/CartModel";
import { ProductModel } from "../models/ProductModel";
import {
  ShoppingCart,
  CartItem,
  AddToCartRequest,
  UpdateCartItemRequest,
} from "../types/product";

export class CartService {
  // Get user's cart with items
  static async getUserCart(userId: string): Promise<ShoppingCart> {
    const cart = await CartModel.getOrCreateCart(userId);
    return (await CartModel.getCartWithItems(cart.id)) || cart;
  }

  // Add item to cart
  static async addItemToCart(
    userId: string,
    itemData: AddToCartRequest
  ): Promise<CartItem> {
    // Validate product exists and is available
    const product = await ProductModel.findById(itemData.product_id);
    if (!product) {
      throw new Error("Product not found");
    }

    if (product.status !== "published" || product.visibility !== "public") {
      throw new Error("Product is not available for purchase");
    }

    // Check stock availability
    if (product.track_quantity && !product.allow_backorders) {
      if (itemData.variant_id) {
        // Check variant stock
        // This would require a variant model implementation
      } else {
        if (product.quantity < itemData.quantity) {
          throw new Error(`Only ${product.quantity} units available`);
        }
      }
    }

    const cart = await CartModel.getOrCreateCart(userId);
    return await CartModel.addItem(cart.id, itemData);
  }

  // Update cart item
  static async updateCartItem(
    itemId: string,
    userId: string,
    updates: UpdateCartItemRequest
  ): Promise<CartItem | null> {
    // Verify the item belongs to the user's cart
    const cart = await CartModel.getActiveCart(userId);
    if (!cart) {
      throw new Error("Cart not found");
    }

    return await CartModel.updateItem(itemId, updates);
  }

  // Remove cart item
  static async removeCartItem(
    itemId: string,
    userId: string
  ): Promise<boolean> {
    // Verify the item belongs to the user's cart
    const cart = await CartModel.getActiveCart(userId);
    if (!cart) {
      throw new Error("Cart not found");
    }

    return await CartModel.removeItem(itemId);
  }

  // Clear user's cart
  static async clearUserCart(userId: string): Promise<boolean> {
    const cart = await CartModel.getActiveCart(userId);
    if (!cart) {
      return false;
    }

    return await CartModel.clearCart(cart.id);
  }

  // Get cart summary
  static async getCartSummary(
    userId: string
  ): Promise<{ item_count: number; total: number }> {
    const cart = await CartModel.getActiveCart(userId);
    if (!cart) {
      return { item_count: 0, total: 0 };
    }

    const cartWithItems = await CartModel.getCartWithItems(cart.id);
    return {
      item_count: cartWithItems?.items?.length || 0,
      total: cartWithItems?.total || 0,
    };
  }
}

// src/services/OrderService.ts
import { OrderModel } from "../models/OrderModel";
import { CartModel } from "../models/CartModel";
import { EmailService } from "./emailService";
import {
  Order,
  CreateOrderRequest,
  UpdateOrderRequest,
  OrderSearchParams,
  PaginatedResponse,
} from "../types/product";

export class OrderService {
  // Create order from cart
  static async createOrderFromCart(
    userId: string,
    orderData: CreateOrderRequest
  ): Promise<Order> {
    const cart = await CartModel.getActiveCart(userId);
    if (!cart) {
      throw new Error("No active cart found");
    }

    const cartWithItems = await CartModel.getCartWithItems(cart.id);
    if (
      !cartWithItems ||
      !cartWithItems.items ||
      cartWithItems.items.length === 0
    ) {
      throw new Error("Cart is empty");
    }

    // Validate stock availability before creating order
    for (const item of cartWithItems.items) {
      if (item.product?.track_quantity && !item.product?.allow_backorders) {
        const availableQuantity = item.variant_id
          ? item.variant?.quantity || 0
          : item.product?.quantity || 0;

        if (availableQuantity < item.quantity) {
          throw new Error(
            `Insufficient stock for ${item.product?.name}. Only ${availableQuantity} units available.`
          );
        }
      }
    }

    const order = await OrderModel.createFromCart(cart.id, userId, orderData);

    // Send order confirmation email
    try {
      await EmailService.sendOrderConfirmation(order);
    } catch (error) {
      console.error("Failed to send order confirmation email:", error);
    }

    return order;
  }

  // Get order by ID
  static async getOrderById(orderId: string): Promise<Order | null> {
    return await OrderModel.findById(orderId);
  }

  // Get order by order number
  static async getOrderByNumber(orderNumber: string): Promise<Order | null> {
    return await OrderModel.findByOrderNumber(orderNumber);
  }

  // Update order
  static async updateOrder(
    orderId: string,
    updates: UpdateOrderRequest
  ): Promise<Order | null> {
    return await OrderModel.update(orderId, updates);
  }

  // Search orders
  static async searchOrders(
    params: OrderSearchParams
  ): Promise<PaginatedResponse<Order>> {
    return await OrderModel.search(params);
  }

  // Get user orders
  static async getUserOrders(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<PaginatedResponse<Order>> {
    return await OrderModel.getUserOrders(userId, limit, offset);
  }

  // Cancel order
  static async cancelOrder(
    orderId: string,
    reason?: string
  ): Promise<Order | null> {
    return await OrderModel.cancelOrder(orderId, reason);
  }

  // Get order statistics
  static async getOrderStats(userId?: string): Promise<any> {
    return await OrderModel.getOrderStats(userId);
  }

  // Get recent orders
  static async getRecentOrders(
    limit: number = 10,
    userId?: string
  ): Promise<Order[]> {
    return await OrderModel.getRecentOrders(limit, userId);
  }

  // Get top selling products
  static async getTopSellingProducts(
    limit: number = 10,
    days: number = 30
  ): Promise<any[]> {
    return await OrderModel.getTopSellingProducts(limit, days);
  }
}
