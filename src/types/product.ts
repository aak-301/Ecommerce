// src/types/product.ts
export type ProductStatus = "draft" | "active" | "inactive" | "out_of_stock";
export type InventoryChangeType =
  | "stock_in"
  | "stock_out"
  | "adjustment"
  | "sale"
  | "return"
  | "damaged";
export type ImportType = "products" | "inventory" | "categories";
export type ImportStatus = "processing" | "completed" | "failed" | "partial";

export interface Product {
  id: string;
  name: string;
  description?: string;
  short_description?: string;
  sku: string;
  slug: string;
  category_id?: string;

  // Pricing
  price: number;
  sale_price?: number;
  cost_price?: number;

  // Inventory
  quantity: number;
  min_quantity: number;
  max_quantity?: number;
  track_quantity: boolean;
  allow_backorder: boolean;

  // Product status
  status: ProductStatus;
  is_featured: boolean;
  is_digital: boolean;

  // SEO & Marketing
  meta_title?: string;
  meta_description?: string;
  tags?: string[];

  // Media
  featured_image?: string;
  gallery_images?: string[];

  // Dimensions & Shipping
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  shipping_class?: string;

  // User association
  created_by: string;
  updated_by?: string;

  // Timestamps
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
  deleted_by?: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  slug: string;
  parent_id?: string;
  is_active: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  price?: number;
  sale_price?: number;
  quantity: number;
  attributes?: Record<string, any>;
  image?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ProductAttribute {
  id: string;
  product_id: string;
  attribute_name: string;
  attribute_value: string;
  created_at: Date;
}

export interface InventoryHistory {
  id: string;
  product_id?: string;
  variant_id?: string;
  change_type: InventoryChangeType;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  reason?: string;
  reference_id?: string;
  performed_by: string;
  created_at: Date;
}

export interface BulkImportHistory {
  id: string;
  filename: string;
  total_rows: number;
  successful_rows: number;
  failed_rows: number;
  import_type: ImportType;
  status: ImportStatus;
  error_log?: any;
  imported_by: string;
  created_at: Date;
  completed_at?: Date;
}

// Request/Response interfaces
export interface CreateProductRequest {
  name: string;
  description?: string;
  short_description?: string;
  sku?: string; // Optional, will be auto-generated if not provided
  slug?: string; // Optional, will be auto-generated if not provided
  category_id?: string;
  price: number;
  sale_price?: number;
  cost_price?: number;
  quantity?: number;
  min_quantity?: number;
  max_quantity?: number;
  track_quantity?: boolean;
  allow_backorder?: boolean;
  status?: ProductStatus;
  is_featured?: boolean;
  is_digital?: boolean;
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
  attributes?: { name: string; value: string }[];
  variants?: Omit<
    ProductVariant,
    "id" | "product_id" | "created_at" | "updated_at"
  >[];
}

export interface UpdateProductRequest extends Partial<CreateProductRequest> {
  updated_by?: string;
  created_by?: string; // Allow updating product ownership (super admin only)
}

export interface CreateCategoryRequest {
  name: string;
  description?: string;
  slug?: string;
  parent_id?: string;
  is_active?: boolean;
}

export interface UpdateCategoryRequest extends Partial<CreateCategoryRequest> {}

export interface ProductQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  category_id?: string;
  status?: ProductStatus;
  is_featured?: boolean;
  min_price?: number;
  max_price?: number;
  in_stock?: boolean;
  low_stock?: boolean;
  sort_by?: "name" | "price" | "quantity" | "created_at" | "updated_at";
  sort_order?: "asc" | "desc";
  created_by?: string; // For filtering by user
}

export interface InventoryUpdateRequest {
  product_id?: string;
  variant_id?: string;
  quantity_change: number;
  change_type: InventoryChangeType;
  reason?: string;
  reference_id?: string;
}

export interface BulkInventoryUpdateRequest {
  updates: InventoryUpdateRequest[];
}

export interface ProductWithDetails extends Product {
  category_name?: string;
  category_slug?: string;
  created_by_name?: string;
  variants?: ProductVariant[];
  attributes?: ProductAttribute[];
  is_low_stock?: boolean;
}

export interface ProductStats {
  total_products: number;
  active_products: number;
  draft_products: number;
  out_of_stock_products: number;
  low_stock_products: number;
  total_value: number;
}

export interface LowStockProduct {
  product_id: string;
  product_name: string;
  sku: string;
  current_quantity: number;
  min_quantity: number;
  status: ProductStatus;
}

export interface BulkCreateProductsRequest {
  products: CreateProductRequest[];
  skip_errors?: boolean; // Continue processing even if some products fail
}

export interface BulkCreateResponse {
  successful: number;
  failed: number;
  total: number;
  errors?: Array<{
    index: number;
    product: CreateProductRequest;
    error: string;
  }>;
  created_products?: Product[];
}

export interface ExcelImportRequest {
  file: Express.Multer.File;
  import_type: ImportType;
  skip_errors?: boolean;
}

export interface ExcelImportResponse {
  import_id: string;
  status: ImportStatus;
  total_rows: number;
  successful_rows: number;
  failed_rows: number;
  errors?: any[];
}

// Excel template interfaces
export interface ProductExcelRow {
  name: string;
  description?: string;
  short_description?: string;
  sku?: string;
  category_name?: string;
  price: number;
  sale_price?: number;
  cost_price?: number;
  quantity?: number;
  min_quantity?: number;
  max_quantity?: number;
  track_quantity?: boolean;
  allow_backorder?: boolean;
  status?: ProductStatus;
  is_featured?: boolean;
  is_digital?: boolean;
  meta_title?: string;
  meta_description?: string;
  tags?: string; // Comma-separated
  featured_image?: string;
  gallery_images?: string; // Comma-separated URLs
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  shipping_class?: string;
}

export interface InventoryExcelRow {
  sku: string;
  quantity_change: number;
  change_type: InventoryChangeType;
  reason?: string;
}
