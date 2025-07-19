// =============================================
// UTILITY METHODS
// =============================================// src/models/ProductModel.ts
import pool from "../config/database";
import {
  Product,
  ProductWithDetails,
  CreateProductRequest,
  UpdateProductRequest,
  ProductQueryParams,
  ProductStats,
  LowStockProduct,
  Category,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  ProductVariant,
  ProductAttribute,
} from "../types/product";
import { v4 as uuidv4 } from "uuid";

export class ProductModel {
  // =============================================
  // PRODUCT CRUD OPERATIONS
  // =============================================

  static async create(
    productData: CreateProductRequest,
    createdBy: string
  ): Promise<Product> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const id = uuidv4();
      const sku = productData.sku || (await this.generateUniqueSku());
      const slug = productData.slug || this.generateSlug(productData.name);

      const query = `
        INSERT INTO products (
          id, name, description, short_description, sku, slug, category_id,
          price, sale_price, cost_price, quantity, min_quantity, max_quantity,
          track_quantity, allow_backorder, status, is_featured, is_digital,
          meta_title, meta_description, tags, featured_image, gallery_images,
          weight, length, width, height, shipping_class, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29
        ) RETURNING *
      `;

      const values = [
        id,
        productData.name,
        productData.description,
        productData.short_description,
        sku,
        slug,
        productData.category_id,
        productData.price,
        productData.sale_price,
        productData.cost_price,
        productData.quantity || 0,
        productData.min_quantity || 0,
        productData.max_quantity,
        productData.track_quantity ?? true,
        productData.allow_backorder ?? false,
        productData.status || "draft",
        productData.is_featured ?? false,
        productData.is_digital ?? false,
        productData.meta_title,
        productData.meta_description,
        productData.tags,
        productData.featured_image,
        productData.gallery_images,
        productData.weight,
        productData.length,
        productData.width,
        productData.height,
        productData.shipping_class,
        createdBy,
      ];

      const result = await client.query(query, values);
      const product = result.rows[0];

      // Add attributes if provided
      if (productData.attributes && productData.attributes.length > 0) {
        await this.addProductAttributes(
          client,
          product.id,
          productData.attributes
        );
      }

      // Add variants if provided
      if (productData.variants && productData.variants.length > 0) {
        await this.addProductVariants(client, product.id, productData.variants);
      }

      await client.query("COMMIT");
      return product;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  static async findById(
    id: string,
    includeSoftDeleted: boolean = false
  ): Promise<ProductWithDetails | null> {
    let query = `
      SELECT 
        p.*,
        c.name as category_name,
        c.slug as category_slug,
        u.name as created_by_name,
        CASE 
          WHEN p.track_quantity = TRUE AND p.quantity <= p.min_quantity THEN TRUE 
          ELSE FALSE 
        END as is_low_stock
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = $1
    `;

    if (!includeSoftDeleted) {
      query += " AND p.deleted_at IS NULL";
    }

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    const product = result.rows[0] as ProductWithDetails;

    // Get variants and attributes
    const [variants, attributes] = await Promise.all([
      this.getProductVariants(id),
      this.getProductAttributes(id),
    ]);

    product.variants = variants;
    product.attributes = attributes;

    return product;
  }

  static async findBySku(
    sku: string,
    includeSoftDeleted: boolean = false
  ): Promise<Product | null> {
    let query = "SELECT * FROM products WHERE sku = $1";

    if (!includeSoftDeleted) {
      query += " AND deleted_at IS NULL";
    }

    const result = await pool.query(query, [sku]);
    return result.rows[0] || null;
  }

  static async update(
    id: string,
    updates: UpdateProductRequest,
    updatedBy: string
  ): Promise<Product | null> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const fields = [];
      const values = [];
      let paramIndex = 1;

      // Build dynamic update query
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined && key !== "attributes" && key !== "variants") {
          fields.push(`${key} = ${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      });

      if (fields.length === 0) {
        throw new Error("No fields to update");
      }

      fields.push(`updated_by = ${paramIndex}`, `updated_at = NOW()`);
      values.push(updatedBy, id);

      const query = `
        UPDATE products 
        SET ${fields.join(", ")}
        WHERE id = ${paramIndex + 1} AND deleted_at IS NULL
        RETURNING *
      `;

      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        throw new Error("Product not found or already deleted");
      }

      const product = result.rows[0];

      // Update attributes if provided
      if (updates.attributes) {
        await this.updateProductAttributes(client, id, updates.attributes);
      }

      // Update variants if provided
      if (updates.variants) {
        await this.updateProductVariants(client, id, updates.variants);
      }

      await client.query("COMMIT");
      return product;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  static async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const query = "SELECT soft_delete_product($1::UUID, $2::UUID) as success";
    const result = await pool.query(query, [id, deletedBy]);
    return result.rows[0].success;
  }

  static async restore(id: string): Promise<boolean> {
    const query = "SELECT restore_product($1::UUID) as success";
    const result = await pool.query(query, [id]);
    return result.rows[0].success;
  }

  static async hardDelete(id: string): Promise<boolean> {
    const query = "DELETE FROM products WHERE id = $1";
    const result = await pool.query(query, [id]);
    return result.rowCount! > 0;
  }

  // =============================================
  // PRODUCT SEARCH AND LISTING
  // =============================================

  static async findAll(params: ProductQueryParams = {}): Promise<{
    products: ProductWithDetails[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      limit = 50,
      search,
      category_id,
      status,
      is_featured,
      min_price,
      max_price,
      in_stock,
      low_stock,
      sort_by = "created_at",
      sort_order = "desc",
      created_by,
    } = params;

    const offset = (page - 1) * limit;
    const conditions = ["p.deleted_at IS NULL"];
    const values = [];
    let paramIndex = 1;

    // Build WHERE conditions
    if (search) {
      conditions.push(`(
        p.name ILIKE ${paramIndex} OR 
        p.description ILIKE ${paramIndex} OR 
        p.sku ILIKE ${paramIndex}
      )`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    if (category_id) {
      conditions.push(`p.category_id = ${paramIndex}::UUID`);
      values.push(category_id);
      paramIndex++;
    }

    if (status) {
      conditions.push(`p.status = ${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    if (is_featured !== undefined) {
      conditions.push(`p.is_featured = ${paramIndex}`);
      values.push(is_featured);
      paramIndex++;
    }

    if (min_price !== undefined) {
      conditions.push(`p.price >= ${paramIndex}`);
      values.push(min_price);
      paramIndex++;
    }

    if (max_price !== undefined) {
      conditions.push(`p.price <= ${paramIndex}`);
      values.push(max_price);
      paramIndex++;
    }

    if (in_stock) {
      conditions.push(`p.quantity > 0`);
    }

    if (low_stock) {
      conditions.push(
        `p.track_quantity = TRUE AND p.quantity <= p.min_quantity`
      );
    }

    if (created_by) {
      conditions.push(`p.created_by = ${paramIndex}::UUID`);
      values.push(created_by);
      paramIndex++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${whereClause}
    `;

    // Main query
    const query = `
      SELECT 
        p.*,
        c.name as category_name,
        c.slug as category_slug,
        u.name as created_by_name,
        CASE 
          WHEN p.track_quantity = TRUE AND p.quantity <= p.min_quantity THEN TRUE 
          ELSE FALSE 
        END as is_low_stock
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.created_by = u.id
      ${whereClause}
      ORDER BY p.${sort_by} ${sort_order.toUpperCase()}
      LIMIT ${paramIndex} OFFSET ${paramIndex + 1}
    `;

    values.push(limit, offset);

    const [countResult, productsResult] = await Promise.all([
      pool.query(countQuery, values.slice(0, -2)), // Remove limit and offset for count
      pool.query(query, values),
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    return {
      products: productsResult.rows,
      total,
      page,
      limit,
      totalPages,
    };
  }

  // =============================================
  // INVENTORY MANAGEMENT
  // =============================================

  static async updateQuantity(
    productId: string,
    quantityChange: number,
    changeType: string,
    performedBy: string,
    reason?: string,
    referenceId?: string,
    variantId?: string
  ): Promise<boolean> {
    const query = `
      SELECT update_product_quantity(
        $1::UUID, $2::UUID, $3::INTEGER, $4::VARCHAR(50), 
        $5::TEXT, $6::UUID, $7::UUID
      ) as success
    `;

    const result = await pool.query(query, [
      productId,
      variantId,
      quantityChange,
      changeType,
      reason,
      referenceId,
      performedBy,
    ]);

    return result.rows[0].success;
  }

  static async getLowStockProducts(
    userId?: string
  ): Promise<LowStockProduct[]> {
    const query = "SELECT * FROM get_low_stock_products($1::UUID)";
    const result = await pool.query(query, [userId || null]);
    return result.rows;
  }

  static async getProductStats(userId?: string): Promise<ProductStats> {
    const query = "SELECT * FROM get_product_stats($1::UUID)";
    const result = await pool.query(query, [userId || null]);
    return result.rows[0];
  }

  // =============================================
  // CATEGORY MANAGEMENT
  // =============================================

  static async createCategory(
    categoryData: CreateCategoryRequest,
    createdBy: string
  ): Promise<Category> {
    const id = uuidv4();
    const slug = categoryData.slug || this.generateSlug(categoryData.name);

    const query = `
      INSERT INTO categories (id, name, description, slug, parent_id, is_active, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      id,
      categoryData.name,
      categoryData.description,
      slug,
      categoryData.parent_id,
      categoryData.is_active ?? true,
      createdBy,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async findCategoryById(id: string): Promise<Category | null> {
    const query = "SELECT * FROM categories WHERE id = $1";
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  static async findAllCategories(
    activeOnly: boolean = true
  ): Promise<Category[]> {
    let query = "SELECT * FROM categories";
    if (activeOnly) {
      query += " WHERE is_active = TRUE";
    }
    query += " ORDER BY name ASC";

    const result = await pool.query(query);
    return result.rows;
  }

  static async updateCategory(
    id: string,
    updates: UpdateCategoryRequest
  ): Promise<Category | null> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = ${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    if (fields.length === 0) {
      throw new Error("No fields to update");
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE categories 
      SET ${fields.join(", ")}
      WHERE id = ${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  static async deleteCategory(id: string): Promise<boolean> {
    // Check if category has products
    const productCheck = await pool.query(
      "SELECT COUNT(*) as count FROM products WHERE category_id = $1 AND deleted_at IS NULL",
      [id]
    );

    if (parseInt(productCheck.rows[0].count) > 0) {
      throw new Error("Cannot delete category with active products");
    }

    const query = "DELETE FROM categories WHERE id = $1";
    const result = await pool.query(query, [id]);
    return result.rowCount! > 0;
  }

  // =============================================
  // VARIANTS AND ATTRIBUTES
  // =============================================

  static async getProductVariants(
    productId: string
  ): Promise<ProductVariant[]> {
    const query = `
      SELECT * FROM product_variants 
      WHERE product_id = $1 AND is_active = TRUE
      ORDER BY name ASC
    `;
    const result = await pool.query(query, [productId]);
    return result.rows;
  }

  static async getProductAttributes(
    productId: string
  ): Promise<ProductAttribute[]> {
    const query = `
      SELECT * FROM product_attributes 
      WHERE product_id = $1
      ORDER BY attribute_name ASC, attribute_value ASC
    `;
    const result = await pool.query(query, [productId]);
    return result.rows;
  }

  private static async addProductAttributes(
    client: any,
    productId: string,
    attributes: { name: string; value: string }[]
  ): Promise<void> {
    for (const attr of attributes) {
      await client.query(
        "INSERT INTO product_attributes (product_id, attribute_name, attribute_value) VALUES ($1, $2, $3)",
        [productId, attr.name, attr.value]
      );
    }
  }

  private static async addProductVariants(
    client: any,
    productId: string,
    variants: any[]
  ): Promise<void> {
    for (const variant of variants) {
      const variantId = uuidv4();
      const sku = variant.sku || (await this.generateUniqueSku("VAR"));

      await client.query(
        `
        INSERT INTO product_variants (
          id, product_id, name, sku, price, sale_price, quantity, attributes, image, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
        [
          variantId,
          productId,
          variant.name,
          sku,
          variant.price,
          variant.sale_price,
          variant.quantity || 0,
          JSON.stringify(variant.attributes),
          variant.image,
          variant.is_active ?? true,
        ]
      );
    }
  }

  private static async updateProductAttributes(
    client: any,
    productId: string,
    attributes: { name: string; value: string }[]
  ): Promise<void> {
    // Delete existing attributes
    await client.query("DELETE FROM product_attributes WHERE product_id = $1", [
      productId,
    ]);

    // Add new attributes
    await this.addProductAttributes(client, productId, attributes);
  }

  private static async updateProductVariants(
    client: any,
    productId: string,
    variants: any[]
  ): Promise<void> {
    // Delete existing variants
    await client.query("DELETE FROM product_variants WHERE product_id = $1", [
      productId,
    ]);

    // Add new variants
    await this.addProductVariants(client, productId, variants);
  }

  static async findByVariantId(
    variantId: string
  ): Promise<ProductWithDetails | null> {
    // This method finds a product by its variant ID
    // First get the variant, then get the product
    const variantQuery = `
      SELECT product_id FROM product_variants 
      WHERE id = $1 AND is_active = TRUE
    `;

    const variantResult = await pool.query(variantQuery, [variantId]);

    if (variantResult.rows.length === 0) {
      return null;
    }

    const productId = variantResult.rows[0].product_id;
    return await this.findById(productId);
  }

  static async generateUniqueSku(prefix: string = "PRD"): Promise<string> {
    const query = "SELECT generate_unique_sku($1) as sku";
    const result = await pool.query(query, [prefix]);
    return result.rows[0].sku;
  }

  static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .substring(0, 100);
  }

  // =============================================
  // BULK OPERATIONS
  // =============================================

  static async bulkCreate(
    products: CreateProductRequest[],
    createdBy: string
  ): Promise<{
    successful: number;
    failed: number;
    errors: Array<{
      index: number;
      product: CreateProductRequest;
      error: string;
    }>;
    createdProducts: Product[];
  }> {
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as Array<{
        index: number;
        product: CreateProductRequest;
        error: string;
      }>,
      createdProducts: [] as Product[],
    };

    for (let i = 0; i < products.length; i++) {
      try {
        const product = await this.create(products[i], createdBy);
        results.createdProducts.push(product);
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          index: i,
          product: products[i],
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
  }

  static async bulkUpdateQuantity(
    updates: Array<{
      productId: string;
      variantId?: string;
      quantityChange: number;
      changeType: string;
      reason?: string;
    }>,
    performedBy: string
  ): Promise<{ successful: number; failed: number }> {
    let successful = 0;
    let failed = 0;

    for (const update of updates) {
      try {
        await this.updateQuantity(
          update.productId,
          update.quantityChange,
          update.changeType,
          performedBy,
          update.reason,
          undefined,
          update.variantId
        );
        successful++;
      } catch (error) {
        failed++;
      }
    }

    return { successful, failed };
  }
}
