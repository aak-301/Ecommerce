// src/models/SalesCampaignModel.ts
import pool from "../config/database";
import { 
  SalesCampaign, 
  CreateCampaignRequest, 
  UpdateCampaignRequest,
  CampaignSearchParams,
  CampaignAnalytics,
  PaginatedResponse 
} from "../types/sales-campaign";
import { v4 as uuidv4 } from "uuid";

export class SalesCampaignModel {
  // Create a new campaign
  static async create(campaignData: CreateCampaignRequest, createdBy: string): Promise<SalesCampaign> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const id = uuidv4();
      
      // Determine initial status based on dates
      const now = new Date();
      let status = 'draft';
      if (campaignData.start_date > now) {
        status = 'scheduled';
      } else if (campaignData.start_date <= now && campaignData.end_date > now) {
        status = 'active';
      }
      
      const query = `
        INSERT INTO sales_campaigns (
          id, name, description, campaign_type, start_date, end_date,
          status, discount_type, discount_value, max_discount_amount,
          usage_limit, usage_limit_per_customer, minimum_order_amount,
          minimum_quantity, applies_to, configuration, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
        ) RETURNING *
      `;
      
      const values = [
        id,
        campaignData.name,
        campaignData.description,
        campaignData.campaign_type,
        campaignData.start_date,
        campaignData.end_date,
        status,
        campaignData.discount_type,
        campaignData.discount_value,
        campaignData.max_discount_amount,
        campaignData.usage_limit,
        campaignData.usage_limit_per_customer,
        campaignData.minimum_order_amount || 0,
        campaignData.minimum_quantity || 1,
        campaignData.applies_to,
        campaignData.configuration || {},
        createdBy
      ];
      
      const result = await client.query(query, values);
      const campaign = result.rows[0];
      
      // Add product associations if specified
      if (campaignData.product_ids && campaignData.product_ids.length > 0) {
        for (const productId of campaignData.product_ids) {
          await client.query(
            'INSERT INTO campaign_products (campaign_id, product_id) VALUES ($1, $2)',
            [id, productId]
          );
        }
      }
      
      // Add category associations if specified
      if (campaignData.category_ids && campaignData.category_ids.length > 0) {
        for (const categoryId of campaignData.category_ids) {
          await client.query(
            'INSERT INTO campaign_categories (campaign_id, category_id) VALUES ($1, $2)',
            [id, categoryId]
          );
        }
      }
      
      await client.query('COMMIT');
      return campaign;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Update a campaign
  static async update(id: string, campaignData: UpdateCampaignRequest, updatedBy: string): Promise<SalesCampaign | null> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const fields = [];
      const values = [];
      let paramIndex = 1;

      const updateFields = [
        'name', 'description', 'campaign_type', 'start_date', 'end_date',
        'status', 'discount_type', 'discount_value', 'max_discount_amount',
        'usage_limit', 'usage_limit_per_customer', 'minimum_order_amount',
        'minimum_quantity', 'applies_to', 'configuration'
      ];

      updateFields.forEach(field => {
        if (campaignData[field as keyof UpdateCampaignRequest] !== undefined) {
          fields.push(`${field} = $${paramIndex}`);
          values.push(campaignData[field as keyof UpdateCampaignRequest]);
          paramIndex++;
        }
      });

      if (fields.length === 0) {
        throw new Error("No fields to update");
      }

      fields.push(`updated_by = $${paramIndex}`, `updated_at = NOW()`);
      values.push(updatedBy, id);

      const query = `
        UPDATE sales_campaigns 
        SET ${fields.join(", ")}
        WHERE id = $${paramIndex + 1}
        RETURNING *
      `;

      const result = await client.query(query, values);
      
      if (result.rows.length === 0) {
        return null;
      }

      // Update product associations if specified
      if (campaignData.product_ids !== undefined) {
        await client.query('DELETE FROM campaign_products WHERE campaign_id = $1', [id]);
        
        if (campaignData.product_ids.length > 0) {
          for (const productId of campaignData.product_ids) {
            await client.query(
              'INSERT INTO campaign_products (campaign_id, product_id) VALUES ($1, $2)',
              [id, productId]
            );
          }
        }
      }

      // Update category associations if specified
      if (campaignData.category_ids !== undefined) {
        await client.query('DELETE FROM campaign_categories WHERE campaign_id = $1', [id]);
        
        if (campaignData.category_ids.length > 0) {
          for (const categoryId of campaignData.category_ids) {
            await client.query(
              'INSERT INTO campaign_categories (campaign_id, category_id) VALUES ($1, $2)',
              [id, categoryId]
            );
          }
        }
      }

      await client.query('COMMIT');
      return result.rows[0];
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Get campaign by ID with full details
  static async findById(id: string): Promise<SalesCampaign | null> {
    const campaignQuery = `
      SELECT 
        sc.*,
        cr.name as created_by_name,
        up.name as updated_by_name
      FROM sales_campaigns sc
      LEFT JOIN users cr ON sc.created_by = cr.id
      LEFT JOIN users up ON sc.updated_by = up.id
      WHERE sc.id = $1
    `;

    const productsQuery = `
      SELECT p.id, p.name, p.price, p.sale_price
      FROM campaign_products cp
      JOIN products p ON cp.product_id = p.id
      WHERE cp.campaign_id = $1 AND p.deleted_at IS NULL
    `;

    const categoriesQuery = `
      SELECT c.id, c.name, c.slug
      FROM campaign_categories cc
      JOIN categories c ON cc.category_id = c.id
      WHERE cc.campaign_id = $1 AND c.deleted_at IS NULL
    `;

    const [campaignResult, productsResult, categoriesResult] = await Promise.all([
      pool.query(campaignQuery, [id]),
      pool.query(productsQuery, [id]),
      pool.query(categoriesQuery, [id])
    ]);

    if (campaignResult.rows.length === 0) {
      return null;
    }

    const campaign = campaignResult.rows[0];
    campaign.products = productsResult.rows.map(p => p.id);
    campaign.categories = categoriesResult.rows.map(c => c.id);
    campaign.product_details = productsResult.rows;
    campaign.category_details = categoriesResult.rows;

    return campaign;
  }

  // Search campaigns with filters and pagination
  static async search(params: CampaignSearchParams): Promise<PaginatedResponse<SalesCampaign>> {
    const {
      search,
      campaign_type,
      status,
      applies_to,
      start_date_from,
      start_date_to,
      end_date_from,
      end_date_to,
      created_by,
      sort_by = 'created_at',
      sort_order = 'desc',
      limit = 50,
      offset = 0
    } = params;

    let whereConditions = ["1=1"];
    const queryParams: any[] = [];
    let paramIndex = 1;

    // Build where conditions
    if (search) {
      whereConditions.push(`(sc.name ILIKE $${paramIndex} OR sc.description ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (campaign_type) {
      whereConditions.push(`sc.campaign_type = $${paramIndex}`);
      queryParams.push(campaign_type);
      paramIndex++;
    }

    if (status) {
      whereConditions.push(`sc.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    if (applies_to) {
      whereConditions.push(`sc.applies_to = $${paramIndex}`);
      queryParams.push(applies_to);
      paramIndex++;
    }

    if (start_date_from) {
      whereConditions.push(`sc.start_date >= $${paramIndex}`);
      queryParams.push(start_date_from);
      paramIndex++;
    }

    if (start_date_to) {
      whereConditions.push(`sc.start_date <= $${paramIndex}`);
      queryParams.push(start_date_to);
      paramIndex++;
    }

    if (end_date_from) {
      whereConditions.push(`sc.end_date >= $${paramIndex}`);
      queryParams.push(end_date_from);
      paramIndex++;
    }

    if (end_date_to) {
      whereConditions.push(`sc.end_date <= $${paramIndex}`);
      queryParams.push(end_date_to);
      paramIndex++;
    }

    if (created_by) {
      whereConditions.push(`sc.created_by = $${paramIndex}`);
      queryParams.push(created_by);
      paramIndex++;
    }

    // Count query
    const countQuery = `
      SELECT COUNT(*)::INTEGER as total
      FROM sales_campaigns sc
      WHERE ${whereConditions.join(' AND ')}
    `;

    const countResult = await pool.query(countQuery, queryParams);
    const total = countResult.rows[0].total;

    // Main query
    const validSortColumns = ['name', 'start_date', 'end_date', 'created_at', 'usage_count'];
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'created_at';
    const sortDirection = sort_order === 'asc' ? 'ASC' : 'DESC';

    queryParams.push(limit, offset);

    const dataQuery = `
      SELECT 
        sc.*,
        cr.name as created_by_name,
        (SELECT COUNT(*) FROM campaign_products cp WHERE cp.campaign_id = sc.id) as product_count,
        (SELECT COUNT(*) FROM campaign_categories cc WHERE cc.campaign_id = sc.id) as category_count
      FROM sales_campaigns sc
      LEFT JOIN users cr ON sc.created_by = cr.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY sc.${sortColumn} ${sortDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const dataResult = await pool.query(dataQuery, queryParams);

    return {
      data: dataResult.rows,
      total,
      limit,
      offset,
      has_more: offset + limit < total
    };
  }

  // Get active campaigns for a product
  static async getActiveCampaignsForProduct(productId: string): Promise<SalesCampaign[]> {
    const query = `
      SELECT sc.*
      FROM sales_campaigns sc
      WHERE sc.status = 'active'
      AND sc.start_date <= NOW()
      AND sc.end_date > NOW()
      AND (
        sc.applies_to = 'all_products'
        OR (sc.applies_to = 'products' AND EXISTS (
          SELECT 1 FROM campaign_products cp 
          WHERE cp.campaign_id = sc.id AND cp.product_id = $1