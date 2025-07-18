-- Advanced Sales Campaigns & Offers Extension
-- This extends the existing product management system with comprehensive sales features

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- SALES CAMPAIGNS TABLES
-- =============================================

-- Sales campaigns table for managing named campaigns
CREATE TABLE IF NOT EXISTS sales_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    campaign_type VARCHAR(50) NOT NULL DEFAULT 'discount' CHECK (campaign_type IN (
        'discount', 'bogo', 'category_sale', 'product_bundle', 'flash_sale'
    )),
    
    -- Campaign timing
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Campaign status
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft', 'scheduled', 'active', 'paused', 'expired', 'cancelled'
    )),
    
    -- Discount configuration
    discount_type VARCHAR(50) CHECK (discount_type IN ('percentage', 'fixed_amount')),
    discount_value DECIMAL(10, 2) CHECK (discount_value >= 0),
    max_discount_amount DECIMAL(10, 2) CHECK (max_discount_amount >= 0),
    
    -- Usage limits
    usage_limit INTEGER CHECK (usage_limit > 0),
    usage_count INTEGER DEFAULT 0 CHECK (usage_count >= 0),
    usage_limit_per_customer INTEGER CHECK (usage_limit_per_customer > 0),
    
    -- Minimum requirements
    minimum_order_amount DECIMAL(10, 2) DEFAULT 0 CHECK (minimum_order_amount >= 0),
    minimum_quantity INTEGER DEFAULT 1 CHECK (minimum_quantity >= 1),
    
    -- Campaign targeting
    applies_to VARCHAR(50) NOT NULL DEFAULT 'products' CHECK (applies_to IN (
        'products', 'categories', 'all_products', 'specific_customers'
    )),
    
    -- Additional configuration as JSON
    configuration JSONB DEFAULT '{}',
    
    -- Audit fields
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_date_range CHECK (end_date > start_date),
    CONSTRAINT valid_usage_counts CHECK (usage_count <= COALESCE(usage_limit, usage_count))
);

-- Campaign products junction table (for product-specific campaigns)
CREATE TABLE IF NOT EXISTS campaign_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES sales_campaigns(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(campaign_id, product_id)
);

-- Campaign categories junction table (for category-wide campaigns)
CREATE TABLE IF NOT EXISTS campaign_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES sales_campaigns(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(campaign_id, category_id)
);

-- =============================================
-- BOGO OFFERS TABLES
-- =============================================

-- BOGO (Buy One Get One) offers
CREATE TABLE IF NOT EXISTS bogo_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES sales_campaigns(id) ON DELETE CASCADE,
    
    -- BOGO configuration
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Buy requirements
    buy_quantity INTEGER NOT NULL DEFAULT 1 CHECK (buy_quantity > 0),
    buy_product_id UUID REFERENCES products(id),
    buy_category_id UUID REFERENCES categories(id),
    
    -- Get benefits
    get_quantity INTEGER NOT NULL DEFAULT 1 CHECK (get_quantity > 0),
    get_product_id UUID REFERENCES products(id),
    get_category_id UUID REFERENCES categories(id),
    get_discount_type VARCHAR(50) NOT NULL DEFAULT 'free' CHECK (get_discount_type IN (
        'free', 'percentage', 'fixed_amount'
    )),
    get_discount_value DECIMAL(10, 2) DEFAULT 0 CHECK (get_discount_value >= 0),
    
    -- Timing
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Status and limits
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    usage_limit INTEGER CHECK (usage_limit > 0),
    usage_count INTEGER DEFAULT 0 CHECK (usage_count >= 0),
    
    -- Audit fields
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_bogo_dates CHECK (end_date > start_date),
    CONSTRAINT valid_bogo_products CHECK (
        (buy_product_id IS NOT NULL OR buy_category_id IS NOT NULL) AND
        (get_product_id IS NOT NULL OR get_category_id IS NOT NULL)
    )
);

-- =============================================
-- COUPON CODES TABLES
-- =============================================

-- Coupon codes table
CREATE TABLE IF NOT EXISTS coupon_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES sales_campaigns(id) ON DELETE SET NULL,
    
    -- Coupon details
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Discount configuration
    discount_type VARCHAR(50) NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount', 'free_shipping')),
    discount_value DECIMAL(10, 2) NOT NULL CHECK (discount_value >= 0),
    max_discount_amount DECIMAL(10, 2) CHECK (max_discount_amount >= 0),
    
    -- Usage limits
    usage_limit INTEGER CHECK (usage_limit > 0),
    usage_count INTEGER DEFAULT 0 CHECK (usage_count >= 0),
    usage_limit_per_customer INTEGER CHECK (usage_limit_per_customer > 0),
    
    -- Validity period
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP WITH TIME ZONE,
    
    -- Minimum requirements
    minimum_order_amount DECIMAL(10, 2) DEFAULT 0 CHECK (minimum_order_amount >= 0),
    
    -- Applicability
    applies_to VARCHAR(50) NOT NULL DEFAULT 'all' CHECK (applies_to IN (
        'all', 'products', 'categories', 'first_order', 'returning_customers'
    )),
    
    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN (
        'active', 'inactive', 'expired', 'used_up'
    )),
    
    -- Audit fields
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_coupon_dates CHECK (valid_until IS NULL OR valid_until > valid_from),
    CONSTRAINT valid_usage_counts CHECK (usage_count <= COALESCE(usage_limit, usage_count))
);

-- Coupon products junction table (for product-specific coupons)
CREATE TABLE IF NOT EXISTS coupon_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coupon_id UUID NOT NULL REFERENCES coupon_codes(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(coupon_id, product_id)
);

-- Coupon categories junction table (for category-specific coupons)
CREATE TABLE IF NOT EXISTS coupon_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coupon_id UUID NOT NULL REFERENCES coupon_codes(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(coupon_id, category_id)
);

-- =============================================
-- USAGE TRACKING TABLES
-- =============================================

-- Campaign usage tracking
CREATE TABLE IF NOT EXISTS campaign_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES sales_campaigns(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    
    -- Usage details
    discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    original_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    final_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    
    -- Tracking
    used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    
    UNIQUE(campaign_id, order_id)
);

-- Coupon usage tracking
CREATE TABLE IF NOT EXISTS coupon_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coupon_id UUID NOT NULL REFERENCES coupon_codes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    
    -- Usage details
    discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    original_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    final_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    
    -- Tracking
    used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    
    UNIQUE(coupon_id, order_id)
);

-- BOGO usage tracking
CREATE TABLE IF NOT EXISTS bogo_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bogo_id UUID NOT NULL REFERENCES bogo_offers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    
    -- BOGO details
    buy_product_id UUID REFERENCES products(id),
    get_product_id UUID REFERENCES products(id),
    buy_quantity INTEGER NOT NULL,
    get_quantity INTEGER NOT NULL,
    discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    
    -- Tracking
    used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Sales campaigns indexes
CREATE INDEX IF NOT EXISTS idx_sales_campaigns_status ON sales_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_sales_campaigns_dates ON sales_campaigns(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_sales_campaigns_type ON sales_campaigns(campaign_type);
CREATE INDEX IF NOT EXISTS idx_sales_campaigns_active ON sales_campaigns(status, start_date, end_date) 
    WHERE status = 'active';

-- Campaign junction tables indexes
CREATE INDEX IF NOT EXISTS idx_campaign_products_campaign ON campaign_products(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_products_product ON campaign_products(product_id);
CREATE INDEX IF NOT EXISTS idx_campaign_categories_campaign ON campaign_categories(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_categories_category ON campaign_categories(category_id);

-- BOGO offers indexes
CREATE INDEX IF NOT EXISTS idx_bogo_offers_status ON bogo_offers(status);
CREATE INDEX IF NOT EXISTS idx_bogo_offers_dates ON bogo_offers(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_bogo_offers_active ON bogo_offers(status, start_date, end_date)
    WHERE status = 'active';

-- Coupon codes indexes
CREATE INDEX IF NOT EXISTS idx_coupon_codes_code ON coupon_codes(code);
CREATE INDEX IF NOT EXISTS idx_coupon_codes_status ON coupon_codes(status);
CREATE INDEX IF NOT EXISTS idx_coupon_codes_validity ON coupon_codes(valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_coupon_codes_active ON coupon_codes(status, valid_from, valid_until)
    WHERE status = 'active';

-- Coupon junction tables indexes
CREATE INDEX IF NOT EXISTS idx_coupon_products_coupon ON coupon_products(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_products_product ON coupon_products(product_id);
CREATE INDEX IF NOT EXISTS idx_coupon_categories_coupon ON coupon_categories(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_categories_category ON coupon_categories(category_id);

-- Usage tracking indexes
CREATE INDEX IF NOT EXISTS idx_campaign_usage_campaign ON campaign_usage(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_usage_user ON campaign_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_usage_order ON campaign_usage(order_id);
CREATE INDEX IF NOT EXISTS idx_campaign_usage_date ON campaign_usage(used_at);

CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon ON coupon_usage(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user ON coupon_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_order ON coupon_usage(order_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_date ON coupon_usage(used_at);

CREATE INDEX IF NOT EXISTS idx_bogo_usage_bogo ON bogo_usage(bogo_id);
CREATE INDEX IF NOT EXISTS idx_bogo_usage_user ON bogo_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_bogo_usage_order ON bogo_usage(order_id);

-- =============================================
-- TRIGGERS AND FUNCTIONS
-- =============================================

-- Function to update updated_at timestamp for sales tables
CREATE OR REPLACE FUNCTION update_sales_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_sales_campaigns_updated_at
    BEFORE UPDATE ON sales_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_sales_updated_at();

CREATE TRIGGER update_coupon_codes_updated_at
    BEFORE UPDATE ON coupon_codes
    FOR EACH ROW
    EXECUTE FUNCTION update_sales_updated_at();

CREATE TRIGGER update_bogo_offers_updated_at
    BEFORE UPDATE ON bogo_offers
    FOR EACH ROW
    EXECUTE FUNCTION update_sales_updated_at();

-- Function to automatically update campaign status based on dates
CREATE OR REPLACE FUNCTION update_campaign_status()
RETURNS void AS $$
BEGIN
    -- Activate scheduled campaigns
    UPDATE sales_campaigns 
    SET status = 'active', updated_at = NOW()
    WHERE status = 'scheduled' 
    AND start_date <= NOW() 
    AND end_date > NOW();
    
    -- Expire active campaigns
    UPDATE sales_campaigns 
    SET status = 'expired', updated_at = NOW()
    WHERE status IN ('active', 'scheduled') 
    AND end_date <= NOW();
    
    -- Update coupon status
    UPDATE coupon_codes 
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'active' 
    AND valid_until IS NOT NULL 
    AND valid_until <= NOW();
    
    -- Mark coupons as used up
    UPDATE coupon_codes 
    SET status = 'used_up', updated_at = NOW()
    WHERE status = 'active' 
    AND usage_limit IS NOT NULL 
    AND usage_count >= usage_limit;
    
    -- Update BOGO offers
    UPDATE bogo_offers 
    SET status = 'inactive', updated_at = NOW()
    WHERE status = 'active' 
    AND end_date <= NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to increment usage counts
CREATE OR REPLACE FUNCTION increment_campaign_usage()
RETURNS TRIGGER AS $$
BEGIN
    -- Update campaign usage count
    IF NEW.campaign_id IS NOT NULL THEN
        UPDATE sales_campaigns 
        SET usage_count = usage_count + 1, updated_at = NOW()
        WHERE id = NEW.campaign_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_coupon_usage()
RETURNS TRIGGER AS $$
BEGIN
    -- Update coupon usage count
    UPDATE coupon_codes 
    SET usage_count = usage_count + 1, updated_at = NOW()
    WHERE id = NEW.coupon_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_bogo_usage()
RETURNS TRIGGER AS $$
BEGIN
    -- Update BOGO usage count
    UPDATE bogo_offers 
    SET usage_count = usage_count + 1, updated_at = NOW()
    WHERE id = NEW.bogo_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for usage count increments
CREATE TRIGGER increment_campaign_usage_trigger
    AFTER INSERT ON campaign_usage
    FOR EACH ROW
    EXECUTE FUNCTION increment_campaign_usage();

CREATE TRIGGER increment_coupon_usage_trigger
    AFTER INSERT ON coupon_usage
    FOR EACH ROW
    EXECUTE FUNCTION increment_coupon_usage();

CREATE TRIGGER increment_bogo_usage_trigger
    AFTER INSERT ON bogo_usage
    FOR EACH ROW
    EXECUTE FUNCTION increment_bogo_usage();

-- =============================================
-- UTILITY FUNCTIONS
-- =============================================

-- Function to get active campaigns for a product
CREATE OR REPLACE FUNCTION get_active_campaigns_for_product(product_id_param UUID)
RETURNS TABLE (
    campaign_id UUID,
    campaign_name VARCHAR(255),
    campaign_type VARCHAR(50),
    discount_type VARCHAR(50),
    discount_value DECIMAL(10, 2),
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sc.id,
        sc.name,
        sc.campaign_type,
        sc.discount_type,
        sc.discount_value,
        sc.start_date,
        sc.end_date
    FROM sales_campaigns sc
    WHERE sc.status = 'active'
    AND sc.start_date <= NOW()
    AND sc.end_date > NOW()
    AND (
        sc.applies_to = 'all_products'
        OR (sc.applies_to = 'products' AND EXISTS (
            SELECT 1 FROM campaign_products cp 
            WHERE cp.campaign_id = sc.id AND cp.product_id = product_id_param
        ))
        OR (sc.applies_to = 'categories' AND EXISTS (
            SELECT 1 FROM campaign_categories cc 
            JOIN products p ON cc.category_id = p.category_id
            WHERE cc.campaign_id = sc.id AND p.id = product_id_param
        ))
    )
    ORDER BY sc.discount_value DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to validate coupon code
CREATE OR REPLACE FUNCTION validate_coupon_code(
    coupon_code_param VARCHAR(50),
    user_id_param UUID,
    order_amount_param DECIMAL(10, 2)
)
RETURNS TABLE (
    is_valid BOOLEAN,
    coupon_id UUID,
    discount_amount DECIMAL(10, 2),
    error_message TEXT
) AS $$
DECLARE
    coupon_record coupon_codes%ROWTYPE;
    user_usage_count INTEGER;
    calculated_discount DECIMAL(10, 2);
BEGIN
    -- Get coupon details
    SELECT * INTO coupon_record 
    FROM coupon_codes 
    WHERE code = coupon_code_param;
    
    -- Check if coupon exists
    IF coupon_record.id IS NULL THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 0::DECIMAL(10, 2), 'Coupon code not found';
        RETURN;
    END IF;
    
    -- Check if coupon is active
    IF coupon_record.status != 'active' THEN
        RETURN QUERY SELECT FALSE, coupon_record.id, 0::DECIMAL(10, 2), 'Coupon is not active';
        RETURN;
    END IF;
    
    -- Check validity dates
    IF coupon_record.valid_from > NOW() THEN
        RETURN QUERY SELECT FALSE, coupon_record.id, 0::DECIMAL(10, 2), 'Coupon is not yet valid';
        RETURN;
    END IF;
    
    IF coupon_record.valid_until IS NOT NULL AND coupon_record.valid_until <= NOW() THEN
        RETURN QUERY SELECT FALSE, coupon_record.id, 0::DECIMAL(10, 2), 'Coupon has expired';
        RETURN;
    END IF;
    
    -- Check usage limits
    IF coupon_record.usage_limit IS NOT NULL AND coupon_record.usage_count >= coupon_record.usage_limit THEN
        RETURN QUERY SELECT FALSE, coupon_record.id, 0::DECIMAL(10, 2), 'Coupon usage limit reached';
        RETURN;
    END IF;
    
    -- Check per-customer usage limit
    IF coupon_record.usage_limit_per_customer IS NOT NULL THEN
        SELECT COUNT(*) INTO user_usage_count
        FROM coupon_usage 
        WHERE coupon_id = coupon_record.id AND user_id = user_id_param;
        
        IF user_usage_count >= coupon_record.usage_limit_per_customer THEN
            RETURN QUERY SELECT FALSE, coupon_record.id, 0::DECIMAL(10, 2), 'Personal usage limit reached for this coupon';
            RETURN;
        END IF;
    END IF;
    
    -- Check minimum order amount
    IF order_amount_param < coupon_record.minimum_order_amount THEN
        RETURN QUERY SELECT FALSE, coupon_record.id, 0::DECIMAL(10, 2), 
            FORMAT('Minimum order amount of $%.2f required', coupon_record.minimum_order_amount);
        RETURN;
    END IF;
    
    -- Calculate discount
    IF coupon_record.discount_type = 'percentage' THEN
        calculated_discount = order_amount_param * (coupon_record.discount_value / 100);
        IF coupon_record.max_discount_amount IS NOT NULL THEN
            calculated_discount = LEAST(calculated_discount, coupon_record.max_discount_amount);
        END IF;
    ELSIF coupon_record.discount_type = 'fixed_amount' THEN
        calculated_discount = LEAST(coupon_record.discount_value, order_amount_param);
    ELSE
        calculated_discount = 0;
    END IF;
    
    -- Return valid result
    RETURN QUERY SELECT TRUE, coupon_record.id, calculated_discount, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to get campaign analytics
CREATE OR REPLACE FUNCTION get_campaign_analytics(campaign_id_param UUID)
RETURNS TABLE (
    total_usage INTEGER,
    total_revenue DECIMAL(10, 2),
    total_discount_given DECIMAL(10, 2),
    unique_customers INTEGER,
    average_order_value DECIMAL(10, 2),
    conversion_rate DECIMAL(5, 2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(cu.id)::INTEGER as total_usage,
        COALESCE(SUM(cu.final_amount), 0) as total_revenue,
        COALESCE(SUM(cu.discount_amount), 0) as total_discount_given,
        COUNT(DISTINCT cu.user_id)::INTEGER as unique_customers,
        COALESCE(AVG(cu.final_amount), 0) as average_order_value,
        CASE 
            WHEN COUNT(cu.id) > 0 THEN 
                (COUNT(DISTINCT cu.user_id)::DECIMAL / COUNT(cu.id) * 100)
            ELSE 0 
        END as conversion_rate
    FROM campaign_usage cu
    WHERE cu.campaign_id = campaign_id_param;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- SAMPLE DATA
-- =============================================

-- Insert sample sales campaign
INSERT INTO sales_campaigns (
    name, description, campaign_type, start_date, end_date, 
    discount_type, discount_value, applies_to, created_by
) 
SELECT 
    'Black Friday 2024',
    'Massive discounts on electronics for Black Friday',
    'discount',
    '2024-11-29 00:00:00'::TIMESTAMP WITH TIME ZONE,
    '2024-11-30 23:59:59'::TIMESTAMP WITH TIME ZONE,
    'percentage',
    25.00,
    'categories',
    u.id
FROM users u 
WHERE u.role = 'super_admin' 
LIMIT 1
ON CONFLICT DO NOTHING;

-- Insert sample coupon code
INSERT INTO coupon_codes (
    code, name, description, discount_type, discount_value, 
    max_discount_amount, usage_limit, minimum_order_amount, created_by
) 
SELECT 
    'WELCOME10',
    'Welcome Discount',
    '10% off for new customers',
    'percentage',
    10.00,
    50.00,
    1000,
    25.00,
    u.id
FROM users u 
WHERE u.role = 'super_admin' 
LIMIT 1
ON CONFLICT (code) DO NOTHING;

-- =============================================
-- VERIFICATION
-- =============================================

-- Verify all tables exist
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN (
        'sales_campaigns', 'campaign_products', 'campaign_categories',
        'bogo_offers', 'coupon_codes', 'coupon_products', 'coupon_categories',
        'campaign_usage', 'coupon_usage', 'bogo_usage'
    );
    
    IF table_count = 10 THEN
        RAISE NOTICE 'SUCCESS: All sales campaign tables created (%)!', table_count;
    ELSE
        RAISE WARNING 'WARNING: Missing sales campaign tables! Expected 10, found %', table_count;
    END IF;
END $$;

-- Final message
RAISE NOTICE '';
RAISE NOTICE '🎯 Advanced Sales & Campaigns System Initialized Successfully!';
RAISE NOTICE '================================================================';
RAISE NOTICE '';
RAISE NOTICE '📊 Created Tables (10):';
RAISE NOTICE '   ✓ sales_campaigns (main campaigns table)';
RAISE NOTICE '   ✓ campaign_products (product-specific campaigns)';
RAISE NOTICE '   ✓ campaign_categories (category-wide campaigns)';
RAISE NOTICE '   ✓ bogo_offers (buy-one-get-one offers)';
RAISE NOTICE '   ✓ coupon_codes (discount coupon codes)';
RAISE NOTICE '   ✓ coupon_products (product-specific coupons)';
RAISE NOTICE '   ✓ coupon_categories (category-specific coupons)';
RAISE NOTICE '   ✓ campaign_usage (campaign analytics tracking)';
RAISE NOTICE '   ✓ coupon_usage (coupon analytics tracking)';
RAISE NOTICE '   ✓ bogo_usage (BOGO analytics tracking)';
RAISE NOTICE '';
RAISE NOTICE '🎪 Campaign Types Supported:';
RAISE NOTICE '   ✓ Time-based discount campaigns';
RAISE NOTICE '   ✓ Category-wide sales';
RAISE NOTICE '   ✓ Product-specific promotions';
RAISE NOTICE '   ✓ BOGO (Buy One Get One) offers';
RAISE NOTICE '   ✓ Coupon codes with validation';
RAISE NOTICE '   ✓ Flash sales with time limits';
RAISE NOTICE '';
RAISE NOTICE '📈 Analytics Features:';
RAISE NOTICE '   ✓ Campaign performance tracking';
RAISE NOTICE '   ✓ Usage analytics and reporting';
RAISE NOTICE '   ✓ Customer conversion metrics';
RAISE NOTICE '   ✓ Revenue and discount tracking';
RAISE NOTICE '';
RAISE NOTICE '🔧 Automation Features:';
RAISE NOTICE '   ✓ Auto campaign activation/expiration';
RAISE NOTICE '   ✓ Usage count tracking';
RAISE NOTICE '   ✓ Coupon validation system';
RAISE NOTICE '   ✓ Status management';
RAISE NOTICE '';
RAISE NOTICE '🚀 Ready for advanced sales campaigns and promotions!';
RAISE NOTICE '================================================================';