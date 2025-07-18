// src/models/CartModel.ts
import pool from "../config/database";
import {
  ShoppingCart,
  CartItem,
  AddToCartRequest,
  UpdateCartItemRequest,
} from "../types/product";
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
      pool.query(itemsQuery, [cartId]),
    ]);

    if (cartResult.rows.length === 0) {
      return null;
    }

    const cart = cartResult.rows[0];
    cart.items = itemsResult.rows;

    return cart;
  }

  // Add item to cart
  static async addItem(
    cartId: string,
    itemData: AddToCartRequest
  ): Promise<CartItem> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Check if item already exists in cart
      const existingItemQuery = `
        SELECT * FROM cart_items 
        WHERE cart_id = $1 AND product_id = $2 AND ($3::UUID IS NULL OR variant_id = $3)
      `;

      const existingItem = await client.query(existingItemQuery, [
        cartId,
        itemData.product_id,
        itemData.variant_id,
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
          existingItem.rows[0].id,
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
          const variantResult = await client.query(variantQuery, [
            itemData.variant_id,
          ]);
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
          const productResult = await client.query(productQuery, [
            itemData.product_id,
          ]);
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
          price,
        ]);
        cartItem = result.rows[0];
      }

      // Update cart timestamp
      await client.query(
        "UPDATE shopping_carts SET updated_at = NOW() WHERE id = $1",
        [cartId]
      );

      await client.query("COMMIT");
      return cartItem;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // Update cart item quantity
  static async updateItem(
    itemId: string,
    updates: UpdateCartItemRequest
  ): Promise<CartItem | null> {
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
        "UPDATE shopping_carts SET updated_at = NOW() WHERE id = $1",
        [result.rows[0].cart_id]
      );
    }

    return result.rows[0] || null;
  }

  // Remove item from cart
  static async removeItem(itemId: string): Promise<boolean> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Get cart_id before deletion
      const cartIdQuery = "SELECT cart_id FROM cart_items WHERE id = $1";
      const cartIdResult = await client.query(cartIdQuery, [itemId]);

      if (cartIdResult.rows.length === 0) {
        return false;
      }

      const cartId = cartIdResult.rows[0].cart_id;

      // Delete the item
      const deleteResult = await client.query(
        "DELETE FROM cart_items WHERE id = $1",
        [itemId]
      );

      // Update cart timestamp
      await client.query(
        "UPDATE shopping_carts SET updated_at = NOW() WHERE id = $1",
        [cartId]
      );

      await client.query("COMMIT");
      return deleteResult.rowCount > 0;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // Clear cart
  static async clearCart(cartId: string): Promise<boolean> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query("DELETE FROM cart_items WHERE cart_id = $1", [cartId]);
      await client.query(
        "UPDATE shopping_carts SET updated_at = NOW() WHERE id = $1",
        [cartId]
      );

      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
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

// src/models/OrderModel.ts
import {
  Order,
  OrderItem,
  CreateOrderRequest,
  UpdateOrderRequest,
  OrderSearchParams,
  PaginatedResponse,
} from "../types/product";

export class OrderModel {
  // Create order from cart
  static async createFromCart(
    cartId: string,
    userId: string,
    orderData: CreateOrderRequest
  ): Promise<Order> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Get cart items
      const cartItemsQuery = `
        SELECT 
          ci.*,
          p.name as product_name,
          p.sku as product_sku,
          pv.name as variant_name,
          pv.sku as variant_sku
        FROM cart_items ci
        LEFT JOIN products p ON ci.product_id = p.id
        LEFT JOIN product_variants pv ON ci.variant_id = pv.id
        WHERE ci.cart_id = $1
      `;

      const cartItems = await client.query(cartItemsQuery, [cartId]);

      if (cartItems.rows.length === 0) {
        throw new Error("Cart is empty");
      }

      // Calculate totals
      let subtotal = 0;
      for (const item of cartItems.rows) {
        subtotal += item.quantity * item.price;
      }

      const taxAmount = orderData.tax_amount || 0;
      const shippingAmount = orderData.shipping_amount || 0;
      const discountAmount = orderData.discount_amount || 0;
      const totalAmount =
        subtotal + taxAmount + shippingAmount - discountAmount;

      // Create order
      const orderId = uuidv4();
      const orderQuery = `
        INSERT INTO orders (
          id, user_id, subtotal, tax_amount, shipping_amount, 
          discount_amount, total_amount, shipping_address, 
          billing_address, shipping_method, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

      const orderResult = await client.query(orderQuery, [
        orderId,
        userId,
        subtotal,
        taxAmount,
        shippingAmount,
        discountAmount,
        totalAmount,
        orderData.shipping_address,
        orderData.billing_address,
        orderData.shipping_method,
        orderData.notes,
      ]);

      const order = orderResult.rows[0];

      // Create order items and update inventory
      for (const cartItem of cartItems.rows) {
        // Create order item
        await client.query(
          `INSERT INTO order_items (
            order_id, product_id, variant_id, product_name, product_sku,
            quantity, unit_price, total_price
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            orderId,
            cartItem.product_id,
            cartItem.variant_id,
            cartItem.variant_name
              ? `${cartItem.product_name} - ${cartItem.variant_name}`
              : cartItem.product_name,
            cartItem.variant_sku || cartItem.product_sku,
            cartItem.quantity,
            cartItem.price,
            cartItem.quantity * cartItem.price,
          ]
        );

        // Update inventory
        if (cartItem.variant_id) {
          await client.query(
            "UPDATE product_variants SET quantity = quantity - $1 WHERE id = $2",
            [cartItem.quantity, cartItem.variant_id]
          );
        } else {
          await client.query(
            "UPDATE products SET quantity = quantity - $1 WHERE id = $2",
            [cartItem.quantity, cartItem.product_id]
          );
        }

        // Record stock movement
        const currentQuantityQuery = cartItem.variant_id
          ? "SELECT quantity FROM product_variants WHERE id = $1"
          : "SELECT quantity FROM products WHERE id = $1";

        const quantityResult = await client.query(currentQuantityQuery, [
          cartItem.variant_id || cartItem.product_id,
        ]);

        await client.query(
          `INSERT INTO stock_movements (
            product_id, variant_id, movement_type, quantity_change, 
            quantity_after, reference_type, reference_id, reason, performed_by
          ) VALUES ($1, $2, 'sale', $3, $4, 'order', $5, 'Product sold', $6)`,
          [
            cartItem.product_id,
            cartItem.variant_id,
            -cartItem.quantity,
            quantityResult.rows[0].quantity,
            orderId,
            userId,
          ]
        );
      }

      // Mark cart as converted
      await client.query(
        "UPDATE shopping_carts SET status = 'converted' WHERE id = $1",
        [cartId]
      );

      await client.query("COMMIT");
      return order;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // Get order by ID with items
  static async findById(orderId: string): Promise<Order | null> {
    const orderQuery = `
      SELECT 
        o.*,
        u.name as customer_name,
        u.email as customer_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.id = $1
    `;

    const itemsQuery = `
      SELECT 
        oi.*,
        p.name as current_product_name,
        p.status as current_product_status
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = $1
      ORDER BY oi.created_at ASC
    `;

    const [orderResult, itemsResult] = await Promise.all([
      pool.query(orderQuery, [orderId]),
      pool.query(itemsQuery, [orderId]),
    ]);

    if (orderResult.rows.length === 0) {
      return null;
    }

    const order = orderResult.rows[0];
    order.items = itemsResult.rows;
    order.customer = {
      id: order.user_id,
      name: order.customer_name,
      email: order.customer_email,
    };

    return order;
  }

  // Get order by order number
  static async findByOrderNumber(orderNumber: string): Promise<Order | null> {
    const query = `
      SELECT 
        o.*,
        u.name as customer_name,
        u.email as customer_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.order_number = $1
    `;

    const result = await pool.query(query, [orderNumber]);
    return result.rows[0] || null;
  }

  // Update order
  static async update(
    orderId: string,
    updates: UpdateOrderRequest
  ): Promise<Order | null> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    const updateFields = [
      "status",
      "payment_status",
      "shipping_method",
      "tracking_number",
      "internal_notes",
      "shipped_at",
      "delivered_at",
    ];

    updateFields.forEach((field) => {
      if (updates[field as keyof UpdateOrderRequest] !== undefined) {
        fields.push(`${field} = ${paramIndex}`);
        values.push(updates[field as keyof UpdateOrderRequest]);
        paramIndex++;
      }
    });

    if (fields.length === 0) {
      throw new Error("No fields to update");
    }

    fields.push(`updated_at = NOW()`);
    values.push(orderId);

    const query = `
      UPDATE orders 
      SET ${fields.join(", ")}
      WHERE id = ${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  // Search orders with filters and pagination
  static async search(
    params: OrderSearchParams
  ): Promise<PaginatedResponse<Order>> {
    const {
      user_id,
      status,
      payment_status,
      date_from,
      date_to,
      search,
      sort_by = "created_at",
      sort_order = "desc",
      limit = 50,
      offset = 0,
    } = params;

    let whereConditions = ["1=1"];
    const queryParams: any[] = [];
    let paramIndex = 1;

    // Build where conditions
    if (user_id) {
      whereConditions.push(`o.user_id = ${paramIndex}`);
      queryParams.push(user_id);
      paramIndex++;
    }

    if (status) {
      whereConditions.push(`o.status = ${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    if (payment_status) {
      whereConditions.push(`o.payment_status = ${paramIndex}`);
      queryParams.push(payment_status);
      paramIndex++;
    }

    if (date_from) {
      whereConditions.push(`o.created_at >= ${paramIndex}`);
      queryParams.push(date_from);
      paramIndex++;
    }

    if (date_to) {
      whereConditions.push(`o.created_at <= ${paramIndex}`);
      queryParams.push(date_to);
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(
        o.order_number ILIKE ${paramIndex} OR 
        u.name ILIKE ${paramIndex} OR 
        u.email ILIKE ${paramIndex}
      )`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // Count query
    const countQuery = `
      SELECT COUNT(*)::INTEGER as total
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE ${whereConditions.join(" AND ")}
    `;

    const countResult = await pool.query(countQuery, queryParams);
    const total = countResult.rows[0].total;

    // Main query
    const validSortColumns = [
      "created_at",
      "total_amount",
      "order_number",
      "status",
    ];
    const sortColumn = validSortColumns.includes(sort_by)
      ? sort_by
      : "created_at";
    const sortDirection = sort_order === "asc" ? "ASC" : "DESC";

    queryParams.push(limit, offset);

    const dataQuery = `
      SELECT 
        o.*,
        u.name as customer_name,
        u.email as customer_email,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE ${whereConditions.join(" AND ")}
      ORDER BY o.${sortColumn} ${sortDirection}
      LIMIT ${paramIndex} OFFSET ${paramIndex + 1}
    `;

    const dataResult = await pool.query(dataQuery, queryParams);

    // Add customer info to each order
    const orders = dataResult.rows.map((order) => ({
      ...order,
      customer: {
        id: order.user_id,
        name: order.customer_name,
        email: order.customer_email,
      },
    }));

    return {
      data: orders,
      total,
      limit,
      offset,
      has_more: offset + limit < total,
    };
  }

  // Get user orders
  static async getUserOrders(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<PaginatedResponse<Order>> {
    return this.search({
      user_id: userId,
      limit,
      offset,
      sort_by: "created_at",
      sort_order: "desc",
    });
  }

  // Cancel order
  static async cancelOrder(
    orderId: string,
    reason?: string
  ): Promise<Order | null> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Get order items to restore inventory
      const itemsQuery = `
        SELECT oi.*, o.status
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE oi.order_id = $1
      `;

      const itemsResult = await client.query(itemsQuery, [orderId]);

      if (itemsResult.rows.length === 0) {
        throw new Error("Order not found");
      }

      const orderStatus = itemsResult.rows[0].status;

      if (["shipped", "delivered", "cancelled"].includes(orderStatus)) {
        throw new Error(`Cannot cancel order with status: ${orderStatus}`);
      }

      // Restore inventory for each item
      for (const item of itemsResult.rows) {
        if (item.variant_id) {
          await client.query(
            "UPDATE product_variants SET quantity = quantity + $1 WHERE id = $2",
            [item.quantity, item.variant_id]
          );
        } else {
          await client.query(
            "UPDATE products SET quantity = quantity + $1 WHERE id = $2",
            [item.quantity, item.product_id]
          );
        }

        // Record stock movement
        const currentQuantityQuery = item.variant_id
          ? "SELECT quantity FROM product_variants WHERE id = $1"
          : "SELECT quantity FROM products WHERE id = $1";

        const quantityResult = await client.query(currentQuantityQuery, [
          item.variant_id || item.product_id,
        ]);

        await client.query(
          `INSERT INTO stock_movements (
            product_id, variant_id, movement_type, quantity_change, 
            quantity_after, reference_type, reference_id, reason, performed_by
          ) VALUES ($1, $2, 'return', $3, $4, 'order_cancellation', $5, $6, $7)`,
          [
            item.product_id,
            item.variant_id,
            item.quantity,
            quantityResult.rows[0].quantity,
            orderId,
            reason || "Order cancelled",
            item.user_id, // Assuming user_id is available
          ]
        );
      }

      // Update order status
      const orderUpdateQuery = `
        UPDATE orders 
        SET status = 'cancelled', internal_notes = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;

      const orderResult = await client.query(orderUpdateQuery, [
        reason || "Order cancelled",
        orderId,
      ]);

      await client.query("COMMIT");
      return orderResult.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // Get order statistics
  static async getOrderStats(userId?: string): Promise<any> {
    let whereClause = "1=1";
    const params: any[] = [];

    if (userId) {
      whereClause = "user_id = $1";
      params.push(userId);
    }

    const query = `
      SELECT 
        COUNT(*)::INTEGER as total_orders,
        COUNT(CASE WHEN status = 'pending' THEN 1 END)::INTEGER as pending_orders,
        COUNT(CASE WHEN status IN ('delivered', 'completed') THEN 1 END)::INTEGER as completed_orders,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END)::INTEGER as cancelled_orders,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(AVG(total_amount), 0) as average_order_value,
        COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN total_amount ELSE 0 END), 0) as revenue_last_30_days
      FROM orders 
      WHERE ${whereClause}
    `;

    const result = await pool.query(query, params);
    return result.rows[0];
  }

  // Get recent orders
  static async getRecentOrders(
    limit: number = 10,
    userId?: string
  ): Promise<Order[]> {
    let whereClause = "1=1";
    const params: any[] = [];
    let paramIndex = 1;

    if (userId) {
      whereClause = `o.user_id = ${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    params.push(limit);

    const query = `
      SELECT 
        o.*,
        u.name as customer_name,
        u.email as customer_email,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ${paramIndex}
    `;

    const result = await pool.query(query, params);

    return result.rows.map((order) => ({
      ...order,
      customer: {
        id: order.user_id,
        name: order.customer_name,
        email: order.customer_email,
      },
    }));
  }

  // Get top selling products
  static async getTopSellingProducts(
    limit: number = 10,
    days: number = 30
  ): Promise<any[]> {
    const query = `
      SELECT 
        oi.product_id,
        p.name as product_name,
        p.sku as product_sku,
        SUM(oi.quantity)::INTEGER as total_sold,
        SUM(oi.total_price) as total_revenue,
        COUNT(DISTINCT oi.order_id)::INTEGER as orders_count
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN products p ON oi.product_id = p.id
      WHERE o.created_at >= NOW() - INTERVAL '${days} days'
      AND o.status NOT IN ('cancelled', 'refunded')
      GROUP BY oi.product_id, p.name, p.sku
      ORDER BY total_sold DESC
      LIMIT $1
    `;

    const result = await pool.query(query, [limit]);
    return result.rows;
  }
}
