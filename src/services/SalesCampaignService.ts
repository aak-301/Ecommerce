// src/services/SalesCampaignService.ts
import pool from "../config/database";
import { v4 as uuidv4 } from "uuid";
import {
  SalesCampaign,
  CreateCampaignRequest,
  UpdateCampaignRequest,
  CampaignSearchParams,
  CampaignAnalytics,
  CampaignStatus,
  ApplyCampaignRequest,
  CampaignPerformanceReport,
  SalesDashboardStats,
} from "../types/sales-campaign";

export class SalesCampaignService {
  // =============================================
  // CAMPAIGN CRUD OPERATIONS
  // =============================================

  /**
   * Create a new sales campaign
   */
  static async createCampaign(
    campaignData: CreateCampaignRequest,
    createdBy: string
  ): Promise<SalesCampaign> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const campaignId = uuidv4();

      // Create the main campaign
      const campaignQuery = `
        INSERT INTO sales_campaigns (
          id, name, description, campaign_type, start_date, end_date,
          discount_type, discount_value, max_discount_amount, usage_limit,
          usage_limit_per_customer, minimum_order_amount, minimum_quantity,
          applies_to, configuration, created_by, status
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
          CASE 
            WHEN $5 <= NOW() THEN 'active'
            ELSE 'scheduled'
          END
        ) RETURNING *
      `;

      const campaignResult = await client.query(campaignQuery, [
        campaignId,
        campaignData.name,
        campaignData.description,
        campaignData.campaign_type,
        campaignData.start_date,
        campaignData.end_date,
        campaignData.discount_type,
        campaignData.discount_value,
        campaignData.max_discount_amount,
        campaignData.usage_limit,
        campaignData.usage_limit_per_customer,
        campaignData.minimum_order_amount,
        campaignData.minimum_quantity,
        campaignData.applies_to,
        campaignData.configuration
          ? JSON.stringify(campaignData.configuration)
          : null,
        createdBy,
      ]);

      const campaign = campaignResult.rows[0];

      // Add product associations if specified
      if (campaignData.product_ids && campaignData.product_ids.length > 0) {
        const productValues = campaignData.product_ids
          .map((productId, index) => `($${index * 2 + 1}, $${index * 2 + 2})`)
          .join(", ");

        const productParams = campaignData.product_ids.flatMap((productId) => [
          campaignId,
          productId,
        ]);

        const productQuery = `
          INSERT INTO campaign_products (campaign_id, product_id)
          VALUES ${productValues}
          ON CONFLICT (campaign_id, product_id) DO NOTHING
        `;

        await client.query(productQuery, productParams);
      }

      // Add category associations if specified
      if (campaignData.category_ids && campaignData.category_ids.length > 0) {
        const categoryValues = campaignData.category_ids
          .map((categoryId, index) => `($${index * 2 + 1}, $${index * 2 + 2})`)
          .join(", ");

        const categoryParams = campaignData.category_ids.flatMap(
          (categoryId) => [campaignId, categoryId]
        );

        const categoryQuery = `
          INSERT INTO campaign_categories (campaign_id, category_id)
          VALUES ${categoryValues}
          ON CONFLICT (campaign_id, category_id) DO NOTHING
        `;

        await client.query(categoryQuery, categoryParams);
      }

      await client.query("COMMIT");

      return await this.getCampaignById(campaignId);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get campaign by ID with full details
   */
  static async getCampaignById(id: string): Promise<SalesCampaign | null> {
    const query = `
      SELECT 
        sc.*,
        u.name as created_by_name,
        u2.name as updated_by_name,
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
        COALESCE(cu.total_revenue, 0) as total_revenue,
        COALESCE(cu.total_discount_given, 0) as total_discount_given,
        COALESCE(cu.unique_customers, 0) as unique_customers
      FROM sales_campaigns sc
      LEFT JOIN users u ON sc.created_by = u.id
      LEFT JOIN users u2 ON sc.updated_by = u2.id
      LEFT JOIN campaign_products cp ON sc.id = cp.campaign_id
      LEFT JOIN products p ON cp.product_id = p.id
      LEFT JOIN campaign_categories cc ON sc.id = cc.campaign_id
      LEFT JOIN categories c ON cc.category_id = c.id
      LEFT JOIN LATERAL (
        SELECT 
          COUNT(*)::INTEGER as usage_count,
          COALESCE(SUM(final_amount), 0) as total_revenue,
          COALESCE(SUM(discount_amount), 0) as total_discount_given,
          COUNT(DISTINCT user_id)::INTEGER as unique_customers
        FROM campaign_usage 
        WHERE campaign_id = sc.id
      ) cu ON true
      WHERE sc.id = $1
      GROUP BY sc.id, u.name, u2.name, cu.usage_count, cu.total_revenue, cu.total_discount_given, cu.unique_customers
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    const campaign = result.rows[0];

    // Parse JSON fields
    campaign.configuration = campaign.configuration
      ? JSON.parse(campaign.configuration)
      : {};
    campaign.associated_products = campaign.associated_products || [];
    campaign.associated_categories = campaign.associated_categories || [];

    return campaign;
  }

  /**
   * Update campaign
   */
  static async updateCampaign(
    id: string,
    updateData: UpdateCampaignRequest
  ): Promise<SalesCampaign | null> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Build dynamic update query
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      const allowedFields = [
        "name",
        "description",
        "campaign_type",
        "start_date",
        "end_date",
        "discount_type",
        "discount_value",
        "max_discount_amount",
        "usage_limit",
        "usage_limit_per_customer",
        "minimum_order_amount",
        "minimum_quantity",
        "applies_to",
        "configuration",
        "status",
      ];

      allowedFields.forEach((field) => {
        if (updateData[field] !== undefined) {
          updateFields.push(`${field} = $${paramIndex}`);
          updateValues.push(
            field === "configuration" && updateData[field]
              ? JSON.stringify(updateData[field])
              : updateData[field]
          );
          paramIndex++;
        }
      });

      if (updateFields.length === 0) {
        throw new Error("No valid fields to update");
      }

      updateFields.push(`updated_at = NOW()`);
      updateValues.push(id);

      const updateQuery = `
        UPDATE sales_campaigns 
        SET ${updateFields.join(", ")}
        WHERE id = $${paramIndex}
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
        await client.query(
          "DELETE FROM campaign_products WHERE campaign_id = $1",
          [id]
        );

        // Add new associations
        if (updateData.product_ids.length > 0) {
          const productValues = updateData.product_ids
            .map((productId, index) => `($${index * 2 + 1}, $${index * 2 + 2})`)
            .join(", ");

          const productParams = updateData.product_ids.flatMap((productId) => [
            id,
            productId,
          ]);

          const productQuery = `
            INSERT INTO campaign_products (campaign_id, product_id)
            VALUES ${productValues}
          `;

          await client.query(productQuery, productParams);
        }
      }

      // Update category associations if provided
      if (updateData.category_ids !== undefined) {
        // Remove existing associations
        await client.query(
          "DELETE FROM campaign_categories WHERE campaign_id = $1",
          [id]
        );

        // Add new associations
        if (updateData.category_ids.length > 0) {
          const categoryValues = updateData.category_ids
            .map(
              (categoryId, index) => `($${index * 2 + 1}, $${index * 2 + 2})`
            )
            .join(", ");

          const categoryParams = updateData.category_ids.flatMap(
            (categoryId) => [id, categoryId]
          );

          const categoryQuery = `
            INSERT INTO campaign_categories (campaign_id, category_id)
            VALUES ${categoryValues}
          `;

          await client.query(categoryQuery, categoryParams);
        }
      }

      await client.query("COMMIT");

      return await this.getCampaignById(id);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete campaign (soft delete)
   */
  static async deleteCampaign(id: string): Promise<boolean> {
    const query = `
      UPDATE sales_campaigns 
      SET status = 'inactive', updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `;

    const result = await pool.query(query, [id]);
    return result.rows.length > 0;
  }

  // =============================================
  // CAMPAIGN SEARCH & FILTERING
  // =============================================

  /**
   * Search campaigns with filters
   */
  static async searchCampaigns(
    searchParams: CampaignSearchParams
  ): Promise<{ campaigns: SalesCampaign[]; total: number }> {
    const conditions = ["1=1"];
    const values = [];
    let paramIndex = 1;

    // Build WHERE conditions
    if (searchParams.search) {
      conditions.push(
        `(sc.name ILIKE $${paramIndex} OR sc.description ILIKE $${paramIndex})`
      );
      values.push(`%${searchParams.search}%`);
      paramIndex++;
    }

    if (searchParams.status) {
      conditions.push(`sc.status = $${paramIndex}`);
      values.push(searchParams.status);
      paramIndex++;
    }

    if (searchParams.campaign_type) {
      conditions.push(`sc.campaign_type = $${paramIndex}`);
      values.push(searchParams.campaign_type);
      paramIndex++;
    }

    if (searchParams.start_date_from) {
      conditions.push(`sc.start_date >= $${paramIndex}`);
      values.push(searchParams.start_date_from);
      paramIndex++;
    }

    if (searchParams.start_date_to) {
      conditions.push(`sc.start_date <= $${paramIndex}`);
      values.push(searchParams.start_date_to);
      paramIndex++;
    }

    if (searchParams.end_date_from) {
      conditions.push(`sc.end_date >= $${paramIndex}`);
      values.push(searchParams.end_date_from);
      paramIndex++;
    }

    if (searchParams.end_date_to) {
      conditions.push(`sc.end_date <= $${paramIndex}`);
      values.push(searchParams.end_date_to);
      paramIndex++;
    }

    if (searchParams.created_by) {
      conditions.push(`sc.created_by = $${paramIndex}`);
      values.push(searchParams.created_by);
      paramIndex++;
    }

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM sales_campaigns sc
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
        sc.*,
        u.name as created_by_name,
        COALESCE(cu.usage_count, 0) as current_usage_count,
        COALESCE(cu.total_revenue, 0) as total_revenue,
        COALESCE(cu.total_discount_given, 0) as total_discount_given,
        COALESCE(cu.unique_customers, 0) as unique_customers
      FROM sales_campaigns sc
      LEFT JOIN users u ON sc.created_by = u.id
      LEFT JOIN LATERAL (
        SELECT 
          COUNT(*)::INTEGER as usage_count,
          COALESCE(SUM(final_amount), 0) as total_revenue,
          COALESCE(SUM(discount_amount), 0) as total_discount_given,
          COUNT(DISTINCT user_id)::INTEGER as unique_customers
        FROM campaign_usage 
        WHERE campaign_id = sc.id
      ) cu ON true
      WHERE ${conditions.join(" AND ")}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(limit, offset);

    const result = await pool.query(query, values);

    // Parse JSON fields
    const campaigns = result.rows.map((campaign) => ({
      ...campaign,
      configuration: campaign.configuration
        ? JSON.parse(campaign.configuration)
        : {},
    }));

    return {
      campaigns,
      total,
    };
  }

  // =============================================
  // CAMPAIGN APPLICATION & VALIDATION
  // =============================================

  /**
   * Get active campaigns for product/category
   */
  static async getActiveCampaigns(
    productIds?: string[],
    categoryIds?: string[]
  ): Promise<SalesCampaign[]> {
    const conditions = [
      "sc.status = 'active'",
      "sc.start_date <= NOW()",
      "sc.end_date >= NOW()",
    ];

    const values = [];
    let paramIndex = 1;

    if (productIds && productIds.length > 0) {
      conditions.push(`(
        sc.applies_to = 'all' OR 
        (sc.applies_to = 'products' AND cp.product_id = ANY($${paramIndex}))
      )`);
      values.push(productIds);
      paramIndex++;
    }

    if (categoryIds && categoryIds.length > 0) {
      conditions.push(`(
        sc.applies_to = 'all' OR 
        (sc.applies_to = 'categories' AND cc.category_id = ANY($${paramIndex}))
      )`);
      values.push(categoryIds);
      paramIndex++;
    }

    const query = `
      SELECT DISTINCT sc.*,
        u.name as created_by_name,
        COALESCE(cu.usage_count, 0) as current_usage_count
      FROM sales_campaigns sc
      LEFT JOIN users u ON sc.created_by = u.id
      LEFT JOIN campaign_products cp ON sc.id = cp.campaign_id
      LEFT JOIN campaign_categories cc ON sc.id = cc.campaign_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::INTEGER as usage_count
        FROM campaign_usage 
        WHERE campaign_id = sc.id
      ) cu ON true
      WHERE ${conditions.join(" AND ")}
      AND (sc.usage_limit IS NULL OR cu.usage_count < sc.usage_limit)
      ORDER BY sc.discount_value DESC
    `;

    const result = await pool.query(query, values);

    return result.rows.map((campaign) => ({
      ...campaign,
      configuration: campaign.configuration
        ? JSON.parse(campaign.configuration)
        : {},
    }));
  }

  /**
   * Calculate campaign discount
   */
  static async calculateCampaignDiscount(
    campaignId: string,
    originalAmount: number,
    quantity: number = 1
  ): Promise<{ discount_amount: number; final_amount: number }> {
    const campaign = await this.getCampaignById(campaignId);

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    if (campaign.status !== "active") {
      throw new Error("Campaign is not active");
    }

    const now = new Date();
    if (
      new Date(campaign.start_date) > now ||
      new Date(campaign.end_date) < now
    ) {
      throw new Error("Campaign is not currently active");
    }

    // Check usage limits
    if (
      campaign.usage_limit &&
      campaign.current_usage_count >= campaign.usage_limit
    ) {
      throw new Error("Campaign usage limit reached");
    }

    // Check minimum requirements
    if (
      campaign.minimum_order_amount &&
      originalAmount < campaign.minimum_order_amount
    ) {
      throw new Error(
        `Minimum order amount of ${campaign.minimum_order_amount} required`
      );
    }

    if (campaign.minimum_quantity && quantity < campaign.minimum_quantity) {
      throw new Error(
        `Minimum quantity of ${campaign.minimum_quantity} required`
      );
    }

    let discountAmount = 0;

    if (campaign.discount_type === "percentage") {
      discountAmount = (originalAmount * campaign.discount_value) / 100;

      if (
        campaign.max_discount_amount &&
        discountAmount > campaign.max_discount_amount
      ) {
        discountAmount = campaign.max_discount_amount;
      }
    } else if (campaign.discount_type === "fixed_amount") {
      discountAmount = Math.min(campaign.discount_value, originalAmount);
    }

    const finalAmount = Math.max(0, originalAmount - discountAmount);

    return {
      discount_amount: discountAmount,
      final_amount: finalAmount,
    };
  }

  /**
   * Apply campaign discount and track usage
   */
  static async applyCampaignDiscount(
    applicationData: ApplyCampaignRequest
  ): Promise<{ discount_amount: number; final_amount: number }> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const discount = await this.calculateCampaignDiscount(
        applicationData.campaign_id,
        applicationData.original_amount
      );

      // Track usage
      const usageQuery = `
        INSERT INTO campaign_usage (
          campaign_id, user_id, order_id, original_amount, 
          discount_amount, final_amount, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `;

      await client.query(usageQuery, [
        applicationData.campaign_id,
        applicationData.user_id,
        applicationData.order_id,
        applicationData.original_amount,
        discount.discount_amount,
        discount.final_amount,
        applicationData.ip_address,
        applicationData.user_agent,
      ]);

      // Update campaign usage count
      await client.query(
        "UPDATE sales_campaigns SET usage_count = usage_count + 1 WHERE id = $1",
        [applicationData.campaign_id]
      );

      await client.query("COMMIT");

      return discount;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // =============================================
  // CAMPAIGN ANALYTICS & REPORTING
  // =============================================

  /**
   * Get campaign analytics
   */
  static async getCampaignAnalytics(
    campaignId: string
  ): Promise<CampaignAnalytics> {
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
      FROM campaign_usage cu
      WHERE cu.campaign_id = $1
    `;

    const result = await pool.query(query, [campaignId]);
    const analytics = result.rows[0];

    // Get daily usage data for the last 30 days
    const timeSeriesQuery = `
      SELECT 
        DATE(cu.used_at) as date,
        COUNT(cu.id)::INTEGER as usage_count,
        COALESCE(SUM(cu.final_amount), 0) as revenue,
        COUNT(DISTINCT cu.user_id)::INTEGER as unique_customers
      FROM campaign_usage cu
      WHERE cu.campaign_id = $1
      AND cu.used_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(cu.used_at)
      ORDER BY DATE(cu.used_at)
    `;

    const timeSeriesResult = await pool.query(timeSeriesQuery, [campaignId]);

    return {
      ...analytics,
      daily_usage: timeSeriesResult.rows,
    };
  }

  /**
   * Get campaign performance report
   */
  static async getCampaignPerformanceReport(
    campaignId: string
  ): Promise<CampaignPerformanceReport> {
    const campaign = await this.getCampaignById(campaignId);

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    const analytics = await this.getCampaignAnalytics(campaignId);

    return {
      campaign,
      analytics,
    };
  }

  /**
   * Get dashboard statistics
   */
  static async getDashboardStats(): Promise<SalesDashboardStats> {
    const query = `
      WITH campaign_stats AS (
        SELECT 
          COUNT(*) FILTER (WHERE status = 'active' AND start_date <= NOW() AND end_date >= NOW()) as active_campaigns,
          COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) as campaigns_created_today
        FROM sales_campaigns
      ),
      usage_stats AS (
        SELECT 
          COALESCE(SUM(final_amount), 0) as total_revenue,
          COALESCE(SUM(discount_amount), 0) as total_discounts,
          COUNT(*) FILTER (WHERE DATE(used_at) = CURRENT_DATE) as used_today
        FROM campaign_usage
      ),
      top_campaigns AS (
        SELECT 
          sc.id,
          sc.name,
          COALESCE(SUM(cu.final_amount), 0) as revenue,
          COUNT(cu.id) as usage_count
        FROM sales_campaigns sc
        LEFT JOIN campaign_usage cu ON sc.id = cu.campaign_id
        WHERE sc.status = 'active'
        GROUP BY sc.id, sc.name
        ORDER BY revenue DESC
        LIMIT 5
      )
      SELECT 
        cs.active_campaigns::INTEGER as total_active_campaigns,
        cs.campaigns_created_today::INTEGER as campaigns_created_today,
        us.total_revenue,
        us.total_discounts,
        us.used_today::INTEGER as campaigns_used_today,
        COALESCE(JSON_AGG(
          jsonb_build_object(
            'id', tc.id,
            'name', tc.name,
            'revenue', tc.revenue,
            'usage_count', tc.usage_count
          )
        ) FILTER (WHERE tc.id IS NOT NULL), '[]') as top_performing_campaigns
      FROM campaign_stats cs
      CROSS JOIN usage_stats us
      LEFT JOIN top_campaigns tc ON true
      GROUP BY cs.active_campaigns, cs.campaigns_created_today, us.total_revenue, us.total_discounts, us.used_today
    `;

    const result = await pool.query(query);
    const stats = result.rows[0];

    return {
      total_active_campaigns: stats.total_active_campaigns,
      total_active_coupons: 0, // This will be filled by CouponService
      total_active_bogo_offers: 0, // This will be filled by BogoService
      total_revenue_with_promotions: parseFloat(stats.total_revenue),
      total_discounts_given: parseFloat(stats.total_discounts),
      promotion_revenue_percentage: 0,
      campaigns_used_today: stats.campaigns_used_today,
      coupons_redeemed_today: 0,
      bogo_offers_used_today: 0,
      top_performing_campaigns: stats.top_performing_campaigns,
      top_redeemed_coupons: [],
    };
  }

  // =============================================
  // CAMPAIGN STATUS MANAGEMENT
  // =============================================

  /**
   * Update campaign status
   */
  static async updateCampaignStatus(
    id: string,
    status: CampaignStatus
  ): Promise<SalesCampaign | null> {
    const query = `
      UPDATE sales_campaigns 
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [status, id]);

    if (result.rows.length === 0) {
      return null;
    }

    return await this.getCampaignById(id);
  }

  /**
   * Auto-update campaign statuses based on dates
   */
  static async updateCampaignStatuses(): Promise<void> {
    const queries = [
      // Activate scheduled campaigns
      `UPDATE sales_campaigns 
       SET status = 'active', updated_at = NOW()
       WHERE status = 'scheduled' AND start_date <= NOW()`,

      // Expire active campaigns
      `UPDATE sales_campaigns 
       SET status = 'expired', updated_at = NOW()
       WHERE status = 'active' AND end_date < NOW()`,
    ];

    for (const query of queries) {
      await pool.query(query);
    }
  }

  /**
   * Get expiring campaigns
   */
  static async getExpiringCampaigns(
    days: number = 7
  ): Promise<SalesCampaign[]> {
    const query = `
      SELECT sc.*, u.name as created_by_name
      FROM sales_campaigns sc
      LEFT JOIN users u ON sc.created_by = u.id
      WHERE sc.status = 'active'
      AND sc.end_date <= NOW() + INTERVAL '${days} days'
      ORDER BY sc.end_date ASC
    `;

    const result = await pool.query(query);

    return result.rows.map((campaign) => ({
      ...campaign,
      configuration: campaign.configuration
        ? JSON.parse(campaign.configuration)
        : {},
    }));
  }

  /**
   * Get most popular campaigns
   */
  static async getMostPopularCampaigns(
    limit: number = 10
  ): Promise<SalesCampaign[]> {
    const query = `
      SELECT sc.*, u.name as created_by_name,
        COALESCE(cu.usage_count, 0) as current_usage_count
      FROM sales_campaigns sc
      LEFT JOIN users u ON sc.created_by = u.id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::INTEGER as usage_count
        FROM campaign_usage 
        WHERE campaign_id = sc.id
      ) cu ON true
      WHERE sc.status = 'active'
      ORDER BY cu.usage_count DESC
      LIMIT $1
    `;

    const result = await pool.query(query, [limit]);

    return result.rows.map((campaign) => ({
      ...campaign,
      configuration: campaign.configuration
        ? JSON.parse(campaign.configuration)
        : {},
    }));
  }
}
