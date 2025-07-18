// src/models/ProductModel.ts
import pool from "../config/database";
import {
  Product,
  ProductSearchParams,
  PaginatedResponse,
  CreateProductRequest,
  UpdateProductRequest,
  ProductStats,
} from "../types/product";
import { v4 as uuidv4 } from "uuid";

export class ProductModel {
  // Create a new product
  static async create(
    productData: CreateProductRequest,
    createdBy: string
  ): Promise<Product> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const id = uuidv4();

      // Generate slug from name if not provided
      const slug = productData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      // Generate SKU if not provided
      const sku = `PRD-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 5)
        .toUpperCase()}`;

      const query = `
        INSERT INTO products (
          id, name, description, short_description, slug, sku, category_id,
          price, sale_price, cost_price, quantity, low_stock_threshold,
          track_quantity, allow_backorders, weight, dimensions_length,
          dimensions_width, dimensions_height, status, visibility, featured,
          meta_title, meta_description, meta_keywords, tags, attributes,
          created_by, updated_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $27
        ) RETURNING *
      `;

      const values = [
        id,
        productData.name,
        productData.description,
        productData.short_description,
        slug,
        sku,
        productData.category_id,
        productData.price,
        productData.sale_price,
        productData.cost_price,
        productData.quantity || 0,
        productData.low_stock_threshold || 10,
        productData.track_quantity !== false,
        productData.allow_backorders || false,
        productData.weight,
        productData.dimensions_length,
        productData.dimensions_width,
        productData.dimensions_height,
        productData.status || "draft",
        productData.visibility || "public",
        productData.featured || false,
        productData.meta_title,
        productData.meta_description,
        productData.meta_keywords,
        productData.tags || [],
        productData.attributes || {},
        createdBy,
      ];

      const result = await client.query(query, values);
      const product = result.rows[0];

      // Add images if provided
      if (productData.images && productData.images.length > 0) {
        for (let i = 0; i < productData.images.length; i++) {
          const image = productData.images[i];
          await client.query(
            `INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order)
             VALUES ($1, $2, $3, $4, $5)`,
            [id, image.url, image.alt_text, image.is_primary || i === 0, i]
          );
        }
      }

      // Add variants if provided
      if (productData.variants && productData.variants.length > 0) {
        for (const variant of productData.variants) {
          const variantSku = `${sku}-${variant.name
            .replace(/\s+/g, "-")
            .toUpperCase()}`;
          await client.query(
            `INSERT INTO product_variants (product_id, sku, name, price, sale_price, quantity, attributes, image_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              id,
              variantSku,
              variant.name,
              variant.price,
              variant.sale_price,
              variant.quantity,
              variant.attributes,
              variant.image_url,
            ]
          );
        }
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

  // Update a product
  static async update(
    id: string,
    productData: UpdateProductRequest,
    updatedBy: string
  ): Promise<Product | null> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    // Build dynamic update query
    const updateFields = [
      "name",
      "description",
      "short_description",
      "category_id",
      "price",
      "sale_price",
      "cost_price",
      "quantity",
      "low_stock_threshold",
      "track_quantity",
      "allow_backorders",
      "weight",
      "dimensions_length",
      "dimensions_width",
      "dimensions_height",
      "status",
      "visibility",
      "featured",
      "meta_title",
      "meta_description",
      "meta_keywords",
      "tags",
      "attributes",
    ];

    updateFields.forEach((field) => {
      if (productData[field as keyof UpdateProductRequest] !== undefined) {
        fields.push(`${field} = $${paramIndex}`);
        values.push(productData[field as keyof UpdateProductRequest]);
        paramIndex++;
      }
    });

    if (fields.length === 0) {
      throw new Error("No fields to update");
    }

    fields.push(`updated_by = $${paramIndex}`, `updated_at = NOW()`);
    values.push(updatedBy, id);

    const query = `
      UPDATE products 
      SET ${fields.join(", ")}
      WHERE id = $${paramIndex + 1} AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  // Get product by ID with full details
  static async findById(
    id: string,
    includeDeleted: boolean = false
  ): Promise<Product | null> {
    let query = `
      SELECT 
        p.*,
        c.name as category_name,
        c.slug as category_slug,
        cr.name as created_by_name,
        up.name as updated_by_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users cr ON p.created_by = cr.id
      LEFT JOIN users up ON p.updated_by = up.id
      WHERE p.id = $1
    `;

    if (!includeDeleted) {
      query += " AND p.deleted_at IS NULL";
    }

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    const product = result.rows[0];

    // Get images
    const imagesResult = await pool.query(
      "SELECT * FROM product_images WHERE product_id = $1 ORDER BY sort_order",
      [id]
    );
    product.images = imagesResult.rows;

    // Get variants
    const variantsResult = await pool.query(
      "SELECT * FROM product_variants WHERE product_id = $1 AND is_active = TRUE ORDER BY name",
      [id]
    );
    product.variants = variantsResult.rows;

    return product;
  }

  // Get product by SKU
  static async findBySku(sku: string): Promise<Product | null> {
    const query = `
      SELECT p.* FROM products p
      WHERE p.sku = $1 AND p.deleted_at IS NULL
    `;

    const result = await pool.query(query, [sku]);
    return result.rows[0] || null;
  }

  // Search products with filters and pagination
  static async search(
    params: ProductSearchParams
  ): Promise<PaginatedResponse<Product>> {
    const {
      search,
      category_id,
      status,
      visibility,
      featured,
      min_price,
      max_price,
      in_stock,
      low_stock,
      tags,
      sort_by = "created_at",
      sort_order = "desc",
      limit = 50,
      offset = 0,
    } = params;

    let whereConditions = ["p.deleted_at IS NULL"];
    let joinClauses = ["LEFT JOIN categories c ON p.category_id = c.id"];
    const queryParams: any[] = [];
    let paramIndex = 1;

    // Build where conditions
    if (search) {
      whereConditions.push(`(
        p.name ILIKE $${paramIndex} OR 
        p.description ILIKE $${paramIndex} OR 
        p.sku ILIKE $${paramIndex}
      )`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (category_id) {
      whereConditions.push(`p.category_id = $${paramIndex}`);
      queryParams.push(category_id);
      paramIndex++;
    }

    if (status) {
      whereConditions.push(`p.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    if (visibility) {
      whereConditions.push(`p.visibility = $${paramIndex}`);
      queryParams.push(visibility);
      paramIndex++;
    }

    if (featured !== undefined) {
      whereConditions.push(`p.featured = $${paramIndex}`);
      queryParams.push(featured);
      paramIndex++;
    }

    if (min_price !== undefined) {
      whereConditions.push(`p.price >= $${paramIndex}`);
      queryParams.push(min_price);
      paramIndex++;
    }

    if (max_price !== undefined) {
      whereConditions.push(`p.price <= $${paramIndex}`);
      queryParams.push(max_price);
      paramIndex++;
    }

    if (in_stock) {
      whereConditions.push("p.quantity > 0");
    }

    if (low_stock) {
      whereConditions.push(
        "p.quantity <= p.low_stock_threshold AND p.track_quantity = TRUE"
      );
    }

    if (tags && tags.length > 0) {
      whereConditions.push(`p.tags && $${paramIndex}`);
      queryParams.push(tags);
      paramIndex++;
    }

    // Count query
    const countQuery = `
      SELECT COUNT(DISTINCT p.id)::INTEGER as total
      FROM products p
      ${joinClauses.join(" ")}
      WHERE ${whereConditions.join(" AND ")}
    `;

    const countResult = await pool.query(countQuery, queryParams);
    const total = countResult.rows[0].total;

    // Main query
    const validSortColumns = [
      "name",
      "price",
      "created_at",
      "updated_at",
      "quantity",
    ];
    const sortColumn = validSortColumns.includes(sort_by)
      ? sort_by
      : "created_at";
    const sortDirection = sort_order === "asc" ? "ASC" : "DESC";

    queryParams.push(limit, offset);

    const dataQuery = `
      SELECT DISTINCT
        p.*,
        c.name as category_name,
        c.slug as category_slug,
        (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = TRUE LIMIT 1) as primary_image,
        (SELECT COUNT(*) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = TRUE) as variant_count
      FROM products p
      ${joinClauses.join(" ")}
      WHERE ${whereConditions.join(" AND ")}
      ORDER BY p.${sortColumn} ${sortDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const dataResult = await pool.query(dataQuery, queryParams);

    return {
      data: dataResult.rows,
      total,
      limit,
      offset,
      has_more: offset + limit < total,
    };
  }

  // Soft delete product
  static async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const query = `
      UPDATE products 
      SET deleted_at = NOW(), deleted_by = $1, updated_at = NOW()
      WHERE id = $2 AND deleted_at IS NULL
    `;

    const result = await pool.query(query, [deletedBy, id]);
    return result.rowCount > 0;
  }

  // Restore soft deleted product
  static async restore(id: string): Promise<boolean> {
    const query = `
      UPDATE products 
      SET deleted_at = NULL, deleted_by = NULL, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NOT NULL
    `;

    const result = await pool.query(query, [id]);
    return result.rowCount > 0;
  }

  // Update product quantity
  static async updateQuantity(
    id: string,
    quantity: number,
    updatedBy: string
  ): Promise<Product | null> {
    const query = `
      UPDATE products 
      SET quantity = $1, updated_by = $2, updated_at = NOW()
      WHERE id = $3 AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await pool.query(query, [quantity, updatedBy, id]);
    return result.rows[0] || null;
  }

  // Bulk update quantities (for inventory adjustments)
  static async bulkUpdateQuantities(
    updates: Array<{ id: string; quantity: number }>,
    updatedBy: string
  ): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      for (const update of updates) {
        await client.query(
          "UPDATE products SET quantity = $1, updated_by = $2, updated_at = NOW() WHERE id = $3",
          [update.quantity, updatedBy, update.id]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // Get low stock products
  static async getLowStockProducts(limit: number = 50): Promise<Product[]> {
    const query = `
      SELECT 
        p.*,
        c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.track_quantity = TRUE 
      AND p.quantity <= p.low_stock_threshold 
      AND p.deleted_at IS NULL
      AND p.status = 'published'
      ORDER BY p.quantity ASC
      LIMIT $1
    `;

    const result = await pool.query(query, [limit]);
    return result.rows;
  }

  // Get out of stock products
  static async getOutOfStockProducts(limit: number = 50): Promise<Product[]> {
    const query = `
      SELECT 
        p.*,
        c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.track_quantity = TRUE 
      AND p.quantity = 0 
      AND p.deleted_at IS NULL
      AND p.status = 'published'
      ORDER BY p.updated_at DESC
      LIMIT $1
    `;

    const result = await pool.query(query, [limit]);
    return result.rows;
  }

  // Get product statistics
  static async getStats(): Promise<ProductStats> {
    const query = `
      SELECT 
        COUNT(*)::INTEGER as total_products,
        COUNT(CASE WHEN status = 'published' THEN 1 END)::INTEGER as published_products,
        COUNT(CASE WHEN status = 'draft' THEN 1 END)::INTEGER as draft_products,
        COUNT(CASE WHEN status = 'archived' THEN 1 END)::INTEGER as archived_products,
        COUNT(CASE WHEN track_quantity = TRUE AND quantity <= low_stock_threshold AND quantity > 0 THEN 1 END)::INTEGER as low_stock_products,
        COUNT(CASE WHEN track_quantity = TRUE AND quantity = 0 THEN 1 END)::INTEGER as out_of_stock_products,
        COUNT(CASE WHEN featured = TRUE THEN 1 END)::INTEGER as featured_products
      FROM products 
      WHERE deleted_at IS NULL
    `;

    const categoriesQuery = `
      SELECT COUNT(*)::INTEGER as total_categories
      FROM categories 
      WHERE deleted_at IS NULL AND is_active = TRUE
    `;

    const [statsResult, categoriesResult] = await Promise.all([
      pool.query(query),
      pool.query(categoriesQuery),
    ]);

    return {
      ...statsResult.rows[0],
      total_categories: categoriesResult.rows[0].total_categories,
    };
  }

  // Get featured products
  static async getFeaturedProducts(limit: number = 20): Promise<Product[]> {
    const query = `
      SELECT 
        p.*,
        c.name as category_name,
        c.slug as category_slug,
        (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = TRUE LIMIT 1) as primary_image
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.featured = TRUE 
      AND p.status = 'published'
      AND p.visibility = 'public'
      AND p.deleted_at IS NULL
      ORDER BY p.updated_at DESC
      LIMIT $1
    `;

    const result = await pool.query(query, [limit]);
    return result.rows;
  }

  // Get products by category
  static async getByCategory(
    categoryId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<PaginatedResponse<Product>> {
    const countQuery = `
      SELECT COUNT(*)::INTEGER as total
      FROM products p
      WHERE p.category_id = $1 
      AND p.status = 'published'
      AND p.visibility = 'public'
      AND p.deleted_at IS NULL
    `;

    const dataQuery = `
      SELECT 
        p.*,
        c.name as category_name,
        c.slug as category_slug,
        (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = TRUE LIMIT 1) as primary_image,
        (SELECT COUNT(*) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = TRUE) as variant_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.category_id = $1 
      AND p.status = 'published'
      AND p.visibility = 'public'
      AND p.deleted_at IS NULL
      ORDER BY p.featured DESC, p.updated_at DESC
      LIMIT $2 OFFSET $3
    `;

    const [countResult, dataResult] = await Promise.all([
      pool.query(countQuery, [categoryId]),
      pool.query(dataQuery, [categoryId, limit, offset]),
    ]);

    const total = countResult.rows[0].total;

    return {
      data: dataResult.rows,
      total,
      limit,
      offset,
      has_more: offset + limit < total,
    };
  }

  // Search products by tags
  static async searchByTags(
    tags: string[],
    limit: number = 50
  ): Promise<Product[]> {
    const query = `
      SELECT 
        p.*,
        c.name as category_name,
        (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = TRUE LIMIT 1) as primary_image
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.tags && $1
      AND p.status = 'published'
      AND p.visibility = 'public'
      AND p.deleted_at IS NULL
      ORDER BY p.updated_at DESC
      LIMIT $2
    `;

    const result = await pool.query(query, [tags, limit]);
    return result.rows;
  }

  // Get similar products (by category and tags)
  static async getSimilarProducts(
    productId: string,
    limit: number = 10
  ): Promise<Product[]> {
    const query = `
      WITH target_product AS (
        SELECT category_id, tags FROM products WHERE id = $1
      )
      SELECT 
        p.*,
        c.name as category_name,
        (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = TRUE LIMIT 1) as primary_image
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      CROSS JOIN target_product tp
      WHERE p.id != $1
      AND p.status = 'published'
      AND p.visibility = 'public'
      AND p.deleted_at IS NULL
      AND (
        p.category_id = tp.category_id OR
        p.tags && tp.tags
      )
      ORDER BY 
        CASE WHEN p.category_id = tp.category_id THEN 1 ELSE 2 END,
        p.featured DESC,
        p.updated_at DESC
      LIMIT $2
    `;

    const result = await pool.query(query, [productId, limit]);
    return result.rows;
  }
}
