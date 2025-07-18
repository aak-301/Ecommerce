// src/services/BogoService.ts
import pool from "../config/database";
import { v4 as uuidv4 } from "uuid";
import {
  BogoOffer,
  CreateBogoOfferRequest,
  UpdateBogoOfferRequest,
  BogoSearchParams,
  BogoAnalytics,
  BogoDiscountType,
} from "../types/sales-campaign";

export class BogoService {
  // =============================================
  // BOGO OFFER CRUD OPERATIONS
  // =============================================

  /**
   * Create a new BOGO offer
   */
  static async createBogoOffer(
    offerData: CreateBogoOfferRequest,
    createdBy: string
  ): Promise<BogoOffer> {
    const offerId = uuidv4();

    const query = `
      INSERT INTO bogo_offers (
        id, campaign_id, name, description, buy_quantity, buy_product_id, 
        buy_category_id, get_quantity, get_product_id, get_category_id,
        get_discount_type, get_discount_value, start_date, end_date,
        usage_limit, created_by, status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        CASE 
          WHEN $13 <= NOW() THEN 'active'
          ELSE 'inactive'
        END
      ) RETURNING *
    `;

    const result = await pool.query(query, [
      offerId,
      offerData.campaign_id,
      offerData.name,
      offerData.description,
      offerData.buy_quantity,
      offerData.buy_product_id,
      offerData.buy_category_id,
      offerData.get_quantity,
      offerData.get_product_id,
      offerData.get_category_id,
      offerData.get_discount_type,
      offerData.get_discount_value,
      offerData.start_date,
      offerData.end_date,
      offerData.usage_limit,
      createdBy,
    ]);

    return await this.getBogoOfferById(offerId);
  }

  /**
   * Get BOGO offer by ID with full details
   */
  static async getBogoOfferById(id: string): Promise<BogoOffer | null> {
    const query = `
      SELECT 
        bo.*,
        u.name as created_by_name,
        bp.name as buy_product_name,
        bp.sku as buy_product_sku,
        bc.name as buy_category_name,
        gp.name as get_product_name,
        gp.sku as get_product_sku,
        gc.name as get_category_name,
        sc.name as campaign_name,
        COALESCE(bu.usage_count, 0) as current_usage_count,
        COALESCE(bu.total_discount_given, 0) as total_discount_given,
        COALESCE(bu.unique_customers, 0) as unique_customers
      FROM bogo_offers bo
      LEFT JOIN users u ON bo.created_by = u.id
      LEFT JOIN products bp ON bo.buy_product_id = bp.id
      LEFT JOIN categories bc ON bo.buy_category_id = bc.id
      LEFT JOIN products gp ON bo.get_product_id = gp.id
      LEFT JOIN categories gc ON bo.get_category_id = gc.id
      LEFT JOIN sales_campaigns sc ON bo.campaign_id = sc.id
      LEFT JOIN LATERAL (
        SELECT 
          COUNT(*)::INTEGER as usage_count,
          COALESCE(SUM(discount_amount), 0) as total_discount_given,
          COUNT(DISTINCT user_id)::INTEGER as unique_customers
        FROM bogo_usage 
        WHERE bogo_id = bo.id
      ) bu ON true
      WHERE bo.id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Update BOGO offer
   */
  static async updateBogoOffer(
    id: string,
    updateData: UpdateBogoOfferRequest
  ): Promise<BogoOffer | null> {
    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    const allowedFields = [
      "campaign_id",
      "name",
      "description",
      "buy_quantity",
      "buy_product_id",
      "buy_category_id",
      "get_quantity",
      "get_product_id",
      "get_category_id",
      "get_discount_type",
      "get_discount_value",
      "start_date",
      "end_date",
      "usage_limit",
      "status",
    ];

    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        updateFields.push(`${field} = $${paramIndex}`);
        updateValues.push(updateData[field]);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      throw new Error("No valid fields to update");
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(id);

    const updateQuery = `
      UPDATE bogo_offers 
      SET ${updateFields.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(updateQuery, updateValues);

    if (result.rows.length === 0) {
      return null;
    }

    return await this.getBogoOfferById(id);
  }

  /**
   * Delete BOGO offer (soft delete)
   */
  static async deleteBogoOffer(id: string): Promise<boolean> {
    const query = `
      UPDATE bogo_offers 
      SET status = 'inactive', updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `;

    const result = await pool.query(query, [id]);
    return result.rows.length > 0;
  }

  // =============================================
  // BOGO OFFER SEARCH & FILTERING
  // =============================================

  /**
   * Search BOGO offers with filters
   */
  static async searchBogoOffers(
    searchParams: BogoSearchParams
  ): Promise<{ offers: BogoOffer[]; total: number }> {
    const conditions = ["1=1"];
    const values = [];
    let paramIndex = 1;

    // Build WHERE conditions
    if (searchParams.search) {
      conditions.push(
        `(bo.name ILIKE $${paramIndex} OR bo.description ILIKE $${paramIndex})`
      );
      values.push(`%${searchParams.search}%`);
      paramIndex++;
    }

    if (searchParams.status) {
      conditions.push(`bo.status = $${paramIndex}`);
      values.push(searchParams.status);
      paramIndex++;
    }

    if (searchParams.start_date_from) {
      conditions.push(`bo.start_date >= $${paramIndex}`);
      values.push(searchParams.start_date_from);
      paramIndex++;
    }

    if (searchParams.start_date_to) {
      conditions.push(`bo.start_date <= $${paramIndex}`);
      values.push(searchParams.start_date_to);
      paramIndex++;
    }

    if (searchParams.end_date_from) {
      conditions.push(`bo.end_date >= $${paramIndex}`);
      values.push(searchParams.end_date_from);
      paramIndex++;
    }

    if (searchParams.end_date_to) {
      conditions.push(`bo.end_date <= $${paramIndex}`);
      values.push(searchParams.end_date_to);
      paramIndex++;
    }

    if (searchParams.created_by) {
      conditions.push(`bo.created_by = $${paramIndex}`);
      values.push(searchParams.created_by);
      paramIndex++;
    }

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM bogo_offers bo
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
        bo.*,
        u.name as created_by_name,
        bp.name as buy_product_name,
        bc.name as buy_category_name,
        gp.name as get_product_name,
        gc.name as get_category_name,
        COALESCE(bu.usage_count, 0) as current_usage_count,
        COALESCE(bu.total_discount_given, 0) as total_discount_given
      FROM bogo_offers bo
      LEFT JOIN users u ON bo.created_by = u.id
      LEFT JOIN products bp ON bo.buy_product_id = bp.id
      LEFT JOIN categories bc ON bo.buy_category_id = bc.id
      LEFT JOIN products gp ON bo.get_product_id = gp.id
      LEFT JOIN categories gc ON bo.get_category_id = gc.id
      LEFT JOIN LATERAL (
        SELECT 
          COUNT(*)::INTEGER as usage_count,
          COALESCE(SUM(discount_amount), 0) as total_discount_given
        FROM bogo_usage 
        WHERE bogo_id = bo.id
      ) bu ON true
      WHERE ${conditions.join(" AND ")}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(limit, offset);

    const result = await pool.query(query, values);

    return {
      offers: result.rows,
      total,
    };
  }

  // =============================================
  // BOGO OFFER APPLICATION & VALIDATION
  // =============================================

  /**
   * Get active BOGO offers for a product
   */
  static async getActiveOffersForProduct(
    productId: string
  ): Promise<BogoOffer[]> {
    const query = `
      SELECT bo.*, 
        bp.name as buy_product_name,
        bc.name as buy_category_name,
        gp.name as get_product_name,
        gc.name as get_category_name,
        COALESCE(bu.usage_count, 0) as current_usage_count
      FROM bogo_offers bo
      LEFT JOIN products bp ON bo.buy_product_id = bp.id
      LEFT JOIN categories bc ON bo.buy_category_id = bc.id
      LEFT JOIN products gp ON bo.get_product_id = gp.id
      LEFT JOIN categories gc ON bo.get_category_id = gc.id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::INTEGER as usage_count
        FROM bogo_usage 
        WHERE bogo_id = bo.id
      ) bu ON true
      WHERE bo.status = 'active'
      AND bo.start_date <= NOW()
      AND bo.end_date >= NOW()
      AND (
        bo.buy_product_id = $1 OR
        bo.buy_category_id IN (
          SELECT p.category_id 
          FROM products p 
          WHERE p.id = $1
        )
      )
      AND (bo.usage_limit IS NULL OR bu.usage_count < bo.usage_limit)
      ORDER BY bo.get_discount_value DESC
    `;

    const result = await pool.query(query, [productId]);
    return result.rows;
  }

  /**
   * Check cart items for BOGO eligibility
   */
  static async checkCartForBogo(
    cartItems: Array<{
      product_id: string;
      category_id: string;
      quantity: number;
      price: number;
    }>
  ): Promise<
    Array<{
      bogo_offer: BogoOffer;
      eligible_buy_items: Array<{
        product_id: string;
        quantity: number;
        price: number;
      }>;
      eligible_get_items: Array<{
        product_id: string;
        quantity: number;
        price: number;
      }>;
      potential_discount: number;
    }>
  > {
    const eligibleOffers = [];

    // Get all active BOGO offers
    const activeOffersQuery = `
      SELECT bo.*, 
        bp.name as buy_product_name,
        bc.name as buy_category_name,
        gp.name as get_product_name,
        gc.name as get_category_name,
        COALESCE(bu.usage_count, 0) as current_usage_count
      FROM bogo_offers bo
      LEFT JOIN products bp ON bo.buy_product_id = bp.id
      LEFT JOIN categories bc ON bo.buy_category_id = bc.id
      LEFT JOIN products gp ON bo.get_product_id = gp.id
      LEFT JOIN categories gc ON bo.get_category_id = gc.id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::INTEGER as usage_count
        FROM bogo_usage 
        WHERE bogo_id = bo.id
      ) bu ON true
      WHERE bo.status = 'active'
      AND bo.start_date <= NOW()
      AND bo.end_date >= NOW()
      AND (bo.usage_limit IS NULL OR bu.usage_count < bo.usage_limit)
    `;

    const activeOffers = await pool.query(activeOffersQuery);

    for (const offer of activeOffers.rows) {
      // Check for eligible buy items
      const eligibleBuyItems = cartItems.filter((item) => {
        if (offer.buy_product_id && item.product_id === offer.buy_product_id) {
          return true;
        }
        if (
          offer.buy_category_id &&
          item.category_id === offer.buy_category_id
        ) {
          return true;
        }
        return false;
      });

      // Check for eligible get items
      const eligibleGetItems = cartItems.filter((item) => {
        if (offer.get_product_id && item.product_id === offer.get_product_id) {
          return true;
        }
        if (
          offer.get_category_id &&
          item.category_id === offer.get_category_id
        ) {
          return true;
        }
        return false;
      });

      // Calculate total buy quantity
      const totalBuyQuantity = eligibleBuyItems.reduce(
        (sum, item) => sum + item.quantity,
        0
      );

      // Check if minimum buy quantity is met
      if (
        totalBuyQuantity >= offer.buy_quantity &&
        eligibleGetItems.length > 0
      ) {
        // Calculate potential discount
        const maxApplications = Math.floor(
          totalBuyQuantity / offer.buy_quantity
        );
        const getQuantityEligible = Math.min(
          maxApplications * offer.get_quantity,
          eligibleGetItems.reduce((sum, item) => sum + item.quantity, 0)
        );

        let potentialDiscount = 0;

        if (offer.get_discount_type === "free") {
          // Sort get items by price (descending) to maximize discount
          const sortedGetItems = eligibleGetItems
            .sort((a, b) => b.price - a.price)
            .slice(0, getQuantityEligible);

          potentialDiscount = sortedGetItems.reduce(
            (sum, item) => sum + item.price,
            0
          );
        } else if (offer.get_discount_type === "percentage") {
          const getItemsValue = eligibleGetItems
            .slice(0, getQuantityEligible)
            .reduce((sum, item) => sum + item.price, 0);

          potentialDiscount = (getItemsValue * offer.get_discount_value) / 100;
        } else if (offer.get_discount_type === "fixed_amount") {
          potentialDiscount = offer.get_discount_value * maxApplications;
        }

        eligibleOffers.push({
          bogo_offer: offer,
          eligible_buy_items: eligibleBuyItems,
          eligible_get_items: eligibleGetItems,
          potential_discount: potentialDiscount,
        });
      }
    }

    // Sort by potential discount (descending)
    return eligibleOffers.sort(
      (a, b) => b.potential_discount - a.potential_discount
    );
  }

  /**
   * Calculate BOGO discount for specific items
   */
  static async calculateBogoDiscount(
    bogoId: string,
    buyProductId: string,
    buyQuantity: number,
    getProductId?: string
  ): Promise<{
    discount_amount: number;
    get_quantity: number;
    get_items: Array<{
      product_id: string;
      quantity: number;
      unit_price: number;
      discount_amount: number;
    }>;
  }> {
    const offer = await this.getBogoOfferById(bogoId);

    if (!offer) {
      throw new Error("BOGO offer not found");
    }

    if (offer.status !== "active") {
      throw new Error("BOGO offer is not active");
    }

    const now = new Date();
    if (new Date(offer.start_date) > now || new Date(offer.end_date) < now) {
      throw new Error("BOGO offer is not currently active");
    }

    // Check usage limits
    if (offer.usage_limit && offer.current_usage_count >= offer.usage_limit) {
      throw new Error("BOGO offer usage limit reached");
    }

    // Validate buy requirements
    if (buyQuantity < offer.buy_quantity) {
      throw new Error(`Minimum buy quantity of ${offer.buy_quantity} required`);
    }

    // Calculate number of applications
    const applications = Math.floor(buyQuantity / offer.buy_quantity);
    const totalGetQuantity = applications * offer.get_quantity;

    // Get product details for calculation
    let getItems = [];
    let totalDiscount = 0;

    if (getProductId || offer.get_product_id) {
      const productId = getProductId || offer.get_product_id;

      // Get product price
      const productQuery = `
        SELECT price, sale_price 
        FROM products 
        WHERE id = $1 AND is_active = true
      `;

      const productResult = await pool.query(productQuery, [productId]);

      if (productResult.rows.length === 0) {
        throw new Error("Get product not found or inactive");
      }

      const product = productResult.rows[0];
      const unitPrice = product.sale_price || product.price;

      let discountPerUnit = 0;

      if (offer.get_discount_type === "free") {
        discountPerUnit = unitPrice;
      } else if (offer.get_discount_type === "percentage") {
        discountPerUnit = (unitPrice * offer.get_discount_value) / 100;
      } else if (offer.get_discount_type === "fixed_amount") {
        discountPerUnit = Math.min(offer.get_discount_value, unitPrice);
      }

      totalDiscount = discountPerUnit * totalGetQuantity;

      getItems = [
        {
          product_id: productId,
          quantity: totalGetQuantity,
          unit_price: unitPrice,
          discount_amount: discountPerUnit,
        },
      ];
    }

    return {
      discount_amount: totalDiscount,
      get_quantity: totalGetQuantity,
      get_items: getItems,
    };
  }

  /**
   * Apply BOGO discount and track usage
   */
  static async applyBogoDiscount(
    bogoId: string,
    userId: string,
    orderId: string,
    buyProductId: string,
    buyQuantity: number,
    getProductId: string,
    getQuantity: number,
    discountAmount: number
  ): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Track usage
      const usageQuery = `
        INSERT INTO bogo_usage (
          bogo_id, user_id, order_id, buy_product_id, get_product_id,
          buy_quantity, get_quantity, discount_amount
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `;

      await client.query(usageQuery, [
        bogoId,
        userId,
        orderId,
        buyProductId,
        getProductId,
        buyQuantity,
        getQuantity,
        discountAmount,
      ]);

      // Update BOGO offer usage count
      await client.query(
        "UPDATE bogo_offers SET usage_count = usage_count + 1 WHERE id = $1",
        [bogoId]
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
  // BOGO ANALYTICS & REPORTING
  // =============================================

  /**
   * Get BOGO offer analytics
   */
  static async getBogoAnalytics(bogoId: string): Promise<BogoAnalytics> {
    const query = `
      SELECT 
        COUNT(bu.id)::INTEGER as total_usage,
        COALESCE(SUM(bu.discount_amount), 0) as total_discount_given,
        COUNT(DISTINCT bu.user_id)::INTEGER as unique_customers,
        COALESCE(AVG(bu.buy_quantity), 0) as average_buy_quantity,
        COALESCE(AVG(bu.get_quantity), 0) as average_get_quantity,
        MIN(bu.used_at) as first_use_date,
        MAX(bu.used_at) as last_use_date
      FROM bogo_usage bu
      WHERE bu.bogo_id = $1
    `;

    const result = await pool.query(query, [bogoId]);
    const analytics = result.rows[0];

    // Get most popular buy products
    const buyProductsQuery = `
      SELECT 
        bp.id as product_id,
        bp.name as product_name,
        COUNT(bu.id)::INTEGER as times_bought
      FROM bogo_usage bu
      JOIN products bp ON bu.buy_product_id = bp.id
      WHERE bu.bogo_id = $1
      GROUP BY bp.id, bp.name
      ORDER BY times_bought DESC
      LIMIT 10
    `;

    const buyProductsResult = await pool.query(buyProductsQuery, [bogoId]);

    // Get most popular get products
    const getProductsQuery = `
      SELECT 
        gp.id as product_id,
        gp.name as product_name,
        COUNT(bu.id)::INTEGER as times_received
      FROM bogo_usage bu
      JOIN products gp ON bu.get_product_id = gp.id
      WHERE bu.bogo_id = $1
      GROUP BY gp.id, gp.name
      ORDER BY times_received DESC
      LIMIT 10
    `;

    const getProductsResult = await pool.query(getProductsQuery, [bogoId]);

    return {
      ...analytics,
      most_popular_buy_products: buyProductsResult.rows,
      most_popular_get_products: getProductsResult.rows,
    };
  }

  // =============================================
  // BOGO STATUS MANAGEMENT
  // =============================================

  /**
   * Update BOGO offer status
   */
  static async updateBogoOfferStatus(
    id: string,
    status: "active" | "inactive"
  ): Promise<BogoOffer | null> {
    const query = `
      UPDATE bogo_offers 
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [status, id]);

    if (result.rows.length === 0) {
      return null;
    }

    return await this.getBogoOfferById(id);
  }

  /**
   * Get expiring BOGO offers
   */
  static async getExpiringOffers(days: number = 7): Promise<BogoOffer[]> {
    const query = `
      SELECT bo.*, u.name as created_by_name,
        bp.name as buy_product_name,
        gp.name as get_product_name
      FROM bogo_offers bo
      LEFT JOIN users u ON bo.created_by = u.id
      LEFT JOIN products bp ON bo.buy_product_id = bp.id
      LEFT JOIN products gp ON bo.get_product_id = gp.id
      WHERE bo.status = 'active'
      AND bo.end_date <= NOW() + INTERVAL '${days} days'
      ORDER BY bo.end_date ASC
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Get most popular BOGO offers
   */
  static async getMostPopular(limit: number = 10): Promise<BogoOffer[]> {
    const query = `
      SELECT bo.*, u.name as created_by_name,
        bp.name as buy_product_name,
        gp.name as get_product_name,
        COALESCE(bu.usage_count, 0) as current_usage_count
      FROM bogo_offers bo
      LEFT JOIN users u ON bo.created_by = u.id
      LEFT JOIN products bp ON bo.buy_product_id = bp.id
      LEFT JOIN products gp ON bo.get_product_id = gp.id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::INTEGER as usage_count
        FROM bogo_usage 
        WHERE bogo_id = bo.id
      ) bu ON true
      WHERE bo.status = 'active'
      ORDER BY bu.usage_count DESC
      LIMIT $1
    `;

    const result = await pool.query(query, [limit]);
    return result.rows;
  }

  /**
   * Auto-update BOGO offer statuses based on dates
   */
  static async updateBogoStatuses(): Promise<void> {
    const queries = [
      // Activate offers that should be active
      `UPDATE bogo_offers 
       SET status = 'active', updated_at = NOW()
       WHERE status = 'inactive' AND start_date <= NOW() AND end_date >= NOW()`,

      // Deactivate expired offers
      `UPDATE bogo_offers 
       SET status = 'inactive', updated_at = NOW()
       WHERE status = 'active' AND end_date < NOW()`,
    ];

    for (const query of queries) {
      await pool.query(query);
    }
  }

  /**
   * Get BOGO dashboard statistics
   */
  static async getDashboardStats(): Promise<{
    total_active_offers: number;
    offers_used_today: number;
    total_discount_given: number;
    most_popular_offers: Array<{
      id: string;
      name: string;
      usage_count: number;
      discount_given: number;
    }>;
  }> {
    const query = `
      WITH bogo_stats AS (
        SELECT 
          COUNT(*) FILTER (WHERE status = 'active' AND start_date <= NOW() AND end_date >= NOW()) as active_offers,
          COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) as offers_created_today
        FROM bogo_offers
      ),
      usage_stats AS (
        SELECT 
          COALESCE(SUM(discount_amount), 0) as total_discount,
          COUNT(*) FILTER (WHERE DATE(used_at) = CURRENT_DATE) as used_today
        FROM bogo_usage
      ),
      popular_offers AS (
        SELECT 
          bo.id,
          bo.name,
          COUNT(bu.id) as usage_count,
          COALESCE(SUM(bu.discount_amount), 0) as discount_given
        FROM bogo_offers bo
        LEFT JOIN bogo_usage bu ON bo.id = bu.bogo_id
        WHERE bo.status = 'active'
        GROUP BY bo.id, bo.name
        ORDER BY usage_count DESC
        LIMIT 5
      )
      SELECT 
        bs.active_offers::INTEGER as total_active_offers,
        us.used_today::INTEGER as offers_used_today,
        us.total_discount,
        COALESCE(JSON_AGG(
          jsonb_build_object(
            'id', po.id,
            'name', po.name,
            'usage_count', po.usage_count,
            'discount_given', po.discount_given
          )
        ) FILTER (WHERE po.id IS NOT NULL), '[]') as most_popular_offers
      FROM bogo_stats bs
      CROSS JOIN usage_stats us
      LEFT JOIN popular_offers po ON true
      GROUP BY bs.active_offers, us.used_today, us.total_discount
    `;

    const result = await pool.query(query);
    const stats = result.rows[0];

    return {
      total_active_offers: stats.total_active_offers,
      offers_used_today: stats.offers_used_today,
      total_discount_given: parseFloat(stats.total_discount),
      most_popular_offers: stats.most_popular_offers,
    };
  }
}
