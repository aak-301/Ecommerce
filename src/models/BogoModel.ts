// src/models/BogoModel.ts
import pool from "../config/database";
import {
  BogoOffer,
  CreateBogoOfferRequest,
  UpdateBogoOfferRequest,
  BogoSearchParams,
  BogoAnalytics,
  PaginatedResponse,
} from "../types/sales-campaign";
import { v4 as uuidv4 } from "uuid";

export class BogoModel {
  // Create a new BOGO offer
  static async create(
    bogoData: CreateBogoOfferRequest,
    createdBy: string
  ): Promise<BogoOffer> {
    const id = uuidv4();

    // Determine initial status based on dates
    const now = new Date();
    let status = "inactive";
    if (bogoData.start_date <= now && bogoData.end_date > now) {
      status = "active";
    }

    const query = `
      INSERT INTO bogo_offers (
        id, campaign_id, name, description, buy_quantity, buy_product_id,
        buy_category_id, get_quantity, get_product_id, get_category_id,
        get_discount_type, get_discount_value, start_date, end_date,
        status, usage_limit, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      ) RETURNING *
    `;

    const values = [
      id,
      bogoData.campaign_id,
      bogoData.name,
      bogoData.description,
      bogoData.buy_quantity,
      bogoData.buy_product_id,
      bogoData.buy_category_id,
      bogoData.get_quantity,
      bogoData.get_product_id,
      bogoData.get_category_id,
      bogoData.get_discount_type,
      bogoData.get_discount_value || 0,
      bogoData.start_date,
      bogoData.end_date,
      status,
      bogoData.usage_limit,
      createdBy,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // Update BOGO offer
  static async update(
    id: string,
    bogoData: UpdateBogoOfferRequest
  ): Promise<BogoOffer | null> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    const updateFields = [
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
      "status",
      "usage_limit",
    ];

    updateFields.forEach((field) => {
      if (bogoData[field as keyof UpdateBogoOfferRequest] !== undefined) {
        fields.push(`${field} = $${paramIndex}`);
        values.push(bogoData[field as keyof UpdateBogoOfferRequest]);
        paramIndex++;
      }
    });

    if (fields.length === 0) {
      throw new Error("No fields to update");
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE bogo_offers 
      SET ${fields.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  // Get BOGO offer by ID with full details
  static async findById(id: string): Promise<BogoOffer | null> {
    const query = `
      SELECT 
        bo.*,
        bp.name as buy_product_name,
        bp.price as buy_product_price,
        gp.name as get_product_name,
        gp.price as get_product_price,
        bc.name as buy_category_name,
        gc.name as get_category_name,
        cr.name as created_by_name
      FROM bogo_offers bo
      LEFT JOIN products bp ON bo.buy_product_id = bp.id
      LEFT JOIN products gp ON bo.get_product_id = gp.id
      LEFT JOIN categories bc ON bo.buy_category_id = bc.id
      LEFT JOIN categories gc ON bo.get_category_id = gc.id
      LEFT JOIN users cr ON bo.created_by = cr.id
      WHERE bo.id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    const bogo = result.rows[0];

    // Structure the response with nested objects
    if (bogo.buy_product_id) {
      bogo.buy_product = {
        id: bogo.buy_product_id,
        name: bogo.buy_product_name,
        price: bogo.buy_product_price,
      };
    }

    if (bogo.get_product_id) {
      bogo.get_product = {
        id: bogo.get_product_id,
        name: bogo.get_product_name,
        price: bogo.get_product_price,
      };
    }

    if (bogo.buy_category_id) {
      bogo.buy_category = {
        id: bogo.buy_category_id,
        name: bogo.buy_category_name,
      };
    }

    if (bogo.get_category_id) {
      bogo.get_category = {
        id: bogo.get_category_id,
        name: bogo.get_category_name,
      };
    }

    return bogo;
  }

  // Search BOGO offers with filters and pagination
  static async search(
    params: BogoSearchParams
  ): Promise<PaginatedResponse<BogoOffer>> {
    const {
      search,
      status,
      start_date_from,
      start_date_to,
      end_date_from,
      end_date_to,
      created_by,
      sort_by = "created_at",
      sort_order = "desc",
      limit = 50,
      offset = 0,
    } = params;

    let whereConditions = ["1=1"];
    const queryParams: any[] = [];
    let paramIndex = 1;

    // Build where conditions
    if (search) {
      whereConditions.push(
        `(bo.name ILIKE $${paramIndex} OR bo.description ILIKE $${paramIndex})`
      );
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (status) {
      whereConditions.push(`bo.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    if (start_date_from) {
      whereConditions.push(`bo.start_date >= $${paramIndex}`);
      queryParams.push(start_date_from);
      paramIndex++;
    }

    if (start_date_to) {
      whereConditions.push(`bo.start_date <= $${paramIndex}`);
      queryParams.push(start_date_to);
      paramIndex++;
    }

    if (end_date_from) {
      whereConditions.push(`bo.end_date >= $${paramIndex}`);
      queryParams.push(end_date_from);
      paramIndex++;
    }

    if (end_date_to) {
      whereConditions.push(`bo.end_date <= $${paramIndex}`);
      queryParams.push(end_date_to);
      paramIndex++;
    }

    if (created_by) {
      whereConditions.push(`bo.created_by = $${paramIndex}`);
      queryParams.push(created_by);
      paramIndex++;
    }

    // Count query
    const countQuery = `
      SELECT COUNT(*)::INTEGER as total
      FROM bogo_offers bo
      WHERE ${whereConditions.join(" AND ")}
    `;

    const countResult = await pool.query(countQuery, queryParams);
    const total = countResult.rows[0].total;

    // Main query
    const validSortColumns = [
      "name",
      "start_date",
      "end_date",
      "created_at",
      "usage_count",
    ];
    const sortColumn = validSortColumns.includes(sort_by)
      ? sort_by
      : "created_at";
    const sortDirection = sort_order === "asc" ? "ASC" : "DESC";

    queryParams.push(limit, offset);

    const dataQuery = `
      SELECT 
        bo.*,
        bp.name as buy_product_name,
        gp.name as get_product_name,
        bc.name as buy_category_name,
        gc.name as get_category_name,
        cr.name as created_by_name
      FROM bogo_offers bo
      LEFT JOIN products bp ON bo.buy_product_id = bp.id
      LEFT JOIN products gp ON bo.get_product_id = gp.id
      LEFT JOIN categories bc ON bo.buy_category_id = bc.id
      LEFT JOIN categories gc ON bo.get_category_id = gc.id
      LEFT JOIN users cr ON bo.created_by = cr.id
      WHERE ${whereConditions.join(" AND ")}
      ORDER BY bo.${sortColumn} ${sortDirection}
      LIMIT ${paramIndex} OFFSET ${paramIndex + 1}
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

  // Get active BOGO offers for a product
  static async getActiveOffersForProduct(
    productId: string
  ): Promise<BogoOffer[]> {
    const query = `
      SELECT bo.*
      FROM bogo_offers bo
      WHERE bo.status = 'active'
      AND bo.start_date <= NOW()
      AND bo.end_date > NOW()
      AND (
        bo.buy_product_id = $1
        OR bo.get_product_id = $1
        OR EXISTS (
          SELECT 1 FROM products p 
          WHERE p.id = $1 
          AND (p.category_id = bo.buy_category_id OR p.category_id = bo.get_category_id)
        )
      )
      AND (bo.usage_limit IS NULL OR bo.usage_count < bo.usage_limit)
      ORDER BY bo.created_at DESC
    `;

    const result = await pool.query(query, [productId]);
    return result.rows;
  }

  // Get active BOGO offers for a category
  static async getActiveOffersForCategory(
    categoryId: string
  ): Promise<BogoOffer[]> {
    const query = `
      SELECT bo.*
      FROM bogo_offers bo
      WHERE bo.status = 'active'
      AND bo.start_date <= NOW()
      AND bo.end_date > NOW()
      AND (bo.buy_category_id = $1 OR bo.get_category_id = $1)
      AND (bo.usage_limit IS NULL OR bo.usage_count < bo.usage_limit)
      ORDER BY bo.created_at DESC
    `;

    const result = await pool.query(query, [categoryId]);
    return result.rows;
  }

  // Check if cart qualifies for BOGO offers
  static async checkCartForBogo(
    cartItems: Array<{ product_id: string; quantity: number }>
  ): Promise<BogoOffer[]> {
    if (!cartItems || cartItems.length === 0) {
      return [];
    }

    const productIds = cartItems.map((item) => item.product_id);

    const query = `
      SELECT DISTINCT bo.*
      FROM bogo_offers bo
      LEFT JOIN products bp ON bo.buy_product_id = bp.id
      LEFT JOIN products gp ON bo.get_product_id = gp.id
      WHERE bo.status = 'active'
      AND bo.start_date <= NOW()
      AND bo.end_date > NOW()
      AND (bo.usage_limit IS NULL OR bo.usage_count < bo.usage_limit)
      AND (
        bo.buy_product_id = ANY($1::UUID[])
        OR EXISTS (
          SELECT 1 FROM products p 
          WHERE p.id = ANY($1::UUID[]) 
          AND p.category_id = bo.buy_category_id
        )
      )
    `;

    const result = await pool.query(query, [productIds]);

    // Filter offers where cart has enough quantities
    const qualifyingOffers = [];

    for (const offer of result.rows) {
      let hasRequiredQuantity = false;

      if (offer.buy_product_id) {
        // Check specific product quantity
        const cartItem = cartItems.find(
          (item) => item.product_id === offer.buy_product_id
        );
        if (cartItem && cartItem.quantity >= offer.buy_quantity) {
          hasRequiredQuantity = true;
        }
      } else if (offer.buy_category_id) {
        // Check category products total quantity
        const categoryQuery = `
          SELECT SUM(ci.quantity)::INTEGER as total_quantity
          FROM unnest($1::UUID[], $2::INTEGER[]) AS ci(product_id, quantity)
          JOIN products p ON ci.product_id = p.id
          WHERE p.category_id = $3
        `;

        const categoryResult = await pool.query(categoryQuery, [
          cartItems.map((item) => item.product_id),
          cartItems.map((item) => item.quantity),
          offer.buy_category_id,
        ]);

        const totalQuantity = categoryResult.rows[0]?.total_quantity || 0;
        if (totalQuantity >= offer.buy_quantity) {
          hasRequiredQuantity = true;
        }
      }

      if (hasRequiredQuantity) {
        qualifyingOffers.push(offer);
      }
    }

    return qualifyingOffers;
  }

  // Delete BOGO offer
  static async delete(id: string): Promise<boolean> {
    const result = await pool.query("DELETE FROM bogo_offers WHERE id = $1", [
      id,
    ]);
    return result.rowCount > 0;
  }

  // Update BOGO offer status
  static async updateStatus(
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
    return result.rows[0] || null;
  }

  // Get BOGO analytics
  static async getAnalytics(bogoId: string): Promise<BogoAnalytics> {
    const query = `
      SELECT 
        COUNT(bu.id)::INTEGER as total_offers_redeemed,
        COALESCE(SUM(o.total_amount), 0) as total_revenue,
        COALESCE(SUM(bu.discount_amount), 0) as total_discount_given,
        COUNT(DISTINCT bu.user_id)::INTEGER as unique_customers,
        COALESCE(AVG(o.total_amount), 0) as average_order_value
      FROM bogo_usage bu
      LEFT JOIN orders o ON bu.order_id = o.id
      WHERE bu.bogo_id = $1
    `;

    const result = await pool.query(query, [bogoId]);

    if (result.rows.length === 0) {
      return {
        total_offers_redeemed: 0,
        total_revenue: 0,
        total_discount_given: 0,
        unique_customers: 0,
        average_order_value: 0,
      };
    }

    return result.rows[0];
  }

  // Get BOGO usage history
  static async getUsageHistory(
    bogoId: string,
    limit: number = 50,
    offset: number = 0
  ) {
    const query = `
      SELECT 
        bu.*,
        u.name as user_name,
        u.email as user_email,
        o.order_number,
        bp.name as buy_product_name,
        gp.name as get_product_name
      FROM bogo_usage bu
      LEFT JOIN users u ON bu.user_id = u.id
      LEFT JOIN orders o ON bu.order_id = o.id
      LEFT JOIN products bp ON bu.buy_product_id = bp.id
      LEFT JOIN products gp ON bu.get_product_id = gp.id
      WHERE bu.bogo_id = $1
      ORDER BY bu.used_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [bogoId, limit, offset]);
    return result.rows;
  }

  // Get active BOGO offers (general)
  static async getActiveOffers(limit: number = 50): Promise<BogoOffer[]> {
    const query = `
      SELECT 
        bo.*,
        bp.name as buy_product_name,
        gp.name as get_product_name,
        bc.name as buy_category_name,
        gc.name as get_category_name
      FROM bogo_offers bo
      LEFT JOIN products bp ON bo.buy_product_id = bp.id
      LEFT JOIN products gp ON bo.get_product_id = gp.id
      LEFT JOIN categories bc ON bo.buy_category_id = bc.id
      LEFT JOIN categories gc ON bo.get_category_id = gc.id
      WHERE bo.status = 'active'
      AND bo.start_date <= NOW()
      AND bo.end_date > NOW()
      AND (bo.usage_limit IS NULL OR bo.usage_count < bo.usage_limit)
      ORDER BY bo.created_at DESC
      LIMIT $1
    `;

    const result = await pool.query(query, [limit]);
    return result.rows;
  }

  // Get expiring BOGO offers
  static async getExpiringOffers(days: number = 7): Promise<BogoOffer[]> {
    const query = `
      SELECT 
        bo.*,
        cr.name as created_by_name
      FROM bogo_offers bo
      LEFT JOIN users cr ON bo.created_by = cr.id
      WHERE bo.status = 'active'
      AND bo.end_date BETWEEN NOW() AND NOW() + INTERVAL '${days} days'
      ORDER BY bo.end_date ASC
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  // Get BOGO offers by status
  static async getByStatus(
    status: "active" | "inactive",
    limit: number = 50
  ): Promise<BogoOffer[]> {
    const query = `
      SELECT 
        bo.*,
        cr.name as created_by_name
      FROM bogo_offers bo
      LEFT JOIN users cr ON bo.created_by = cr.id
      WHERE bo.status = $1
      ORDER BY bo.created_at DESC
      LIMIT $2
    `;

    const result = await pool.query(query, [status, limit]);
    return result.rows;
  }

  // Calculate BOGO discount for specific products
  static async calculateBogoDiscount(
    offerId: string,
    buyProductId: string,
    buyQuantity: number,
    getProductId?: string
  ): Promise<{ discount_amount: number; get_quantity: number }> {
    const offer = await this.findById(offerId);

    if (!offer || offer.status !== "active") {
      return { discount_amount: 0, get_quantity: 0 };
    }

    // Check if we have enough buy quantity
    const eligibleSets = Math.floor(buyQuantity / offer.buy_quantity);
    if (eligibleSets === 0) {
      return { discount_amount: 0, get_quantity: 0 };
    }

    const totalGetQuantity = eligibleSets * offer.get_quantity;
    let discountAmount = 0;

    if (offer.get_discount_type === "free") {
      // Get the price of the "get" product
      let getProductPrice = 0;

      if (getProductId) {
        const productQuery = `SELECT COALESCE(sale_price, price) as price FROM products WHERE id = $1`;
        const productResult = await pool.query(productQuery, [getProductId]);
        getProductPrice = productResult.rows[0]?.price || 0;
      } else if (offer.get_product_id) {
        const productQuery = `SELECT COALESCE(sale_price, price) as price FROM products WHERE id = $1`;
        const productResult = await pool.query(productQuery, [
          offer.get_product_id,
        ]);
        getProductPrice = productResult.rows[0]?.price || 0;
      }

      discountAmount = getProductPrice * totalGetQuantity;
    } else if (offer.get_discount_type === "percentage") {
      // Apply percentage discount to get products
      let getProductPrice = 0;

      if (getProductId) {
        const productQuery = `SELECT COALESCE(sale_price, price) as price FROM products WHERE id = $1`;
        const productResult = await pool.query(productQuery, [getProductId]);
        getProductPrice = productResult.rows[0]?.price || 0;
      } else if (offer.get_product_id) {
        const productQuery = `SELECT COALESCE(sale_price, price) as price FROM products WHERE id = $1`;
        const productResult = await pool.query(productQuery, [
          offer.get_product_id,
        ]);
        getProductPrice = productResult.rows[0]?.price || 0;
      }

      discountAmount =
        getProductPrice * totalGetQuantity * (offer.get_discount_value / 100);
    } else if (offer.get_discount_type === "fixed_amount") {
      discountAmount = offer.get_discount_value * totalGetQuantity;
    }

    return {
      discount_amount: discountAmount,
      get_quantity: totalGetQuantity,
    };
  }

  // Get most popular BOGO offers
  static async getMostPopular(limit: number = 10): Promise<BogoOffer[]> {
    const query = `
      SELECT 
        bo.*,
        bo.usage_count,
        bp.name as buy_product_name,
        gp.name as get_product_name
      FROM bogo_offers bo
      LEFT JOIN products bp ON bo.buy_product_id = bp.id
      LEFT JOIN products gp ON bo.get_product_id = gp.id
      WHERE bo.status = 'active'
      ORDER BY bo.usage_count DESC, bo.created_at DESC
      LIMIT $1
    `;

    const result = await pool.query(query, [limit]);
    return result.rows;
  }
}
