// src/types/customer.ts
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "partial_refund";

export type AddressType = "shipping" | "billing";

export interface CustomerAddress {
  id: string;
  customer_id: string;
  type: AddressType;
  is_default: boolean;
  first_name: string;
  last_name: string;
  company?: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CartItem {
  id: string;
  customer_id: string;
  product_id: string;
  variant_id?: string;
  quantity: number;
  price_at_time: number;
  created_at: Date;
  updated_at: Date;
  // Populated fields
  product_name?: string;
  product_slug?: string;
  product_image?: string;
  variant_name?: string;
  variant_attributes?: Record<string, any>;
  current_price?: number;
  is_available?: boolean;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  subtotal: number;
  tax_amount: number;
  shipping_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_method?: string;
  payment_reference?: string;
  shipping_address: CustomerAddress;
  billing_address: CustomerAddress;
  customer_notes?: string;
  admin_notes?: string;
  created_at: Date;
  updated_at: Date;
  shipped_at?: Date;
  delivered_at?: Date;
  cancelled_at?: Date;
  cancelled_by?: string;
  cancellation_reason?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  variant_id?: string;
  product_name: string;
  product_sku: string;
  variant_name?: string;
  variant_sku?: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  created_at: Date;
  // Populated fields
  product_image?: string;
  product_slug?: string;
}

export interface ProductReview {
  id: string;
  product_id: string;
  customer_id: string;
  order_id?: string;
  rating: number;
  title?: string;
  review_text?: string;
  is_verified_purchase: boolean;
  is_approved: boolean;
  created_at: Date;
  updated_at: Date;
  // Populated fields
  customer_name?: string;
  product_name?: string;
}

export interface WishlistItem {
  id: string;
  customer_id: string;
  product_id: string;
  created_at: Date;
  // Populated fields
  product_name?: string;
  product_slug?: string;
  product_price?: number;
  product_sale_price?: number;
  product_image?: string;
  is_available?: boolean;
}

// Request/Response interfaces
export interface CreateAddressRequest {
  type: AddressType;
  is_default?: boolean;
  first_name: string;
  last_name: string;
  company?: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country?: string;
  phone?: string;
}

export interface UpdateAddressRequest extends Partial<CreateAddressRequest> {}

export interface AddToCartRequest {
  product_id: string;
  variant_id?: string;
  quantity?: number;
}

export interface UpdateCartItemRequest {
  quantity: number;
}

export interface PlaceOrderRequest {
  shipping_address_id: string;
  billing_address_id: string;
  customer_notes?: string;
  payment_method: string;
}

export interface CreateReviewRequest {
  product_id: string;
  order_id?: string;
  rating: number;
  title?: string;
  review_text?: string;
}

export interface UpdateReviewRequest extends Partial<CreateReviewRequest> {}

export interface CustomerOrderQueryParams {
  page?: number;
  limit?: number;
  status?: OrderStatus;
  payment_status?: PaymentStatus;
  start_date?: string;
  end_date?: string;
  sort_by?: "created_at" | "total_amount" | "status";
  sort_order?: "asc" | "desc";
}

export interface CustomerProductQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  category_id?: string;
  min_price?: number;
  max_price?: number;
  in_stock?: boolean;
  featured?: boolean;
  sort_by?: "name" | "price" | "created_at" | "rating";
  sort_order?: "asc" | "desc";
  tags?: string[];
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
  customer_name?: string;
  customer_email?: string;
  total_items: number;
  total_quantity: number;
}

export interface CartSummary {
  items: CartItem[];
  total_items: number;
  total_quantity: number;
  subtotal: number;
  estimated_tax: number;
  estimated_shipping: number;
  estimated_total: number;
}

export interface CustomerOrderStats {
  total_orders: number;
  total_spent: number;
  pending_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  average_order_value: number;
}

export interface ProductWithReviews {
  id: string;
  name: string;
  description?: string;
  short_description?: string;
  sku: string;
  slug: string;
  category_id?: string;
  price: number;
  sale_price?: number;
  quantity: number;
  status: string;
  is_featured: boolean;
  is_digital: boolean;
  meta_title?: string;
  meta_description?: string;
  tags?: string[];
  featured_image?: string;
  gallery_images?: string[];
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  shipping_class?: string;
  created_at: Date;
  updated_at: Date;
  // Populated fields
  category_name?: string;
  category_slug?: string;
  average_rating: number;
  review_count: number;
  is_low_stock: boolean;
  variants?: any[];
  attributes?: any[];
  reviews?: ProductReview[];
}

export interface CancelOrderRequest {
  reason?: string;
}

export interface OrderCancellationResponse {
  success: boolean;
  message: string;
  refund_amount?: number;
  refund_method?: string;
  estimated_refund_date?: Date;
}
