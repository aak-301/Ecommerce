// src/types/product.ts
export type ProductStatus = "draft" | "published" | "archived";
export type ProductVisibility = "public" | "private" | "hidden";
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded"
  | "partially_refunded";
export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "partially_refunded";
export type StockMovementType =
  | "stock_in"
  | "stock_out"
  | "adjustment"
  | "sale"
  | "return"
  | "damaged"
  | "transfer";
export type ImportStatus =
  | "processing"
  | "completed"
  | "failed"
  | "partially_completed";

export interface Category {
  id: string;
  name: string;
  description?: string;
  slug: string;
  parent_id?: string;
  image_url?: string;
  is_active: boolean;
  sort_order: number;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
  deleted_by?: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  short_description?: string;
  slug: string;
  sku: string;
  category_id: string;

  // Pricing
  price: number;
  sale_price?: number;
  cost_price?: number;

  // Inventory
  quantity: number;
  low_stock_threshold: number;
  track_quantity: boolean;
  allow_backorders: boolean;

  // Physical attributes
  weight?: number;
  dimensions_length?: number;
  dimensions_width?: number;
  dimensions_height?: number;

  // Status and visibility
  status: ProductStatus;
  visibility: ProductVisibility;
  featured: boolean;

  // SEO
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;

  // Additional data
  tags?: string[];
  attributes?: Record<string, any>;

  // Audit fields
  created_by: string;
  updated_by?: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
  deleted_by?: string;

  // Populated fields (not in DB)
  category?: Category;
  images?: ProductImage[];
  variants?: ProductVariant[];
  primary_image?: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  alt_text?: string;
  is_primary: boolean;
  sort_order: number;
  created_at: Date;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string;
  name: string;
  price?: number;
  sale_price?: number;
  quantity: number;
  attributes: Record<string, any>;
  image_url?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ShoppingCart {
  id: string;
  user_id: string;
  session_id?: string;
  status: "active" | "abandoned" | "converted";
  created_at: Date;
  updated_at: Date;
  expires_at: Date;

  // Populated fields
  items?: CartItem[];
  total?: number;
  item_count?: number;
}

export interface CartItem {
  id: string;
  cart_id: string;
  product_id: string;
  variant_id?: string;
  quantity: number;
  price: number;
  created_at: Date;
  updated_at: Date;

  // Populated fields
  product?: Product;
  variant?: ProductVariant;
  total_price?: number;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;

  // Order totals
  subtotal: number;
  tax_amount: number;
  shipping_amount: number;
  discount_amount: number;
  total_amount: number;

  // Order status
  status: OrderStatus;
  payment_status: PaymentStatus;

  // Shipping information
  shipping_address?: Record<string, any>;
  billing_address?: Record<string, any>;
  shipping_method?: string;
  tracking_number?: string;

  // Additional information
  notes?: string;
  internal_notes?: string;

  // Timestamps
  created_at: Date;
  updated_at: Date;
  shipped_at?: Date;
  delivered_at?: Date;

  // Populated fields
  items?: OrderItem[];
  customer?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  variant_id?: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product_snapshot?: Record<string, any>;
  created_at: Date;

  // Populated fields
  product?: Product;
  variant?: ProductVariant;
}

export interface StockMovement {
  id: string;
  product_id: string;
  variant_id?: string;
  movement_type: StockMovementType;
  quantity_change: number;
  quantity_after: number;
  reference_type?: string;
  reference_id?: string;
  reason?: string;
  performed_by: string;
  created_at: Date;

  // Populated fields
  product?: Product;
  variant?: ProductVariant;
  performed_by_name?: string;
}

export interface ProductImport {
  id: string;
  filename: string;
  file_path?: string;
  total_rows: number;
  successful_rows: number;
  failed_rows: number;
  status: ImportStatus;
  error_log?: Record<string, any>;
  import_summary?: Record<string, any>;
  performed_by: string;
  created_at: Date;
  completed_at?: Date;

  // Populated fields
  performed_by_name?: string;
}

// Request/Response types
export interface CreateProductRequest {
  name: string;
  description?: string;
  short_description?: string;
  category_id: string;
  price: number;
  sale_price?: number;
  cost_price?: number;
  quantity?: number;
  low_stock_threshold?: number;
  track_quantity?: boolean;
  allow_backorders?: boolean;
  weight?: number;
  dimensions_length?: number;
  dimensions_width?: number;
  dimensions_height?: number;
  status?: ProductStatus;
  visibility?: ProductVisibility;
  featured?: boolean;
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
  tags?: string[];
  attributes?: Record<string, any>;
  images?: {
    url: string;
    alt_text?: string;
    is_primary?: boolean;
  }[];
  variants?: {
    name: string;
    price?: number;
    sale_price?: number;
    quantity: number;
    attributes: Record<string, any>;
    image_url?: string;
  }[];
}

export interface UpdateProductRequest extends Partial<CreateProductRequest> {
  id: string;
}

export interface CreateCategoryRequest {
  name: string;
  description?: string;
  parent_id?: string;
  image_url?: string;
  sort_order?: number;
}

export interface UpdateCategoryRequest extends Partial<CreateCategoryRequest> {
  id: string;
}

export interface AddToCartRequest {
  product_id: string;
  variant_id?: string;
  quantity: number;
}

export interface UpdateCartItemRequest {
  quantity: number;
}

export interface CreateOrderRequest {
  shipping_address?: Record<string, any>;
  billing_address?: Record<string, any>;
  shipping_method?: string;
  notes?: string;
}

export interface UpdateOrderRequest {
  status?: OrderStatus;
  payment_status?: PaymentStatus;
  shipping_method?: string;
  tracking_number?: string;
  internal_notes?: string;
  shipped_at?: Date;
  delivered_at?: Date;
}

export interface ProductSearchParams {
  search?: string;
  category_id?: string;
  status?: ProductStatus;
  visibility?: ProductVisibility;
  featured?: boolean;
  min_price?: number;
  max_price?: number;
  in_stock?: boolean;
  low_stock?: boolean;
  tags?: string[];
  sort_by?: "name" | "price" | "created_at" | "updated_at" | "quantity";
  sort_order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface OrderSearchParams {
  user_id?: string;
  status?: OrderStatus;
  payment_status?: PaymentStatus;
  date_from?: Date;
  date_to?: Date;
  search?: string; // Search by order number, customer name, email
  sort_by?: "created_at" | "total_amount" | "order_number";
  sort_order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface ProductStats {
  total_products: number;
  published_products: number;
  draft_products: number;
  archived_products: number;
  low_stock_products: number;
  out_of_stock_products: number;
  total_categories: number;
  featured_products: number;
}

export interface InventoryStats {
  total_stock_value: number;
  low_stock_items: number;
  out_of_stock_items: number;
  total_products_tracked: number;
  recent_movements: number;
}

export interface SalesStats {
  total_orders: number;
  pending_orders: number;
  completed_orders: number;
  total_revenue: number;
  average_order_value: number;
  top_selling_products: {
    product_id: string;
    product_name: string;
    total_sold: number;
    revenue: number;
  }[];
}

// Excel import/export types
export interface ProductExcelRow {
  name: string;
  description?: string;
  category: string; // Category name or slug
  sku: string;
  price: number;
  sale_price?: number;
  quantity: number;
  weight?: number;
  status?: string;
  featured?: boolean;
  tags?: string; // Comma-separated
}

export interface ImportResult {
  success: boolean;
  total_rows: number;
  successful_rows: number;
  failed_rows: number;
  errors: {
    row: number;
    error: string;
  }[];
  created_products: string[]; // Product IDs
  updated_products: string[]; // Product IDs
}

// Utility types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface PriceRange {
  min_price: number;
  max_price: number;
  min_sale_price?: number;
  max_sale_price?: number;
}

export interface StockStatus {
  product_id: string;
  variant_id?: string;
  current_quantity: number;
  status: "in_stock" | "low_stock" | "out_of_stock";
  threshold?: number;
}
