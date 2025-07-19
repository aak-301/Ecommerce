// src/models/CustomerModel.ts
import pool from "../config/database";
import {
  CustomerAddress,
  CartItem,
  Order,
  OrderItem,
  ProductReview,
  WishlistItem,
  CreateAddressRequest,
  UpdateAddressRequest,
  PlaceOrderRequest,
  CreateReviewRequest,
  UpdateReviewRequest,
  CustomerOrderQueryParams,
  CustomerProductQueryParams,
  OrderWithItems,
  CartSummary,
  CustomerOrderStats,
  ProductWithReviews,
} from "../types/customer";
import { v4 as uuidv4 } from "uuid";

export class CustomerModel {
  // =============================================
  // ADDRESS MANAGEMENT
  // =============================================

  static async createAddress(
    customerId: string,
    addressData: CreateAddressRequest
  ): Promise<CustomerAddress> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // If this is a default address, unset other defaults of the same type
      if (addressData.is_default) {
        await client.query(
          "UPDATE customer_addresses SET is_default = FALSE WHERE customer_id = $1 AND type = $2",
          [customerId, addressData.type]
        );
      }

      const id = uuidv4();
      const query = `
        INSERT INTO customer_addresses (
          id, customer_id, type, is_default, first_name, last_name, company,
          address_line_1, address_line_2, city, state, postal_code, country, phone
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `;

      const values = [
        id,
        customerId,
        addressData.type,
        addressData.is_default ?? false,
        addressData.first_name,
        addressData.last_name,
        addressData.company,
        addressData.address_line_1,
        addressData.address_line_2,
        addressData.city,
        addressData.state,
        addressData.postal_code,
        addressData.country || "India",
        addressData.phone,
      ];

      const result = await client.query(query, values);
      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  static async getCustomerAddresses(
    customerId: string,
    type?: string
  ): Promise<CustomerAddress[]> {
    let query = `
      SELECT * FROM customer_addresses 
      WHERE customer_id = $1
    `;

    const params = [customerId];

    if (type) {
      query += " AND type = $2";
      params.push(type);
    }

    query += " ORDER BY is_default DESC, created_at DESC";

    const result = await pool.query(query, params);
    return result.rows;
  }

  static async getAddressById(
    addressId: string,
    customerId: string
  ): Promise<CustomerAddress | null> {
    const query = `
      SELECT * FROM customer_addresses 
      WHERE id = $1 AND customer_id = $2
    `;

    const result = await pool.query(query, [addressId, customerId]);
    return result.rows[0] || null;
  }

  static async updateAddress(
    addressId: string,
    customerId: string,
    updates: UpdateAddressRequest
  ): Promise<CustomerAddress | null> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // If setting as default, unset other defaults of the same type
      if (updates.is_default) {
        const currentAddress = await client.query(
          "SELECT type FROM customer_addresses WHERE id = $1 AND customer_id = $2",
          [addressId, customerId]
        );

        if (currentAddress.rows.length > 0) {
          await client.query(
            "UPDATE customer_addresses SET is_default = FALSE WHERE customer_id = $1 AND type = $2 AND id != $3",
            [customerId, currentAddress.rows[0].type, addressId]
          );
        }
      }

      const fields = [];
      const values = [];
      let paramIndex = 1;

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          fields.push(`${key} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      });

      if (fields.length === 0) {
        throw new Error("No fields to update");
      }

      fields.push(`updated_at = NOW()`);
      values.push(addressId, customerId);

      const query = `
        UPDATE customer_addresses 
        SET ${fields.join(", ")}
        WHERE id = $${paramIndex} AND customer_id = $${paramIndex + 1}
        RETURNING *
      `;

      const result = await client.query(query, values);
      await client.query("COMMIT");
      return result.rows[0] || null;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  static async deleteAddress(
    addressId: string,
    customerId: string
  ): Promise<boolean> {
    const query = `
      DELETE FROM customer_addresses 
      WHERE id = $1 AND customer_id = $2
    `;

    const result = await pool.query(query, [addressId, customerId]);
    return result.rowCount! > 0;
  }

  // =============================================
  // SHOPPING CART MANAGEMENT
  // =============================================

  static async addToCart(
    customerId: string,
    productId: string,
    variantId: string | null,
    quantity: number,
    price: number
  ): Promise<boolean> {
    const query =
      "SELECT add_to_cart($1::UUID, $2::UUID, $3::UUID, $4::INTEGER, $5::DECIMAL) as success";
    const result = await pool.query(query, [
      customerId,
      productId,
      variantId,
      quantity,
      price,
    ]);
    return result.rows[0].success;
  }

  static async getCart(customerId: string): Promise<CartItem[]> {
    const query = `
      SELECT 
        sc.*,
        p.name as product_name,
        p.slug as product_slug,
        p.featured_image as product_image,
        p.price as current_price,
        p.sale_price,
        p.status,
        p.quantity as available_quantity,
        pv.name as variant_name,
        pv.attributes as variant_attributes,
        pv.price as variant_current_price,
        pv.quantity as variant_available_quantity,
        CASE 
          WHEN p.deleted_at IS NOT NULL OR p.status != 'active' THEN FALSE
          WHEN sc.variant_id IS NOT NULL AND (pv.is_active = FALSE OR pv.quantity < sc.quantity) THEN FALSE
          WHEN sc.variant_id IS NULL AND p.quantity < sc.quantity THEN FALSE
          ELSE TRUE 
        END as is_available
      FROM shopping_cart sc
      JOIN products p ON sc.product_id = p.id
      LEFT JOIN product_variants pv ON sc.variant_id = pv.id
      WHERE sc.customer_id = $1
      ORDER BY sc.created_at DESC
    `;

    const result = await pool.query(query, [customerId]);
    return result.rows.map((row) => ({
      ...row,
      current_price: row.variant_id
        ? row.variant_current_price || row.current_price
        : row.sale_price || row.current_price,
    }));
  }

  static async updateCartItem(
    customerId: string,
    productId: string,
    variantId: string | null,
    quantity: number
  ): Promise<boolean> {
    const query = `
      UPDATE shopping_cart 
      SET quantity = $4, updated_at = NOW()
      WHERE customer_id = $1 AND product_id = $2 
      AND (variant_id = $3 OR (variant_id IS NULL AND $3 IS NULL))
    `;

    const result = await pool.query(query, [
      customerId,
      productId,
      variantId,
      quantity,
    ]);
    return result.rowCount! > 0;
  }

  static async removeFromCart(
    customerId: string,
    productId: string,
    variantId: string | null
  ): Promise<boolean> {
    const query = `
      DELETE FROM shopping_cart 
      WHERE customer_id = $1 AND product_id = $2 
      AND (variant_id = $3 OR (variant_id IS NULL AND $3 IS NULL))
    `;

    const result = await pool.query(query, [customerId, productId, variantId]);
    return result.rowCount! > 0;
  }

  static async clearCart(customerId: string): Promise<boolean> {
    const query = "DELETE FROM shopping_cart WHERE customer_id = $1";
    const result = await pool.query(query, [customerId]);
    return result.rowCount! > 0;
  }

  static async getCartSummary(customerId: string): Promise<CartSummary> {
    const items = await this.getCart(customerId);

    const totalItems = items.length;
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => {
      const price = item.current_price || item.price_at_time;
      return sum + price * item.quantity;
    }, 0);

    // Calculate estimated tax and shipping (these could be configurable)
    const estimatedTax = subtotal * 0.18; // 18% GST in India
    const estimatedShipping = subtotal > 500 ? 0 : 50; // Free shipping above ₹500
    const estimatedTotal = subtotal + estimatedTax + estimatedShipping;

    return {
      items,
      total_items: totalItems,
      total_quantity: totalQuantity,
      subtotal: parseFloat(subtotal.toFixed(2)),
      estimated_tax: parseFloat(estimatedTax.toFixed(2)),
      estimated_shipping: parseFloat(estimatedShipping.toFixed(2)),
      estimated_total: parseFloat(estimatedTotal.toFixed(2)),
    };
  }

  // =============================================
  // ORDER MANAGEMENT
  // =============================================

  static async placeOrder(
    customerId: string,
    orderData: PlaceOrderRequest
  ): Promise<Order> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Get cart items
      const cartItems = await this.getCart(customerId);
      if (cartItems.length === 0) {
        throw new Error("Cart is empty");
      }

      // Validate all items are available
      const unavailableItems = cartItems.filter((item) => !item.is_available);
      if (unavailableItems.length > 0) {
        throw new Error(
          `Some items are no longer available: ${unavailableItems
            .map((i) => i.product_name)
            .join(", ")}`
        );
      }

      // Get addresses
      const [shippingAddress, billingAddress] = await Promise.all([
        this.getAddressById(orderData.shipping_address_id, customerId),
        this.getAddressById(orderData.billing_address_id, customerId),
      ]);

      if (!shippingAddress || !billingAddress) {
        throw new Error("Invalid shipping or billing address");
      }

      // Calculate totals
      const subtotal = cartItems.reduce((sum, item) => {
        const price = item.current_price || item.price_at_time;
        return sum + price * item.quantity;
      }, 0);

      const taxAmount = subtotal * 0.18; // 18% GST
      const shippingAmount = subtotal > 500 ? 0 : 50;
      const totalAmount = subtotal + taxAmount + shippingAmount;

      // Generate order number
      const orderNumberResult = await client.query(
        "SELECT generate_order_number() as order_number"
      );
      const orderNumber = orderNumberResult.rows[0].order_number;

      // Create order
      const orderId = uuidv4();
      const orderQuery = `
        INSERT INTO orders (
          id, order_number, customer_id, status, payment_status,
          subtotal, tax_amount, shipping_amount, discount_amount, total_amount,
          payment_method, shipping_address, billing_address, customer_notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `;

      const orderValues = [
        orderId,
        orderNumber,
        customerId,
        "pending",
        "pending",
        subtotal,
        taxAmount,
        shippingAmount,
        0, // discount_amount
        totalAmount,
        orderData.payment_method,
        JSON.stringify(shippingAddress),
        JSON.stringify(billingAddress),
        orderData.customer_notes,
      ];

      const orderResult = await client.query(orderQuery, orderValues);
      const order = orderResult.rows[0];

      // Create order items
      for (const item of cartItems) {
        const orderItemId = uuidv4();
        const itemQuery = `
          INSERT INTO order_items (
            id, order_id, product_id, variant_id, product_name, product_sku,
            variant_name, variant_sku, unit_price, quantity, total_price
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `;

        const itemPrice = item.current_price || item.price_at_time;
        const itemValues = [
          orderItemId,
          orderId,
          item.product_id,
          item.variant_id,
          item.product_name!,
          "", // We'll need to fetch this
          item.variant_name,
          "", // We'll need to fetch this
          itemPrice,
          item.quantity,
          itemPrice * item.quantity,
        ];

        await client.query(itemQuery, itemValues);
      }

      // Update inventory
      const inventorySuccess = await client.query(
        "SELECT update_inventory_on_order($1::UUID) as success",
        [orderId]
      );

      if (!inventorySuccess.rows[0].success) {
        throw new Error("Failed to update inventory");
      }

      // Clear cart
      await client.query("DELETE FROM shopping_cart WHERE customer_id = $1", [
        customerId,
      ]);

      await client.query("COMMIT");
      return order;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  static async getCustomerOrders(
    customerId: string,
    params: CustomerOrderQueryParams = {}
  ): Promise<{
    orders: OrderWithItems[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      limit = 20,
      status,
      payment_status,
      start_date,
      end_date,
      sort_by = "created_at",
      sort_order = "desc",
    } = params;

    const offset = (page - 1) * limit;
    const conditions = ["o.customer_id = $1"];
    const values = [customerId];
    let paramIndex = 2;

    if (status) {
      conditions.push(`o.status = ${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    if (payment_status) {
      conditions.push(`o.payment_status = ${paramIndex}`);
      values.push(payment_status);
      paramIndex++;
    }

    if (start_date) {
      conditions.push(`o.created_at >= ${paramIndex}`);
      values.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      conditions.push(`o.created_at <= ${paramIndex}`);
      values.push(end_date);
      paramIndex++;
    }

    const whereClause = conditions.join(" AND ");

    // Count query
    const countQuery = `SELECT COUNT(*) as total FROM orders o WHERE ${whereClause}`;
    const countResult = await pool.query(
      countQuery,
      values.slice(0, paramIndex - 1)
    );
    const total = parseInt(countResult.rows[0].total);

    // Main query
    const query = `
      SELECT 
        o.*,
        u.name as customer_name,
        u.email as customer_email,
        COUNT(oi.id) as total_items,
        SUM(oi.quantity) as total_quantity
      FROM orders o
      LEFT JOIN users u ON o.customer_id = u.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE ${whereClause}
      GROUP BY o.id, u.name, u.email
      ORDER BY o.${sort_by} ${sort_order.toUpperCase()}
      LIMIT ${paramIndex} OFFSET ${paramIndex + 1}
    `;

    values.push(limit.toString(), offset.toString());
    const ordersResult = await pool.query(query, values);

    // Get order items for each order
    const orders = await Promise.all(
      ordersResult.rows.map(async (order) => {
        const items = await this.getOrderItems(order.id);
        return { ...order, items };
      })
    );

    const totalPages = Math.ceil(total / limit);

    return {
      orders,
      total,
      page,
      limit,
      totalPages,
    };
  }

  static async getOrderById(
    orderId: string,
    customerId?: string
  ): Promise<OrderWithItems | null> {
    let query = `
      SELECT 
        o.*,
        u.name as customer_name,
        u.email as customer_email,
        COUNT(oi.id) as total_items,
        SUM(oi.quantity) as total_quantity
      FROM orders o
      LEFT JOIN users u ON o.customer_id = u.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.id = $1
    `;

    const params = [orderId];

    if (customerId) {
      query += " AND o.customer_id = $2";
      params.push(customerId);
    }

    query += " GROUP BY o.id, u.name, u.email";

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return null;
    }

    const order = result.rows[0];
    const items = await this.getOrderItems(orderId);

    return { ...order, items };
  }

  static async getOrderItems(orderId: string): Promise<OrderItem[]> {
    const query = `
      SELECT 
        oi.*,
        p.featured_image as product_image,
        p.slug as product_slug
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = $1
      ORDER BY oi.created_at ASC
    `;

    const result = await pool.query(query, [orderId]);
    return result.rows;
  }

  static async cancelOrder(
    orderId: string,
    customerId: string,
    reason?: string
  ): Promise<boolean> {
    const query =
      "SELECT cancel_order($1::UUID, $2::UUID, $3::TEXT) as success";
    const result = await pool.query(query, [
      orderId,
      customerId,
      reason || "Customer cancellation",
    ]);
    return result.rows[0].success;
  }

  static async getCustomerOrderStats(
    customerId: string
  ): Promise<CustomerOrderStats> {
    const query = "SELECT * FROM get_customer_order_stats($1::UUID)";
    const result = await pool.query(query, [customerId]);
    return result.rows[0];
  }

  // =============================================
  // PRODUCT REVIEWS
  // =============================================

  static async createReview(
    customerId: string,
    reviewData: CreateReviewRequest
  ): Promise<ProductReview> {
    // Check if customer has purchased this product
    const purchaseCheck = await pool.query(
      `SELECT oi.order_id FROM order_items oi 
       JOIN orders o ON oi.order_id = o.id 
       WHERE o.customer_id = $1 AND oi.product_id = $2 AND o.status = 'delivered'`,
      [customerId, reviewData.product_id]
    );

    const isVerifiedPurchase = purchaseCheck.rows.length > 0;
    const orderId =
      reviewData.order_id ||
      (isVerifiedPurchase ? purchaseCheck.rows[0].order_id : null);

    const id = uuidv4();
    const query = `
      INSERT INTO product_reviews (
        id, product_id, customer_id, order_id, rating, title, review_text, is_verified_purchase
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      id,
      reviewData.product_id,
      customerId,
      orderId,
      reviewData.rating,
      reviewData.title,
      reviewData.review_text,
      isVerifiedPurchase,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async updateReview(
    reviewId: string,
    customerId: string,
    updates: UpdateReviewRequest
  ): Promise<ProductReview | null> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && key !== "product_id") {
        // Don't allow changing product_id
        fields.push(`${key} = ${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    if (fields.length === 0) {
      throw new Error("No fields to update");
    }

    fields.push(`updated_at = NOW()`);
    values.push(reviewId, customerId);

    const query = `
      UPDATE product_reviews 
      SET ${fields.join(", ")}
      WHERE id = ${paramIndex} AND customer_id = ${paramIndex + 1}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  static async deleteReview(
    reviewId: string,
    customerId: string
  ): Promise<boolean> {
    const query = `
      DELETE FROM product_reviews 
      WHERE id = $1 AND customer_id = $2
    `;

    const result = await pool.query(query, [reviewId, customerId]);
    return result.rowCount! > 0;
  }

  static async getCustomerReviews(
    customerId: string,
    limit = 50,
    offset = 0
  ): Promise<ProductReview[]> {
    const query = `
      SELECT 
        pr.*,
        p.name as product_name
      FROM product_reviews pr
      LEFT JOIN products p ON pr.product_id = p.id
      WHERE pr.customer_id = $1
      ORDER BY pr.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [
      customerId,
      limit.toString(),
      offset.toString(),
    ]);
    return result.rows;
  }

  static async getProductReviews(
    productId: string,
    approvedOnly = true,
    limit = 20,
    offset = 0
  ): Promise<ProductReview[]> {
    let query = `
      SELECT 
        pr.*,
        u.name as customer_name
      FROM product_reviews pr
      LEFT JOIN users u ON pr.customer_id = u.id
      WHERE pr.product_id = $1
    `;

    const params: any[] = [productId];
    let paramIndex = 2;

    if (approvedOnly) {
      query += ` AND pr.is_approved = TRUE`;
    }

    query += ` ORDER BY pr.created_at DESC LIMIT ${paramIndex} OFFSET ${
      paramIndex + 1
    }`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  // =============================================
  // WISHLIST MANAGEMENT
  // =============================================

  static async addToWishlist(
    customerId: string,
    productId: string
  ): Promise<WishlistItem> {
    const id = uuidv4();
    const query = `
      INSERT INTO wishlists (id, customer_id, product_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (customer_id, product_id) DO NOTHING
      RETURNING *
    `;

    const result = await pool.query(query, [id, customerId, productId]);

    if (result.rows.length === 0) {
      // Item already in wishlist, return existing
      const existingQuery = `
        SELECT * FROM wishlists 
        WHERE customer_id = $1 AND product_id = $2
      `;
      const existingResult = await pool.query(existingQuery, [
        customerId,
        productId,
      ]);
      return existingResult.rows[0];
    }

    return result.rows[0];
  }

  static async removeFromWishlist(
    customerId: string,
    productId: string
  ): Promise<boolean> {
    const query = `
      DELETE FROM wishlists 
      WHERE customer_id = $1 AND product_id = $2
    `;

    const result = await pool.query(query, [customerId, productId]);
    return result.rowCount! > 0;
  }

  static async getWishlist(customerId: string): Promise<WishlistItem[]> {
    const query = `
      SELECT 
        w.*,
        p.name as product_name,
        p.slug as product_slug,
        p.price as product_price,
        p.sale_price as product_sale_price,
        p.featured_image as product_image,
        CASE 
          WHEN p.deleted_at IS NOT NULL OR p.status != 'active' OR p.quantity = 0 THEN FALSE
          ELSE TRUE 
        END as is_available
      FROM wishlists w
      JOIN products p ON w.product_id = p.id
      WHERE w.customer_id = $1
      ORDER BY w.created_at DESC
    `;

    const result = await pool.query(query, [customerId]);
    return result.rows;
  }

  static async isInWishlist(
    customerId: string,
    productId: string
  ): Promise<boolean> {
    const query = `
      SELECT 1 FROM wishlists 
      WHERE customer_id = $1 AND product_id = $2
    `;

    const result = await pool.query(query, [customerId, productId]);
    return result.rows.length > 0;
  }

  // =============================================
  // CUSTOMER PRODUCT BROWSING
  // =============================================

  static async getCustomerProducts(
    params: CustomerProductQueryParams = {}
  ): Promise<{
    products: ProductWithReviews[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      limit = 20,
      search,
      category_id,
      min_price,
      max_price,
      in_stock,
      featured,
      sort_by = "created_at",
      sort_order = "desc",
      tags,
    } = params;

    const offset = (page - 1) * limit;
    const conditions = ["p.deleted_at IS NULL", "p.status = 'active'"];
    const values = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(
        p.name ILIKE ${paramIndex} OR 
        p.description ILIKE ${paramIndex} OR 
        p.short_description ILIKE ${paramIndex}
      )`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    if (category_id) {
      conditions.push(`p.category_id = ${paramIndex}::UUID`);
      values.push(category_id);
      paramIndex++;
    }

    if (min_price !== undefined) {
      conditions.push(`COALESCE(p.sale_price, p.price) >= ${paramIndex}`);
      values.push(min_price);
      paramIndex++;
    }

    if (max_price !== undefined) {
      conditions.push(`COALESCE(p.sale_price, p.price) <= ${paramIndex}`);
      values.push(max_price);
      paramIndex++;
    }

    if (in_stock) {
      conditions.push(`p.quantity > 0`);
    }

    if (featured) {
      conditions.push(`p.is_featured = TRUE`);
    }

    if (tags && tags.length > 0) {
      conditions.push(`p.tags && ${paramIndex}::TEXT[]`);
      values.push(tags);
      paramIndex++;
    }

    const whereClause = conditions.join(" AND ");

    // Count query
    const countQuery = `SELECT COUNT(*) as total FROM products p WHERE ${whereClause}`;
    const countResult = await pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total);

    // Main query using the view
    let orderBy = "p.created_at";
    switch (sort_by) {
      case "name":
        orderBy = "p.name";
        break;
      case "price":
        orderBy = "COALESCE(p.sale_price, p.price)";
        break;
      case "rating":
        orderBy = "average_rating";
        break;
      default:
        orderBy = "p.created_at";
    }

    const query = `
      SELECT 
        p.*,
        c.name as category_name,
        c.slug as category_slug,
        COALESCE(AVG(pr.rating), 0) as average_rating,
        COUNT(pr.id) as review_count,
        CASE 
          WHEN p.track_quantity = TRUE AND p.quantity <= p.min_quantity THEN TRUE 
          ELSE FALSE 
        END as is_low_stock
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_reviews pr ON p.id = pr.product_id AND pr.is_approved = TRUE
      WHERE ${whereClause}
      GROUP BY p.id, c.name, c.slug
      ORDER BY ${orderBy} ${sort_order.toUpperCase()}
      LIMIT ${paramIndex} OFFSET ${paramIndex + 1}
    `;

    values.push(limit, offset);
    const productsResult = await pool.query(query, values);

    const totalPages = Math.ceil(total / limit);

    return {
      products: productsResult.rows,
      total,
      page,
      limit,
      totalPages,
    };
  }

  static async getCustomerProductById(
    productId: string
  ): Promise<ProductWithReviews | null> {
    const query = `
      SELECT 
        p.*,
        c.name as category_name,
        c.slug as category_slug,
        COALESCE(AVG(pr.rating), 0) as average_rating,
        COUNT(pr.id) as review_count,
        CASE 
          WHEN p.track_quantity = TRUE AND p.quantity <= p.min_quantity THEN TRUE 
          ELSE FALSE 
        END as is_low_stock
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_reviews pr ON p.id = pr.product_id AND pr.is_approved = TRUE
      WHERE p.id = $1 AND p.deleted_at IS NULL AND p.status = 'active'
      GROUP BY p.id, c.name, c.slug
    `;

    const result = await pool.query(query, [productId]);

    if (result.rows.length === 0) {
      return null;
    }

    const product = result.rows[0] as ProductWithReviews;

    // Get variants, attributes, and reviews
    const [variants, attributes, reviews] = await Promise.all([
      this.getProductVariants(productId),
      this.getProductAttributes(productId),
      this.getProductReviews(productId, true, 10, 0),
    ]);

    product.variants = variants;
    product.attributes = attributes;
    product.reviews = reviews;

    return product;
  }

  // Make these methods public so they can be accessed from CustomerService
  static async getProductVariants(productId: string): Promise<any[]> {
    const query = `
      SELECT * FROM product_variants 
      WHERE product_id = $1 AND is_active = TRUE
      ORDER BY name ASC
    `;
    const result = await pool.query(query, [productId]);
    return result.rows;
  }

  static async getProductAttributes(productId: string): Promise<any[]> {
    const query = `
      SELECT * FROM product_attributes 
      WHERE product_id = $1
      ORDER BY attribute_name ASC, attribute_value ASC
    `;
    const result = await pool.query(query, [productId]);
    return result.rows;
  }
}
