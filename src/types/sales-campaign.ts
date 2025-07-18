// src/types/sales-campaign.ts
export type CampaignType =
  | "discount"
  | "bogo"
  | "category_sale"
  | "product_bundle"
  | "flash_sale";
export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "active"
  | "paused"
  | "expired"
  | "cancelled";
export type DiscountType = "percentage" | "fixed_amount" | "free_shipping";
export type AppliesTo =
  | "products"
  | "categories"
  | "all_products"
  | "specific_customers";
export type BogoDiscountType = "free" | "percentage" | "fixed_amount";
export type CouponStatus = "active" | "inactive" | "expired" | "used_up";

// =============================================
// SALES CAMPAIGNS
// =============================================

export interface SalesCampaign {
  id: string;
  name: string;
  description?: string;
  campaign_type: CampaignType;

  // Timing
  start_date: Date;
  end_date: Date;

  // Status
  status: CampaignStatus;

  // Discount configuration
  discount_type?: DiscountType;
  discount_value?: number;
  max_discount_amount?: number;

  // Usage limits
  usage_limit?: number;
  usage_count: number;
  usage_limit_per_customer?: number;

  // Requirements
  minimum_order_amount: number;
  minimum_quantity: number;

  // Targeting
  applies_to: AppliesTo;

  // Additional configuration
  configuration: Record<string, any>;

  // Audit fields
  created_by: string;
  updated_by?: string;
  created_at: Date;
  updated_at: Date;

  // Populated fields
  products?: string[]; // Array of product IDs
  categories?: string[]; // Array of category IDs
  analytics?: CampaignAnalytics;
}

export interface CampaignProduct {
  id: string;
  campaign_id: string;
  product_id: string;
  created_at: Date;
}

export interface CampaignCategory {
  id: string;
  campaign_id: string;
  category_id: string;
  created_at: Date;
}

// =============================================
// BOGO OFFERS
// =============================================

export interface BogoOffer {
  id: string;
  campaign_id?: string;

  // Basic info
  name: string;
  description?: string;

  // Buy requirements
  buy_quantity: number;
  buy_product_id?: string;
  buy_category_id?: string;

  // Get benefits
  get_quantity: number;
  get_product_id?: string;
  get_category_id?: string;
  get_discount_type: BogoDiscountType;
  get_discount_value: number;

  // Timing
  start_date: Date;
  end_date: Date;

  // Status and limits
  status: "active" | "inactive";
  usage_limit?: number;
  usage_count: number;

  // Audit
  created_by: string;
  created_at: Date;
  updated_at: Date;

  // Populated fields
  buy_product?: {
    id: string;
    name: string;
    price: number;
  };
  get_product?: {
    id: string;
    name: string;
    price: number;
  };
  buy_category?: {
    id: string;
    name: string;
  };
  get_category?: {
    id: string;
    name: string;
  };
}

// =============================================
// COUPON CODES
// =============================================

export interface CouponCode {
  id: string;
  campaign_id?: string;

  // Coupon details
  code: string;
  name: string;
  description?: string;

  // Discount configuration
  discount_type: DiscountType;
  discount_value: number;
  max_discount_amount?: number;

  // Usage limits
  usage_limit?: number;
  usage_count: number;
  usage_limit_per_customer?: number;

  // Validity
  valid_from: Date;
  valid_until?: Date;

  // Requirements
  minimum_order_amount: number;

  // Applicability
  applies_to:
    | "all"
    | "products"
    | "categories"
    | "first_order"
    | "returning_customers";

  // Status
  status: CouponStatus;

  // Audit
  created_by: string;
  updated_by?: string;
  created_at: Date;
  updated_at: Date;

  // Populated fields
  products?: string[]; // Array of product IDs
  categories?: string[]; // Array of category IDs
  analytics?: CouponAnalytics;
}

export interface CouponProduct {
  id: string;
  coupon_id: string;
  product_id: string;
  created_at: Date;
}

export interface CouponCategory {
  id: string;
  coupon_id: string;
  category_id: string;
  created_at: Date;
}

// =============================================
// USAGE TRACKING
// =============================================

export interface CampaignUsage {
  id: string;
  campaign_id: string;
  user_id: string;
  order_id: string;

  // Financial details
  discount_amount: number;
  original_amount: number;
  final_amount: number;

  // Tracking
  used_at: Date;
  ip_address?: string;
  user_agent?: string;

  // Populated fields
  campaign?: SalesCampaign;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  order?: {
    id: string;
    order_number: string;
  };
}

export interface CouponUsage {
  id: string;
  coupon_id: string;
  user_id: string;
  order_id: string;

  // Financial details
  discount_amount: number;
  original_amount: number;
  final_amount: number;

  // Tracking
  used_at: Date;
  ip_address?: string;
  user_agent?: string;

  // Populated fields
  coupon?: CouponCode;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  order?: {
    id: string;
    order_number: string;
  };
}

export interface BogoUsage {
  id: string;
  bogo_id: string;
  user_id: string;
  order_id: string;

  // BOGO details
  buy_product_id?: string;
  get_product_id?: string;
  buy_quantity: number;
  get_quantity: number;
  discount_amount: number;

  // Tracking
  used_at: Date;

  // Populated fields
  bogo?: BogoOffer;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  order?: {
    id: string;
    order_number: string;
  };
}

// =============================================
// ANALYTICS
// =============================================

export interface CampaignAnalytics {
  total_usage: number;
  total_revenue: number;
  total_discount_given: number;
  unique_customers: number;
  average_order_value: number;
  conversion_rate: number;

  // Time-based analytics
  daily_usage?: Array<{
    date: string;
    usage_count: number;
    revenue: number;
    discount_given: number;
  }>;

  // Top products/categories
  top_products?: Array<{
    product_id: string;
    product_name: string;
    usage_count: number;
    revenue: number;
  }>;
}

export interface CouponAnalytics {
  total_usage: number;
  total_revenue: number;
  total_discount_given: number;
  unique_customers: number;
  average_order_value: number;
  redemption_rate: number; // usage_count / total_distributed

  // Usage patterns
  usage_by_date?: Array<{
    date: string;
    usage_count: number;
    revenue: number;
  }>;

  // Customer segments
  customer_segments?: {
    new_customers: number;
    returning_customers: number;
  };
}

export interface BogoAnalytics {
  total_offers_redeemed: number;
  total_revenue: number;
  total_discount_given: number;
  unique_customers: number;
  average_order_value: number;

  // Product performance
  most_popular_buy_products?: Array<{
    product_id: string;
    product_name: string;
    times_bought: number;
  }>;

  most_popular_get_products?: Array<{
    product_id: string;
    product_name: string;
    times_received: number;
  }>;
}

// =============================================
// REQUEST/RESPONSE TYPES
// =============================================

export interface CreateCampaignRequest {
  name: string;
  description?: string;
  campaign_type: CampaignType;
  start_date: Date;
  end_date: Date;
  discount_type?: DiscountType;
  discount_value?: number;
  max_discount_amount?: number;
  usage_limit?: number;
  usage_limit_per_customer?: number;
  minimum_order_amount?: number;
  minimum_quantity?: number;
  applies_to: AppliesTo;
  configuration?: Record<string, any>;
  product_ids?: string[];
  category_ids?: string[];
}

export interface UpdateCampaignRequest extends Partial<CreateCampaignRequest> {
  id: string;
  status?: CampaignStatus;
}

export interface CreateBogoOfferRequest {
  campaign_id?: string;
  name: string;
  description?: string;
  buy_quantity: number;
  buy_product_id?: string;
  buy_category_id?: string;
  get_quantity: number;
  get_product_id?: string;
  get_category_id?: string;
  get_discount_type: BogoDiscountType;
  get_discount_value?: number;
  start_date: Date;
  end_date: Date;
  usage_limit?: number;
}

export interface UpdateBogoOfferRequest
  extends Partial<CreateBogoOfferRequest> {
  id: string;
  status?: "active" | "inactive";
}

export interface CreateCouponRequest {
  campaign_id?: string;
  code: string;
  name: string;
  description?: string;
  discount_type: DiscountType;
  discount_value: number;
  max_discount_amount?: number;
  usage_limit?: number;
  usage_limit_per_customer?: number;
  valid_from?: Date;
  valid_until?: Date;
  minimum_order_amount?: number;
  applies_to?:
    | "all"
    | "products"
    | "categories"
    | "first_order"
    | "returning_customers";
  product_ids?: string[];
  category_ids?: string[];
}

export interface UpdateCouponRequest extends Partial<CreateCouponRequest> {
  id: string;
  status?: CouponStatus;
}

export interface CouponValidationRequest {
  code: string;
  user_id: string;
  order_amount: number;
  product_ids?: string[];
  category_ids?: string[];
}

export interface CouponValidationResponse {
  is_valid: boolean;
  coupon_id?: string;
  discount_amount: number;
  error_message?: string;
  coupon_details?: {
    name: string;
    description?: string;
    discount_type: DiscountType;
    discount_value: number;
    expires_at?: Date;
  };
}

export interface ApplyCampaignRequest {
  campaign_id: string;
  user_id: string;
  order_id: string;
  original_amount: number;
  ip_address?: string;
  user_agent?: string;
}

export interface ApplyCouponRequest {
  coupon_code: string;
  user_id: string;
  order_id: string;
  original_amount: number;
  ip_address?: string;
  user_agent?: string;
}

export interface ApplyBogoRequest {
  bogo_id: string;
  user_id: string;
  order_id: string;
  buy_product_id?: string;
  get_product_id?: string;
  buy_quantity: number;
  get_quantity: number;
  discount_amount: number;
}

// =============================================
// SEARCH PARAMETERS
// =============================================

export interface CampaignSearchParams {
  search?: string;
  campaign_type?: CampaignType;
  status?: CampaignStatus;
  applies_to?: AppliesTo;
  start_date_from?: Date;
  start_date_to?: Date;
  end_date_from?: Date;
  end_date_to?: Date;
  created_by?: string;
  sort_by?: "name" | "start_date" | "end_date" | "created_at" | "usage_count";
  sort_order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface CouponSearchParams {
  search?: string;
  status?: CouponStatus;
  discount_type?: DiscountType;
  applies_to?: string;
  valid_from?: Date;
  valid_until?: Date;
  created_by?: string;
  sort_by?: "code" | "name" | "created_at" | "valid_until" | "usage_count";
  sort_order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface BogoSearchParams {
  search?: string;
  status?: "active" | "inactive";
  start_date_from?: Date;
  start_date_to?: Date;
  end_date_from?: Date;
  end_date_to?: Date;
  created_by?: string;
  sort_by?: "name" | "start_date" | "end_date" | "created_at" | "usage_count";
  sort_order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

// =============================================
// UTILITY TYPES
// =============================================

export interface DiscountCalculation {
  original_amount: number;
  discount_amount: number;
  final_amount: number;
  discount_source: "campaign" | "coupon" | "bogo";
  discount_details: {
    id: string;
    name: string;
    type: string;
    value: number;
  };
}

export interface PriceBreakdown {
  subtotal: number;
  campaign_discounts: DiscountCalculation[];
  coupon_discounts: DiscountCalculation[];
  bogo_discounts: DiscountCalculation[];
  total_discounts: number;
  final_amount: number;
}

export interface CampaignEligibility {
  campaign_id: string;
  is_eligible: boolean;
  reason?: string;
  discount_amount: number;
}

export interface ActivePromotions {
  campaigns: SalesCampaign[];
  bogo_offers: BogoOffer[];
  applicable_coupons: CouponCode[];
}

// =============================================
// DASHBOARD STATS
// =============================================

export interface SalesDashboardStats {
  total_active_campaigns: number;
  total_active_coupons: number;
  total_active_bogo_offers: number;

  // Revenue impact
  total_revenue_with_promotions: number;
  total_discounts_given: number;
  promotion_revenue_percentage: number;

  // Usage stats
  campaigns_used_today: number;
  coupons_redeemed_today: number;
  bogo_offers_used_today: number;

  // Top performers
  top_performing_campaigns: Array<{
    id: string;
    name: string;
    revenue: number;
    usage_count: number;
  }>;

  top_redeemed_coupons: Array<{
    id: string;
    code: string;
    name: string;
    redemption_count: number;
  }>;
}

export interface CampaignPerformanceReport {
  campaign: SalesCampaign;
  analytics: CampaignAnalytics;
  product_performance?: Array<{
    product_id: string;
    product_name: string;
    sales_with_campaign: number;
    revenue_with_campaign: number;
    conversion_rate: number;
  }>;
  time_series_data?: Array<{
    date: string;
    usage_count: number;
    revenue: number;
    unique_customers: number;
  }>;
}
