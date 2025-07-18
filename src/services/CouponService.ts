// src/services/CouponService.ts
import pool from "../config/database";
import { v4 as uuidv4 } from "uuid";
import {
  CouponCode,
  CreateCouponRequest,
  UpdateCouponRequest,
  CouponSearchParams,
  CouponAnalytics,
  CouponStatus,
  CouponValidationRequest,
  CouponValidationResponse,
  DiscountType,
} from "../types/sales-campaign";

export class CouponService {
  // =============================================
  // COUPON CRUD OPERATIONS
  // =============================================

  /**
   * Create a new coupon
   */
  static async createCoupon(
    couponData: CreateCouponRequest,
    createdBy: string
  ): Promise<CouponCode> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const couponId = uuidv4();

      // Check if coupon code already exists
      const existingCouponQuery = `
        SELECT id FROM coupon_codes WHERE code = $1
      `;

      const existingCoupon = await client.query(existingCouponQuery, [
        couponData.code,
      ]);

      if (existingCoupon.rows.length > 0) {
        throw new Error("Coupon code already exists");
      }

      // Create the main coupon
      const couponQuery = `
        INSERT INTO coupon_codes (
          id, campaign_id, code, name, description, discount_type, discount_value,
          max_discount_amount, usage_limit, usage_limit_per_customer, valid_from,
          valid_until, minimum_order_amount, applies_to, created_by, status
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          CASE 
            WHEN $11 IS NULL OR $11 <= NOW() THEN 'active'
            ELSE 'inactive'
          END
        ) RETURNING *
      `;

      const couponResult = await client.query(couponQuery, [
        couponId,
        couponData.campaign_id,
        couponData.code.toUpperCase(),
        couponData.name,
        couponData.description,
        couponData.discount_type,
        couponData.discount_value,
        couponData.max_discount_amount,
        couponData.usage_limit,
        couponData.usage_limit_per_customer,
        couponData.valid_from,
        couponData.valid_until,
        couponData.minimum_order_amount,
        couponData.applies_to,
        createdBy,
      ]);

      const coupon = couponResult.rows[0];

      // Add product associations if specified
      if (couponData.product_ids && couponData.product_ids.length > 0) {
        const productValues = couponData.product_ids
          .map((productId, index) => `(${index * 2 + 1}, ${index * 2 + 2})`)
          .join(", ");

        const productParams = couponData.product_ids.flatMap((productId) => [
          couponId,
          productId,
        ]);

        const productQuery = `
          INSERT INTO coupon_products (coupon_id, product_id)
          VALUES ${productValues}
          ON CONFLICT (coupon_id, product_id) DO NOTHING
        `;

        await client.query(productQuery, productParams);
      }

      // Add category associations if specified
      if (couponData.category_ids && couponData.category_ids.length > 0) {
        const categoryValues = couponData.category_ids
          .map((categoryId, index) => `(${index * 2 + 1}, ${index * 2 + 2})`)
          .join(", ");

        const categoryParams = couponData.category_ids.flatMap((categoryId) => [
          couponId,
          categoryId,
        ]);

        const categoryQuery = `
          INSERT INTO coupon_categories (coupon_id, category_id)
          VALUES ${categoryValues}
          ON CONFLICT (coupon_id, category_id) DO NOTHING
        `;

        await client.query(categoryQuery, categoryParams);
      }

      await client.query("COMMIT");

      return await this.getCouponById(couponId);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get coupon by ID with full details
   */
  static async getCouponById(id: string): Promise<CouponCode | null> {
    const query = `
      SELECT 
        cc.*,
        u.name as created_by_name,
        u2.name as updated_by_name,
        sc.name as campaign_name,
        COALESCE(
          JSON_AGG(
            DISTINCT jsonb_build_object(
              'product_id', p.id,
              'product_name', p.name,
              'product_sku', p.sku
            )
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'
        ) as associated_products,
        COALESCE(
          JSON_AGG(
            DISTINCT jsonb_build_object(
              'category_id', c.id,
              'category_name', c.name,
              'category_slug', c.slug
            )
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'
        ) as associated_categories,
        COALESCE(cu.usage_count, 0) as current_usage_count,
        COALESCE(cu.total_discount_given, 0) as total_discount_given,
        COALESCE(cu.unique_customers, 0) as unique_customers,
        COALESCE(cu.total_orders, 0) as total_orders
      FROM coupon_codes cc
      LEFT JOIN users u ON cc.created_by = u.id
      LEFT JOIN users u2 ON cc.updated_by = u2.id
      LEFT JOIN sales_campaigns sc ON cc.campaign_id = sc.id
      LEFT JOIN coupon_products cp ON cc.id = cp.coupon_id
      LEFT JOIN products p ON cp.product_id = p.id
      LEFT JOIN coupon_categories ccat ON cc.id = ccat.coupon_id
      LEFT JOIN categories c ON ccat.category_id = c.id
      LEFT JOIN LATERAL (
        SELECT 
          COUNT(*)::INTEGER as usage_count,
          COALESCE(SUM(discount_amount), 0) as total_discount_given,
          COUNT(DISTINCT user_id)::INTEGER as unique_customers,
          COUNT(DISTINCT order_id)::INTEGER as total_orders
        FROM coupon_usage 
        WHERE coupon_id = cc.id
      ) cu ON true
      WHERE cc.id = $1
      GROUP BY cc.id, u.name, u2.name, sc.name, cu.usage_count, cu.total_discount_given, cu.unique_customers, cu.total_orders
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    const coupon = result.rows[0];

    // Parse JSON fields
    coupon.associated_products = coupon.associated_products || [];
    coupon.associated_categories = coupon.associated_categories || [];

    return coupon;
  }

  /**
   * Get coupon by code
   */
  static async getCouponByCode(code: string): Promise<CouponCode | null> {
    const query = `
      SELECT cc.*, 
        COALESCE(cu.usage_count, 0) as current_usage_count
      FROM coupon_codes cc
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::INTEGER as usage_count
        FROM coupon_usage 
        WHERE coupon_id = cc.id
      ) cu ON true
      WHERE cc.code = $1
    `;

    const result = await pool.query(query, [code.toUpperCase()]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Update coupon
   */
  static async updateCoupon(
    id: string,
    updateData: UpdateCouponRequest
  ): Promise<CouponCode | null> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Build dynamic update query
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      const allowedFields = [
        "campaign_id",
        "code",
        "name",
        "description",
        "discount_type",
        "discount_value",
        "max_discount_amount",
        "usage_limit",
        "usage_limit_per_customer",
        "valid_from",
        "valid_until",
        "minimum_order_amount",
        "applies_to",
        "status",
      ];

      allowedFields.forEach((field) => {
        if (updateData[field] !== undefined) {
          updateFields.push(`${field} = ${paramIndex}`);
          updateValues.push(
            field === "code"
              ? updateData[field].toUpperCase()
              : updateData[field]
          );
          paramIndex++;
        }
      });

      if (updateFields.length === 0) {
        throw new Error("No valid fields to update");
      }

      // Check if code is being updated and already exists
      if (updateData.code) {
        const existingCouponQuery = `
          SELECT id FROM coupon_codes WHERE code = $1 AND id != $2
        `;

        const existingCoupon = await client.query(existingCouponQuery, [
          updateData.code.toUpperCase(),
          id,
        ]);

        if (existingCoupon.rows.length > 0) {
          throw new Error("Coupon code already exists");
        }
      }

      updateFields.push(`updated_at = NOW()`);
      updateValues.push(id);

      const updateQuery = `
        UPDATE coupon_codes 
        SET ${updateFields.join(", ")}
        WHERE id = ${paramIndex}
        RETURNING *
      `;

      const result = await client.query(updateQuery, updateValues);

      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        return null;
      }

      // Update product associations if provided
      if (updateData.product_ids !== undefined) {
        // Remove existing associations
        await client.query("DELETE FROM coupon_products WHERE coupon_id = $1", [
          id,
        ]);

        // Add new associations
        if (updateData.product_ids.length > 0) {
          const productValues = updateData.product_ids
            .map((productId, index) => `(${index * 2 + 1}, ${index * 2 + 2})`)
            .join(", ");

          const productParams = updateData.product_ids.flatMap((productId) => [
            id,
            productId,
          ]);

          const productQuery = `
            INSERT INTO coupon_products (coupon_id, product_id)
            VALUES ${productValues}
          `;

          await client.query(productQuery, productParams);
        }
      }

      // Update category associations if provided
      if (updateData.category_ids !== undefined) {
        // Remove existing associations
        await client.query(
          "DELETE FROM coupon_categories WHERE coupon_id = $1",
          [id]
        );

        // Add new associations
        if (updateData.category_ids.length > 0) {
          const categoryValues = updateData.category_ids
            .map((categoryId, index) => `(${index * 2 + 1}, ${index * 2 + 2})`)
            .join(", ");

          const categoryParams = updateData.category_ids.flatMap(
            (categoryId) => [id, categoryId]
          );

          const categoryQuery = `
            INSERT INTO coupon_categories (coupon_id, category_id)
            VALUES ${categoryValues}
          `;

          await client.query(categoryQuery, categoryParams);
        }
      }

      await client.query("COMMIT");

      return await this.getCouponById(id);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete coupon (soft delete)
   */
  static async deleteCoupon(id: string): Promise<boolean> {
    const query = `
      UPDATE coupon_codes 
      SET status = 'inactive', updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `;

    const result = await pool.query(query, [id]);
    return result.rows.length > 0;
  }

  // =============================================
  // COUPON SEARCH & FILTERING
  // =============================================

  /**
   * Search coupons with filters
   */
  static async searchCoupons(
    searchParams: CouponSearchParams
  ): Promise<{ coupons: CouponCode[]; total: number }> {
    const conditions = ["1=1"];
    const values = [];
    let paramIndex = 1;

    // Build WHERE conditions
    if (searchParams.search) {
      conditions.push(
        `(cc.code ILIKE ${paramIndex} OR cc.name ILIKE ${paramIndex} OR cc.description ILIKE ${paramIndex})`
      );
      values.push(`%${searchParams.search}%`);
      paramIndex++;
    }

    if (searchParams.status) {
      conditions.push(`cc.status = ${paramIndex}`);
      values.push(searchParams.status);
      paramIndex++;
    }

    if (searchParams.discount_type) {
      conditions.push(`cc.discount_type = ${paramIndex}`);
      values.push(searchParams.discount_type);
      paramIndex++;
    }

    if (searchParams.valid_from) {
      conditions.push(`cc.valid_from >= ${paramIndex}`);
      values.push(searchParams.valid_from);
      paramIndex++;
    }

    if (searchParams.valid_until) {
      conditions.push(`cc.valid_until <= ${paramIndex}`);
      values.push(searchParams.valid_until);
      paramIndex++;
    }

    if (searchParams.created_by) {
      conditions.push(`cc.created_by = ${paramIndex}`);
      values.push(searchParams.created_by);
      paramIndex++;
    }

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM coupon_codes cc
      WHERE ${conditions.join(" AND ")}
    `;

    const countResult = await pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total);

    // Main query
    const sortBy = searchParams.sort_by || "created_at";
    const sortOrder = searchParams.sort_order || "desc";
    const limit = searchParams.limit || 20;
    const offset = searchParams.offset || 0;

    const query = `
      SELECT 
        cc.*,
        u.name as created_by_name,
        sc.name as campaign_name,
        COALESCE(cu.usage_count, 0) as current_usage_count,
        COALESCE(cu.total_discount_given, 0) as total_discount_given,
        COALESCE(cu.unique_customers, 0) as unique_customers
      FROM coupon_codes cc
      LEFT JOIN users u ON cc.created_by = u.id
      LEFT JOIN sales_campaigns sc ON cc.campaign_id = sc.id
      LEFT JOIN LATERAL (
        SELECT 
          COUNT(*)::INTEGER as usage_count,
          COALESCE(SUM(discount_amount), 0) as total_discount_given,
          COUNT(DISTINCT user_id)::INTEGER as unique_customers
        FROM coupon_usage 
        WHERE coupon_id = cc.id
      ) cu ON true
      WHERE ${conditions.join(" AND ")}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT ${paramIndex} OFFSET ${paramIndex + 1}
    `;

    values.push(limit, offset);

    const result = await pool.query(query, values);

    return {
      coupons: result.rows,
      total,
    };
  }

  // =============================================
  // COUPON VALIDATION & APPLICATION
  // =============================================

  /**
   * Validate coupon code
   */
  static async validateCoupon(
    validationData: CouponValidationRequest
  ): Promise<CouponValidationResponse> {
    const coupon = await this.getCouponByCode(validationData.code);

    if (!coupon) {
      return {
        is_valid: false,
        discount_amount: 0,
        error_message: "Coupon code not found",
      };
    }

    // Check status
    if (coupon.status !== "active") {
      return {
        is_valid: false,
        discount_amount: 0,
        error_message: "Coupon is not active",
      };
    }

    // Check validity dates
    const now = new Date();
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
      return {
        is_valid: false,
        discount_amount: 0,
        error_message: "Coupon is not yet valid",
      };
    }

    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      return {
        is_valid: false,
        discount_amount: 0,
        error_message: "Coupon has expired",
      };
    }

    // Check usage limits
    if (
      coupon.usage_limit &&
      coupon.current_usage_count >= coupon.usage_limit
    ) {
      return {
        is_valid: false,
        discount_amount: 0,
        error_message: "Coupon usage limit reached",
      };
    }

    // Check per-customer usage limit
    if (coupon.usage_limit_per_customer && validationData.user_id) {
      const userUsageQuery = `
        SELECT COUNT(*) as user_usage_count
        FROM coupon_usage
        WHERE coupon_id = $1 AND user_id = $2
      `;

      const userUsageResult = await pool.query(userUsageQuery, [
        coupon.id,
        validationData.user_id,
      ]);

      const userUsageCount = parseInt(userUsageResult.rows[0].user_usage_count);

      if (userUsageCount >= coupon.usage_limit_per_customer) {
        return {
          is_valid: false,
          discount_amount: 0,
          error_message:
            "You have already used this coupon the maximum number of times",
        };
      }
    }

    // Check minimum order amount
    if (
      coupon.minimum_order_amount &&
      validationData.order_amount < coupon.minimum_order_amount
    ) {
      return {
        is_valid: false,
        discount_amount: 0,
        error_message: `Minimum order amount of ${coupon.minimum_order_amount} required`,
      };
    }

    // Check applicability
    if (coupon.applies_to === "products" && validationData.product_ids) {
      const applicableProductsQuery = `
        SELECT COUNT(*) as applicable_count
        FROM coupon_products cp
        WHERE cp.coupon_id = $1 AND cp.product_id = ANY($2)
      `;

      const applicableProductsResult = await pool.query(
        applicableProductsQuery,
        [coupon.id, validationData.product_ids]
      );

      const applicableCount = parseInt(
        applicableProductsResult.rows[0].applicable_count
      );

      if (applicableCount === 0) {
        return {
          is_valid: false,
          discount_amount: 0,
          error_message:
            "Coupon is not applicable to any products in your cart",
        };
      }
    }

    if (coupon.applies_to === "categories" && validationData.category_ids) {
      const applicableCategoriesQuery = `
        SELECT COUNT(*) as applicable_count
        FROM coupon_categories cc
        WHERE cc.coupon_id = $1 AND cc.category_id = ANY($2)
      `;

      const applicableCategoriesResult = await pool.query(
        applicableCategoriesQuery,
        [coupon.id, validationData.category_ids]
      );

      const applicableCount = parseInt(
        applicableCategoriesResult.rows[0].applicable_count
      );

      if (applicableCount === 0) {
        return {
          is_valid: false,
          discount_amount: 0,
          error_message:
            "Coupon is not applicable to any categories in your cart",
        };
      }
    }

    // Calculate discount amount
    let discountAmount = 0;

    if (coupon.discount_type === "percentage") {
      discountAmount =
        (validationData.order_amount * coupon.discount_value) / 100;

      if (
        coupon.max_discount_amount &&
        discountAmount > coupon.max_discount_amount
      ) {
        discountAmount = coupon.max_discount_amount;
      }
    } else if (coupon.discount_type === "fixed_amount") {
      discountAmount = Math.min(
        coupon.discount_value,
        validationData.order_amount
      );
    } else if (coupon.discount_type === "free_shipping") {
      // Free shipping discount - this would be handled in shipping calculation
      discountAmount = 0;
    }

    return {
      is_valid: true,
      coupon_id: coupon.id,
      discount_amount: discountAmount,
      coupon_details: {
        name: coupon.name,
        description: coupon.description,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        expires_at: coupon.valid_until,
      },
    };
  }

  /**
   * Apply coupon and track usage
   */
  static async applyCoupon(
    couponId: string,
    userId: string,
    orderId: string,
    originalAmount: number,
    discountAmount: number,
    finalAmount: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Track usage
      const usageQuery = `
        INSERT INTO coupon_usage (
          coupon_id, user_id, order_id, original_amount, 
          discount_amount, final_amount, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `;

      await client.query(usageQuery, [
        couponId,
        userId,
        orderId,
        originalAmount,
        discountAmount,
        finalAmount,
        ipAddress,
        userAgent,
      ]);

      // Update coupon usage count
      await client.query(
        "UPDATE coupon_codes SET usage_count = usage_count + 1 WHERE id = $1",
        [couponId]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // =============================================
  // COUPON ANALYTICS & REPORTING
  // =============================================

  /**
   * Get coupon analytics
   */
  static async getCouponAnalytics(couponId: string): Promise<CouponAnalytics> {
    const query = `
      SELECT 
        COUNT(cu.id)::INTEGER as total_usage,
        COALESCE(SUM(cu.final_amount), 0) as total_revenue,
        COALESCE(SUM(cu.discount_amount), 0) as total_discount_given,
        COUNT(DISTINCT cu.user_id)::INTEGER as unique_customers,
        COALESCE(AVG(cu.final_amount), 0) as average_order_value,
        CASE 
          WHEN COUNT(cu.id) > 0 THEN 
            (COUNT(DISTINCT cu.user_id)::DECIMAL / COUNT(cu.id) * 100)
          ELSE 0 
        END as conversion_rate,
        MIN(cu.used_at) as first_use_date,
        MAX(cu.used_at) as last_use_date
      FROM coupon_usage cu
      WHERE cu.coupon_id = $1
    `;

    const result = await pool.query(query, [couponId]);
    const analytics = result.rows[0];

    // Get daily usage data for the last 30 days
    const timeSeriesQuery = `
      SELECT 
        DATE(cu.used_at) as date,
        COUNT(cu.id)::INTEGER as usage_count,
        COALESCE(SUM(cu.final_amount), 0) as revenue,
        COALESCE(SUM(cu.discount_amount), 0) as discount_given,
        COUNT(DISTINCT cu.user_id)::INTEGER as unique_customers
      FROM coupon_usage cu
      WHERE cu.coupon_id = $1
      AND cu.used_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(cu.used_at)
      ORDER BY DATE(cu.used_at)
    `;

    const timeSeriesResult = await pool.query(timeSeriesQuery, [couponId]);

    return {
      ...analytics,
      daily_usage: timeSeriesResult.rows,
    };
  }

  // =============================================
  // COUPON STATUS MANAGEMENT
  // =============================================

  /**
   * Update coupon status
   */
  static async updateCouponStatus(
    id: string,
    status: CouponStatus
  ): Promise<CouponCode | null> {
    const query = `
      UPDATE coupon_codes 
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [status, id]);

    if (result.rows.length === 0) {
      return null;
    }

    return await this.getCouponById(id);
  }

  /**
   * Auto-update coupon statuses based on dates and usage
   */
  static async updateCouponStatuses(): Promise<void> {
    const queries = [
      // Activate coupons that should be active
      `UPDATE coupon_codes 
       SET status = 'active', updated_at = NOW()
       WHERE status = 'inactive' 
       AND (valid_from IS NULL OR valid_from <= NOW())
       AND (valid_until IS NULL OR valid_until >= NOW())`,

      // Expire coupons that have passed their validity date
      `UPDATE coupon_codes 
       SET status = 'expired', updated_at = NOW()
       WHERE status = 'active' AND valid_until < NOW()`,

      // Mark coupons as used up if they've reached their usage limit
      `UPDATE coupon_codes 
       SET status = 'used_up', updated_at = NOW()
       WHERE status = 'active' 
       AND usage_limit IS NOT NULL 
       AND usage_count >= usage_limit`,
    ];

    for (const query of queries) {
      await pool.query(query);
    }
  }

  /**
   * Get expiring coupons
   */
  static async getExpiringCoupons(days: number = 7): Promise<CouponCode[]> {
    const query = `
      SELECT cc.*, u.name as created_by_name,
        COALESCE(cu.usage_count, 0) as current_usage_count
      FROM coupon_codes cc
      LEFT JOIN users u ON cc.created_by = u.id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::INTEGER as usage_count
        FROM coupon_usage 
        WHERE coupon_id = cc.id
      ) cu ON true
      WHERE cc.status = 'active'
      AND cc.valid_until IS NOT NULL
      AND cc.valid_until <= NOW() + INTERVAL '${days} days'
      ORDER BY cc.valid_until ASC
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Get most popular coupons
   */
  static async getMostPopularCoupons(
    limit: number = 10
  ): Promise<CouponCode[]> {
    const query = `
      SELECT cc.*, u.name as created_by_name,
        COALESCE(cu.usage_count, 0) as current_usage_count,
        COALESCE(cu.total_discount_given, 0) as total_discount_given
      FROM coupon_codes cc
      LEFT JOIN users u ON cc.created_by = u.id
      LEFT JOIN LATERAL (
        SELECT 
          COUNT(*)::INTEGER as usage_count,
          COALESCE(SUM(discount_amount), 0) as total_discount_given
        FROM coupon_usage 
        WHERE coupon_id = cc.id
      ) cu ON true
      WHERE cc.status = 'active'
      ORDER BY cu.usage_count DESC
      LIMIT $1
    `;

    const result = await pool.query(query, [limit]);
    return result.rows;
  }

  /**
   * Generate bulk coupons
   */
  static async generateBulkCoupons(
    baseData: CreateCouponRequest,
    count: number,
    prefix: string = "BULK",
    createdBy: string
  ): Promise<CouponCode[]> {
    const client = await pool.connect();
    const createdCoupons = [];

    try {
      await client.query("BEGIN");

      for (let i = 0; i < count; i++) {
        const couponCode = `${prefix}${Date.now()}${i
          .toString()
          .padStart(3, "0")}`;

        const couponData = {
          ...baseData,
          code: couponCode,
          name: `${baseData.name} #${i + 1}`,
        };

        const coupon = await this.createCoupon(couponData, createdBy);
        createdCoupons.push(coupon);
      }

      await client.query("COMMIT");

      return createdCoupons;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get coupon dashboard statistics
   */
  static async getDashboardStats(): Promise<{
    total_active_coupons: number;
    coupons_redeemed_today: number;
    total_discount_given: number;
    most_popular_coupons: Array<{
      id: string;
      code: string;
      name: string;
      redemption_count: number;
      discount_given: number;
    }>;
  }> {
    const query = `
      WITH coupon_stats AS (
        SELECT 
          COUNT(*) FILTER (WHERE status = 'active' AND (valid_from IS NULL OR valid_from <= NOW()) AND (valid_until IS NULL OR valid_until >= NOW())) as active_coupons,
          COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) as coupons_created_today
        FROM coupon_codes
      ),
      usage_stats AS (
        SELECT 
          COALESCE(SUM(discount_amount), 0) as total_discount,
          COUNT(*) FILTER (WHERE DATE(used_at) = CURRENT_DATE) as redeemed_today
        FROM coupon_usage
      ),
      popular_coupons AS (
        SELECT 
          cc.id,
          cc.code,
          cc.name,
          COUNT(cu.id) as redemption_count,
          COALESCE(SUM(cu.discount_amount), 0) as discount_given
        FROM coupon_codes cc
        LEFT JOIN coupon_usage cu ON cc.id = cu.coupon_id
        WHERE cc.status = 'active'
        GROUP BY cc.id, cc.code, cc.name
        ORDER BY redemption_count DESC
        LIMIT 5
      )
      SELECT 
        cs.active_coupons::INTEGER as total_active_coupons,
        us.redeemed_today::INTEGER as coupons_redeemed_today,
        us.total_discount,
        COALESCE(JSON_AGG(
          jsonb_build_object(
            'id', pc.id,
            'code', pc.code,
            'name', pc.name,
            'redemption_count', pc.redemption_count,
            'discount_given', pc.discount_given
          )
        ) FILTER (WHERE pc.id IS NOT NULL), '[]') as most_popular_coupons
      FROM coupon_stats cs
      CROSS JOIN usage_stats us
      LEFT JOIN popular_coupons pc ON true
      GROUP BY cs.active_coupons, us.redeemed_today, us.total_discount
    `;

    const result = await pool.query(query);
    const stats = result.rows[0];

    return {
      total_active_coupons: stats.total_active_coupons,
      coupons_redeemed_today: stats.coupons_redeemed_today,
      total_discount_given: parseFloat(stats.total_discount),
      most_popular_coupons: stats.most_popular_coupons,
    };
  }

  /**
   * Get applicable coupons for user
   */
  static async getApplicableCoupons(
    userId: string,
    orderAmount: number,
    productIds?: string[],
    categoryIds?: string[]
  ): Promise<CouponCode[]> {
    const query = `
      SELECT DISTINCT cc.*, 
        COALESCE(cu.user_usage_count, 0) as user_usage_count,
        COALESCE(cu.total_usage_count, 0) as total_usage_count
      FROM coupon_codes cc
      LEFT JOIN LATERAL (
        SELECT 
          COUNT(*) FILTER (WHERE user_id = $1)::INTEGER as user_usage_count,
          COUNT(*)::INTEGER as total_usage_count
        FROM coupon_usage 
        WHERE coupon_id = cc.id
      ) cu ON true
      LEFT JOIN coupon_products cp ON cc.id = cp.coupon_id
      LEFT JOIN coupon_categories ccat ON cc.id = ccat.coupon_id
      WHERE cc.status = 'active'
      AND (cc.valid_from IS NULL OR cc.valid_from <= NOW())
      AND (cc.valid_until IS NULL OR cc.valid_until >= NOW())
      AND (cc.minimum_order_amount IS NULL OR cc.minimum_order_amount <= $2)
      AND (cc.usage_limit IS NULL OR cu.total_usage_count < cc.usage_limit)
      AND (cc.usage_limit_per_customer IS NULL OR cu.user_usage_count < cc.usage_limit_per_customer)
      AND (
        cc.applies_to = 'all' OR
        (cc.applies_to = 'products' AND cp.product_id = ANY($3)) OR
        (cc.applies_to = 'categories' AND ccat.category_id = ANY($4))
      )
      ORDER BY cc.discount_value DESC
    `;

    const result = await pool.query(query, [
      userId,
      orderAmount,
      productIds || [],
      categoryIds || [],
    ]);

    return result.rows;
  }

  /**
   * Get coupon usage history for user
   */
  static async getUserCouponHistory(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{
    history: Array<{
      coupon_code: string;
      coupon_name: string;
      discount_amount: number;
      order_id: string;
      used_at: Date;
    }>;
    total: number;
  }> {
    const countQuery = `
      SELECT COUNT(*) as total
      FROM coupon_usage cu
      JOIN coupon_codes cc ON cu.coupon_id = cc.id
      WHERE cu.user_id = $1
    `;

    const countResult = await pool.query(countQuery, [userId]);
    const total = parseInt(countResult.rows[0].total);

    const historyQuery = `
      SELECT 
        cc.code as coupon_code,
        cc.name as coupon_name,
        cu.discount_amount,
        cu.order_id,
        cu.used_at
      FROM coupon_usage cu
      JOIN coupon_codes cc ON cu.coupon_id = cc.id
      WHERE cu.user_id = $1
      ORDER BY cu.used_at DESC
      LIMIT $2 OFFSET $3
    `;

    const historyResult = await pool.query(historyQuery, [
      userId,
      limit,
      offset,
    ]);

    return {
      history: historyResult.rows,
      total,
    };
  }

  /**
   * Validate multiple coupons (for stacking)
   */
  static async validateMultipleCoupons(
    codes: string[],
    userId: string,
    orderAmount: number,
    productIds?: string[],
    categoryIds?: string[]
  ): Promise<
    Array<{
      code: string;
      validation: CouponValidationResponse;
    }>
  > {
    const validations = [];

    for (const code of codes) {
      const validation = await this.validateCoupon({
        code,
        user_id: userId,
        order_amount: orderAmount,
        product_ids: productIds,
        category_ids: categoryIds,
      });

      validations.push({
        code,
        validation,
      });
    }

    return validations;
  }

  /**
   * Check if user can use coupon
   */
  static async canUserUseCoupon(
    couponId: string,
    userId: string
  ): Promise<boolean> {
    const coupon = await this.getCouponById(couponId);

    if (!coupon || coupon.status !== "active") {
      return false;
    }

    // Check per-customer usage limit
    if (coupon.usage_limit_per_customer) {
      const userUsageQuery = `
        SELECT COUNT(*) as user_usage_count
        FROM coupon_usage
        WHERE coupon_id = $1 AND user_id = $2
      `;

      const userUsageResult = await pool.query(userUsageQuery, [
        couponId,
        userId,
      ]);
      const userUsageCount = parseInt(userUsageResult.rows[0].user_usage_count);

      if (userUsageCount >= coupon.usage_limit_per_customer) {
        return false;
      }
    }

    return true;
  }

  /**
   * Generate unique coupon code
   */
  static async generateUniqueCouponCode(
    prefix: string = "COUPON",
    length: number = 8
  ): Promise<string> {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      let code = prefix;

      for (let i = 0; i < length; i++) {
        code += characters.charAt(
          Math.floor(Math.random() * characters.length)
        );
      }

      // Check if code already exists
      const existingCoupon = await this.getCouponByCode(code);

      if (!existingCoupon) {
        return code;
      }

      attempts++;
    }

    throw new Error(
      "Failed to generate unique coupon code after maximum attempts"
    );
  }

  /**
   * Export coupons to CSV
   */
  static async exportCoupons(
    searchParams: CouponSearchParams
  ): Promise<string> {
    const result = await this.searchCoupons({
      ...searchParams,
      limit: 10000, // Large limit for export
      offset: 0,
    });

    const csvHeaders = [
      "Code",
      "Name",
      "Description",
      "Discount Type",
      "Discount Value",
      "Max Discount Amount",
      "Usage Limit",
      "Usage Count",
      "Valid From",
      "Valid Until",
      "Minimum Order Amount",
      "Applies To",
      "Status",
      "Created At",
      "Created By",
    ];

    const csvRows = result.coupons.map((coupon) => [
      coupon.code,
      coupon.name,
      coupon.description || "",
      coupon.discount_type,
      coupon.discount_value,
      coupon.max_discount_amount || "",
      coupon.usage_limit || "",
      coupon.current_usage_count || 0,
      coupon.valid_from ? new Date(coupon.valid_from).toISOString() : "",
      coupon.valid_until ? new Date(coupon.valid_until).toISOString() : "",
      coupon.minimum_order_amount || "",
      coupon.applies_to,
      coupon.status,
      new Date(coupon.created_at).toISOString(),
      coupon.created_by_name || "",
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    return csvContent;
  }
}
