POST /api/products/coupons/validate - Validate coupon code
GET /api/products/admin/coupons/:id/analytics - Coupon analytics
POST /api/products/admin/coupons/bulk - Generate bulk coupons
BOGO Management:
POST /api/products/admin/bogo - Create BOGO offer
POST /api/products/bogo/check-cart - Check cart eligibility
GET /api/products/bogo/active - Get active offers
POST /api/products/bogo/calculate - Calculate BOGO discount
This system now provides enterprise-level sales campaign management with comprehensive analytics, making it perfect for e-commerce platforms that need sophisticated promotional capabilities!

Next Steps:

Run the new database migration: npm run db:migrate-sales
Add the sales campaign routes to your main router
Test with the provided API endpoints
Configure email notifications for campaign events
Set up automated campaign status updates (cron job)
Would you like me to create the routes configuration and additional service implementations?








// src/models/CartModel.ts
import pool from "../config/database";
import { ShoppingCart, CartItem, AddToCartRequest, UpdateCartItemRequest } from "../types/product";
import { v4 as uuidv4 } from "uuid";

export class CartModel {
  // Get or create cart for user
  static async getOrCreateCart(userId: string): Promise<ShoppingCart> {
    let cart = await this.getActiveCart(userId);
    
    if (!cart) {
      cart = await this.createCart(userId);
    }
    
    return cart;
  }

  // Get active cart for user
  static async getActiveCart(userId: string): Promise<ShoppingCart | null> {
    const query = `
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM cart_items ci WHERE ci.cart_id = c.id) as item_count,
        (SELECT COALESCE(SUM(ci.quantity * ci.price), 0) FROM cart_items ci WHERE ci.cart_id = c.id) as total
      FROM shopping_carts c
      WHERE c.user_id = $1 AND c.status = 'active'
      ORDER BY c.updated_at DESC
      LIMIT 1
    `;

    const result = await pool.query(query, [userId]);
    return result.rows[0] || null;
  }

  // Create new cart
  static async createCart(userId: string): Promise<ShoppingCart> {
    const id = uuidv4();
    
    const query = `
      INSERT INTO shopping_carts (id, user_id, status)
      VALUES ($1, $2, 'active')
      RETURNING *
    `;

    const result = await pool.query(query, [id, userId]);
    return result.rows[0];
  }

  // Get cart with items
  static async getCartWithItems(cartId: string): Promise<ShoppingCart | null> {
    const cartQuery = `
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM cart_items ci WHERE ci.cart_id = c.id) as item_count,
        (SELECT COALESCE(SUM(ci.quantity * ci.price), 0) FROM cart_items ci WHERE ci.cart_id = c.id) as total
      FROM shopping_carts c
      WHERE c.id = $1
    `;

    const itemsQuery = `
      SELECT 
        ci.*,
        p.name as product_name,
        p.slug as product_slug,
        p.status as product_status,
        p.quantity as available_quantity,
        pv.name as variant_name,
        pv.quantity as variant_quantity,
        (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = TRUE LIMIT 1) as product_image,
        (ci.quantity * ci.price) as total_price
      FROM cart_items ci
      LEFT JOIN products p ON ci.product_id = p.id
      LEFT JOIN product_variants pv ON ci.variant_id = pv.id
      WHERE ci.cart_id = $1
      ORDER BY ci.created_at ASC
    `;

    const [cartResult, itemsResult] = await Promise.all([
      pool.query(cartQuery, [cartId]),
      pool.query(itemsQuery, [cartId])
    ]);

    if (cartResult.rows.length === 0) {
      return null;
    }

    const cart = cartResult.rows[0];
    cart.items = itemsResult.rows;

    return cart;
  }

  // Add item to cart
  static async addItem(cartId: string, itemData: AddToCartRequest): Promise<CartItem> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if item already exists in cart
      const existingItemQuery = `
        SELECT * FROM cart_items 
        WHERE cart_id = $1 AND product_id = $2 AND ($3::UUID IS NULL OR variant_id = $3)
      `;
      
      const existingItem = await client.query(existingItemQuery, [
        cartId, 
        itemData.product_id, 
        itemData.variant_id
      ]);

      let cartItem: CartItem;

      if (existingItem.rows.length > 0) {
        // Update existing item quantity
        const updateQuery = `
          UPDATE cart_items 
          SET quantity = quantity + $1, updated_at = NOW()
          WHERE id = $2
          RETURNING *
        `;
        
        const result = await client.query(updateQuery, [
          itemData.quantity, 
          existingItem.rows[0].id
        ]);
        cartItem = result.rows[0];
      } else {
        // Get product/variant price
        let price: number;
        if (itemData.variant_id) {
          const variantQuery = `
            SELECT COALESCE(sale_price, price) as price 
            FROM product_variants 
            WHERE id = $1 AND is_active = TRUE
          `;
          const variantResult = await client.query(variantQuery, [itemData.variant_id]);
          if (variantResult.rows.length === 0) {
            throw new Error("Product variant not found or inactive");
          }
          price = variantResult.rows[0].price;
        } else {
          const productQuery = `
            SELECT COALESCE(sale_price, price) as price 
            FROM products 
            WHERE id = $1 AND deleted_at IS NULL AND status = 'published'
          `;
          const productResult = await client.query(productQuery, [itemData.product_id]);
          if (productResult.rows.length === 0) {
            throw new Error("Product not found or not available");
          }
          price = productResult.rows[0].price;
        }

        // Create new cart item
        const insertQuery = `
          INSERT INTO cart_items (cart_id, product_id, variant_id, quantity, price)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `;
        
        const result = await client.query(insertQuery, [
          cartId,
          itemData.product_id,
          itemData.variant_id,
          itemData.quantity,
          price
        ]);
        cartItem = result.rows[0];
      }

      // Update cart timestamp
      await client.query(
        'UPDATE shopping_carts SET updated_at = NOW() WHERE id = $1',
        [cartId]
      );

      await client.query('COMMIT');
      return cartItem;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Update cart item quantity
  static async updateItem(itemId: string, updates: UpdateCartItemRequest): Promise<CartItem | null> {
    if (updates.quantity <= 0) {
      return await this.removeItem(itemId);
    }

    const query = `
      UPDATE cart_items 
      SET quantity = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [updates.quantity, itemId]);
    
    if (result.rows.length > 0) {
      // Update cart timestamp
      await pool.query(
        'UPDATE shopping_carts SET updated_at = NOW() WHERE id = $1',
        [result.rows[0].cart_id]
      );
    }

    return result.rows[0] || null;
  }

  // Remove item from cart
  static async removeItem(itemId: string): Promise<boolean> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get cart_id before deletion
      const cartIdQuery = 'SELECT cart_id FROM cart_items WHERE id = $1';
      const cartIdResult = await client.query(cartIdQuery, [itemId]);
      
      if (cartIdResult.rows.length === 0) {
        return false;
      }
      
      const cartId = cartIdResult.rows[0].cart_id;
      
      // Delete the item
      const deleteResult = await client.query('DELETE FROM cart_items WHERE id = $1', [itemId]);
      
      // Update cart timestamp
      await client.query(
        'UPDATE shopping_carts SET updated_at = NOW() WHERE id = $1',
        [cartId]
      );
      
      await client.query('COMMIT');
      return deleteResult.rowCount > 0;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Clear cart
  static async clearCart(cartId: string): Promise<boolean> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
      await client.query(
        'UPDATE shopping_carts SET updated_at = NOW() WHERE id = $1',
        [cartId]
      );
      
      await client.query('COMMIT');
      return true;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Mark cart as converted (when order is created)
  static async markAsConverted(cartId: string): Promise<boolean> {
    const query = `
      UPDATE shopping_carts 
      SET status = 'converted', updated_at = NOW()
      WHERE id = $1
    `;

    const result = await pool.query(query, [cartId]);
    return result.rowCount > 0;
  }

  // Clean up expired carts
  static async cleanupExpiredCarts(): Promise<number> {
    const query = `
      DELETE FROM shopping_carts 
      WHERE expires_at < NOW() AND status = 'active'
    `;

    const result = await pool.query(query);
    return result.rowCount || 0;
  }

  // Get cart total
  static async getCartTotal(cartId: string): Promise<number> {
    const query = `
      SELECT COALESCE(SUM(quantity * price), 0) as total
      FROM cart_items
      WHERE cart_id = $1
    `;

    const result = await pool.query(query, [cartId]);
    return parseFloat(result.rows[0].total) || 0;
  }
}