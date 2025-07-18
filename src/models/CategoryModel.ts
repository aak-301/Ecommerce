// src/models/CategoryModel.ts
import pool from "../config/database";
import {
  Category,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from "../types/product";
import { v4 as uuidv4 } from "uuid";

export class CategoryModel {
  // Create a new category
  static async create(
    categoryData: CreateCategoryRequest,
    createdBy: string
  ): Promise<Category> {
    const id = uuidv4();

    // Generate slug from name
    const slug = categoryData.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const query = `
      INSERT INTO categories (
        id, name, description, slug, parent_id, image_url, sort_order, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      id,
      categoryData.name,
      categoryData.description,
      slug,
      categoryData.parent_id,
      categoryData.image_url,
      categoryData.sort_order || 0,
      createdBy,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // Update a category
  static async update(
    id: string,
    categoryData: UpdateCategoryRequest
  ): Promise<Category | null> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    const updateFields = [
      "name",
      "description",
      "parent_id",
      "image_url",
      "sort_order",
    ];

    updateFields.forEach((field) => {
      if (categoryData[field as keyof UpdateCategoryRequest] !== undefined) {
        fields.push(`${field} = ${paramIndex}`);
        values.push(categoryData[field as keyof UpdateCategoryRequest]);
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
      WHERE id = ${paramIndex} AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  // Get category by ID
  static async findById(
    id: string,
    includeDeleted: boolean = false
  ): Promise<Category | null> {
    let query = `
      SELECT 
        c.*,
        pc.name as parent_name,
        (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.deleted_at IS NULL) as product_count,
        (SELECT COUNT(*) FROM categories cc WHERE cc.parent_id = c.id AND cc.deleted_at IS NULL) as subcategory_count
      FROM categories c
      LEFT JOIN categories pc ON c.parent_id = pc.id
      WHERE c.id = $1
    `;

    if (!includeDeleted) {
      query += " AND c.deleted_at IS NULL";
    }

    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  // Get category by slug
  static async findBySlug(slug: string): Promise<Category | null> {
    const query = `
      SELECT 
        c.*,
        pc.name as parent_name,
        (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.deleted_at IS NULL) as product_count,
        (SELECT COUNT(*) FROM categories cc WHERE cc.parent_id = c.id AND cc.deleted_at IS NULL) as subcategory_count
      FROM categories c
      LEFT JOIN categories pc ON c.parent_id = pc.id
      WHERE c.slug = $1 AND c.deleted_at IS NULL AND c.is_active = TRUE
    `;

    const result = await pool.query(query, [slug]);
    return result.rows[0] || null;
  }

  // Get all categories with hierarchy
  static async getAll(includeInactive: boolean = false): Promise<Category[]> {
    let query = `
      SELECT 
        c.*,
        pc.name as parent_name,
        (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.deleted_at IS NULL) as product_count,
        (SELECT COUNT(*) FROM categories cc WHERE cc.parent_id = c.id AND cc.deleted_at IS NULL) as subcategory_count
      FROM categories c
      LEFT JOIN categories pc ON c.parent_id = pc.id
      WHERE c.deleted_at IS NULL
    `;

    if (!includeInactive) {
      query += " AND c.is_active = TRUE";
    }

    query += " ORDER BY c.sort_order ASC, c.name ASC";

    const result = await pool.query(query);
    return result.rows;
  }

  // Get root categories (no parent)
  static async getRootCategories(): Promise<Category[]> {
    const query = `
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.deleted_at IS NULL) as product_count,
        (SELECT COUNT(*) FROM categories cc WHERE cc.parent_id = c.id AND cc.deleted_at IS NULL) as subcategory_count
      FROM categories c
      WHERE c.parent_id IS NULL 
      AND c.deleted_at IS NULL 
      AND c.is_active = TRUE
      ORDER BY c.sort_order ASC, c.name ASC
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  // Get subcategories of a parent category
  static async getSubcategories(parentId: string): Promise<Category[]> {
    const query = `
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.deleted_at IS NULL) as product_count,
        (SELECT COUNT(*) FROM categories cc WHERE cc.parent_id = c.id AND cc.deleted_at IS NULL) as subcategory_count
      FROM categories c
      WHERE c.parent_id = $1 
      AND c.deleted_at IS NULL 
      AND c.is_active = TRUE
      ORDER BY c.sort_order ASC, c.name ASC
    `;

    const result = await pool.query(query, [parentId]);
    return result.rows;
  }

  // Get category tree (hierarchical structure)
  static async getCategoryTree(): Promise<Category[]> {
    const query = `
      WITH RECURSIVE category_tree AS (
        -- Base case: root categories
        SELECT 
          c.*,
          NULL as parent_name,
          0 as level,
          ARRAY[c.id] as path,
          c.sort_order::text as sort_path
        FROM categories c
        WHERE c.parent_id IS NULL 
        AND c.deleted_at IS NULL 
        AND c.is_active = TRUE
        
        UNION ALL
        
        -- Recursive case: subcategories
        SELECT 
          c.*,
          ct.name as parent_name,
          ct.level + 1,
          ct.path || c.id,
          ct.sort_path || '.' || c.sort_order::text
        FROM categories c
        INNER JOIN category_tree ct ON c.parent_id = ct.id
        WHERE c.deleted_at IS NULL 
        AND c.is_active = TRUE
      )
      SELECT 
        ct.*,
        (SELECT COUNT(*) FROM products p WHERE p.category_id = ct.id AND p.deleted_at IS NULL) as product_count,
        (SELECT COUNT(*) FROM categories cc WHERE cc.parent_id = ct.id AND cc.deleted_at IS NULL) as subcategory_count
      FROM category_tree ct
      ORDER BY ct.sort_path
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  // Search categories
  static async search(
    searchTerm: string,
    includeInactive: boolean = false
  ): Promise<Category[]> {
    let query = `
      SELECT 
        c.*,
        pc.name as parent_name,
        (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.deleted_at IS NULL) as product_count
      FROM categories c
      LEFT JOIN categories pc ON c.parent_id = pc.id
      WHERE c.deleted_at IS NULL
      AND (c.name ILIKE $1 OR c.description ILIKE $1)
    `;

    if (!includeInactive) {
      query += " AND c.is_active = TRUE";
    }

    query += " ORDER BY c.name ASC";

    const result = await pool.query(query, [`%${searchTerm}%`]);
    return result.rows;
  }

  // Soft delete category
  static async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Check if category has products
      const productCheck = await client.query(
        "SELECT COUNT(*) as count FROM products WHERE category_id = $1 AND deleted_at IS NULL",
        [id]
      );

      if (parseInt(productCheck.rows[0].count) > 0) {
        throw new Error("Cannot delete category that contains products");
      }

      // Check if category has subcategories
      const subcategoryCheck = await client.query(
        "SELECT COUNT(*) as count FROM categories WHERE parent_id = $1 AND deleted_at IS NULL",
        [id]
      );

      if (parseInt(subcategoryCheck.rows[0].count) > 0) {
        throw new Error("Cannot delete category that has subcategories");
      }

      // Soft delete the category
      const result = await client.query(
        "UPDATE categories SET deleted_at = NOW(), deleted_by = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL",
        [deletedBy, id]
      );

      await client.query("COMMIT");
      return result.rowCount > 0;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // Restore soft deleted category
  static async restore(id: string): Promise<boolean> {
    const query = `
      UPDATE categories 
      SET deleted_at = NULL, deleted_by = NULL, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NOT NULL
    `;

    const result = await pool.query(query, [id]);
    return result.rowCount > 0;
  }

  // Toggle category active status
  static async toggleActive(id: string): Promise<Category | null> {
    const query = `
      UPDATE categories 
      SET is_active = NOT is_active, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  // Update sort order
  static async updateSortOrder(
    id: string,
    sortOrder: number
  ): Promise<Category | null> {
    const query = `
      UPDATE categories 
      SET sort_order = $1, updated_at = NOW()
      WHERE id = $2 AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await pool.query(query, [sortOrder, id]);
    return result.rows[0] || null;
  }

  // Get categories with product counts
  static async getCategoriesWithProductCounts(): Promise<Category[]> {
    const query = `
      SELECT 
        c.*,
        pc.name as parent_name,
        COUNT(p.id)::INTEGER as product_count,
        COUNT(CASE WHEN p.status = 'published' THEN 1 END)::INTEGER as published_product_count,
        COUNT(CASE WHEN p.quantity <= p.low_stock_threshold AND p.track_quantity = TRUE THEN 1 END)::INTEGER as low_stock_product_count
      FROM categories c
      LEFT JOIN categories pc ON c.parent_id = pc.id
      LEFT JOIN products p ON c.id = p.category_id AND p.deleted_at IS NULL
      WHERE c.deleted_at IS NULL
      GROUP BY c.id, pc.name
      ORDER BY c.sort_order ASC, c.name ASC
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  // Move category to different parent
  static async moveCategory(
    id: string,
    newParentId: string | null
  ): Promise<Category | null> {
    // Prevent circular references
    if (newParentId) {
      const checkQuery = `
        WITH RECURSIVE category_path AS (
          SELECT id, parent_id, 1 as level
          FROM categories 
          WHERE id = $1
          
          UNION ALL
          
          SELECT c.id, c.parent_id, cp.level + 1
          FROM categories c
          INNER JOIN category_path cp ON c.id = cp.parent_id
          WHERE cp.level < 10  -- Prevent infinite recursion
        )
        SELECT COUNT(*) as count
        FROM category_path 
        WHERE id = $2
      `;

      const checkResult = await pool.query(checkQuery, [newParentId, id]);
      if (parseInt(checkResult.rows[0].count) > 0) {
        throw new Error(
          "Cannot move category: would create circular reference"
        );
      }
    }

    const query = `
      UPDATE categories 
      SET parent_id = $1, updated_at = NOW()
      WHERE id = $2 AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await pool.query(query, [newParentId, id]);
    return result.rows[0] || null;
  }

  // Get category path (breadcrumb)
  static async getCategoryPath(id: string): Promise<Category[]> {
    const query = `
      WITH RECURSIVE category_path AS (
        SELECT c.*, 1 as level
        FROM categories c
        WHERE c.id = $1
        
        UNION ALL
        
        SELECT c.*, cp.level + 1
        FROM categories c
        INNER JOIN category_path cp ON c.id = cp.parent_id
      )
      SELECT * FROM category_path 
      ORDER BY level DESC
    `;

    const result = await pool.query(query, [id]);
    return result.rows;
  }

  // Get popular categories (by product count)
  static async getPopularCategories(limit: number = 10): Promise<Category[]> {
    const query = `
      SELECT 
        c.*,
        COUNT(p.id)::INTEGER as product_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id 
        AND p.deleted_at IS NULL 
        AND p.status = 'published'
      WHERE c.deleted_at IS NULL 
      AND c.is_active = TRUE
      GROUP BY c.id
      HAVING COUNT(p.id) > 0
      ORDER BY product_count DESC, c.name ASC
      LIMIT $1
    `;

    const result = await pool.query(query, [limit]);
    return result.rows;
  }

  // Bulk update sort orders
  static async bulkUpdateSortOrders(
    updates: Array<{ id: string; sort_order: number }>
  ): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      for (const update of updates) {
        await client.query(
          "UPDATE categories SET sort_order = $1, updated_at = NOW() WHERE id = $2",
          [update.sort_order, update.id]
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
}
