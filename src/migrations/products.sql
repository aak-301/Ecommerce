-- Products Management System Schema
-- This extends the existing authentication system with product management capabilities

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- PRODUCT TABLES
-- =============================================

-- Categories table for organizing products
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    slug VARCHAR(255) NOT NULL UNIQUE,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID REFERENCES users(id)
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    short_description VARCHAR(500),
    slug VARCHAR(255) NOT NULL UNIQUE,
    sku VARCHAR(100) NOT NULL UNIQUE,
    category_id UUID NOT NULL REFERENCES categories(id),
    
    -- Pricing
    price DECIMAL(12, 2) NOT NULL CHECK (price >= 0),
    sale_price DECIMAL(12, 2) CHECK (sale_price >= 0 AND sale_price < price),
    cost_price DECIMAL(12, 2) CHECK (cost_price >= 0),
    
    -- Inventory
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    low_stock_threshold INTEGER DEFAULT 10,
    track_quantity BOOLEAN DEFAULT TRUE,
    allow_backorders BOOLEAN DEFAULT FALSE,
    
    -- Physical attributes
    weight DECIMAL(8, 3),
    dimensions_length DECIMAL(8, 2),
    dimensions_width DECIMAL(8, 2),
    dimensions_height DECIMAL(8, 2),
    
    -- Status and visibility
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    visibility VARCHAR(50) NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'hidden')),
    featured BOOLEAN DEFAULT FALSE,
    
    -- SEO
    meta_title VARCHAR(255),
    meta_description TEXT,
    meta_keywords TEXT,
    
    -- Additional data
    tags TEXT[], -- Array of tags
    attributes JSONB DEFAULT '{}', -- Custom attributes
    
    -- Audit fields
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID REFERENCES users(id)
);

-- Product images table
CREATE TABLE IF NOT EXISTS product_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url VARCHAR(500) NOT NULL,
    alt_text VARCHAR(255),
    is_primary BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Product variants table (for products with variations like size, color)
CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL, -- e.g., "Red - Large"
    price DECIMAL(12, 2) CHECK (price >= 0),
    sale_price DECIMAL(12, 2) CHECK (sale_price >= 0 AND sale_price < price),
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    attributes JSONB DEFAULT '{}', -- e.g., {"color": "red", "size": "large"}
    image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- SHOPPING CART TABLES
-- =============================================

-- Shopping carts table
CREATE TABLE IF NOT EXISTS shopping_carts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255), -- For guest carts (future use)
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'abandoned', 'converted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days')
);

-- Cart items table
CREATE TABLE IF NOT EXISTS cart_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cart_id UUID NOT NULL REFERENCES shopping_carts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price DECIMAL(12, 2) NOT NULL CHECK (price >= 0), -- Price at time of adding to cart
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique product/variant per cart
    UNIQUE(cart_id, product_id, variant_id)
);

-- =============================================
-- ORDER TABLES
-- =============================================

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Order totals
    subtotal DECIMAL(12, 2) NOT NULL CHECK (subtotal >= 0),
    tax_amount DECIMAL(12, 2) DEFAULT 0 CHECK (tax_amount >= 0),
    shipping_amount DECIMAL(12, 2) DEFAULT 0 CHECK (shipping_amount >= 0),
    discount_amount DECIMAL(12, 2) DEFAULT 0 CHECK (discount_amount >= 0),
    total_amount DECIMAL(12, 2) NOT NULL CHECK (total_amount >= 0),
    
    -- Order status
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'confirmed', 'processing', 'shipped', 'delivered', 
        'cancelled', 'refunded', 'partially_refunded'
    )),
    payment_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (payment_status IN (
        'pending', 'paid', 'failed', 'refunded', 'partially_refunded'
    )),
    
    -- Shipping information
    shipping_address JSONB,
    billing_address JSONB,
    shipping_method VARCHAR(100),
    tracking_number VARCHAR(100),
    
    -- Additional information
    notes TEXT,
    internal_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    shipped_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    product_name VARCHAR(255) NOT NULL, -- Snapshot of product name
    product_sku VARCHAR(100) NOT NULL, -- Snapshot of SKU
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(12, 2) NOT NULL CHECK (unit_price >= 0),
    total_price DECIMAL(12, 2) NOT NULL CHECK (total_price >= 0),
    product_snapshot JSONB, -- Complete product data at time of order
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- INVENTORY TRACKING TABLES
-- =============================================

-- Stock movements table for inventory tracking
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN (
        'stock_in', 'stock_out', 'adjustment', 'sale', 'return', 'damaged', 'transfer'
    )),
    quantity_change INTEGER NOT NULL, -- Positive for increase, negative for decrease
    quantity_after INTEGER NOT NULL CHECK (quantity_after >= 0),
    reference_type VARCHAR(50), -- 'order', 'manual', 'import', etc.
    reference_id UUID, -- ID of related order, import, etc.
    reason TEXT,
    performed_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Product import/export history
CREATE TABLE IF NOT EXISTS product_imports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500),
    total_rows INTEGER NOT NULL,
    successful_rows INTEGER NOT NULL DEFAULT 0,
    failed_rows INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'processing' CHECK (status IN (
        'processing', 'completed', 'failed', 'partially_completed'
    )),
    error_log JSONB, -- Array of errors
    import_summary JSONB, -- Summary of what was imported
    performed_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Categories indexes
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_visibility ON products(visibility);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured) WHERE featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_low_stock ON products(id) WHERE quantity <= low_stock_threshold AND track_quantity = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_tags ON products USING GIN(tags);

-- Product images indexes
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_primary ON product_images(product_id, is_primary);

-- Product variants indexes
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_product_variants_active ON product_variants(id) WHERE is_active = TRUE;

-- Shopping cart indexes
CREATE INDEX IF NOT EXISTS idx_shopping_carts_user_id ON shopping_carts(user_id);
CREATE INDEX IF NOT EXISTS idx_shopping_carts_status ON shopping_carts(status);
CREATE INDEX IF NOT EXISTS idx_shopping_carts_expires_at ON shopping_carts(expires_at);

-- Cart items indexes
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);

-- Orders indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- Order items indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- Stock movements indexes
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_variant_id ON stock_movements(variant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);

-- Product imports indexes
CREATE INDEX IF NOT EXISTS idx_product_imports_performed_by ON product_imports(performed_by);
CREATE INDEX IF NOT EXISTS idx_product_imports_status ON product_imports(status);
CREATE INDEX IF NOT EXISTS idx_product_imports_created_at ON product_imports(created_at);

-- =============================================
-- TRIGGERS AND FUNCTIONS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_product_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_product_updated_at();

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_product_updated_at();

CREATE TRIGGER update_product_variants_updated_at
    BEFORE UPDATE ON product_variants
    FOR EACH ROW
    EXECUTE FUNCTION update_product_updated_at();

CREATE TRIGGER update_shopping_carts_updated_at
    BEFORE UPDATE ON shopping_carts
    FOR EACH ROW
    EXECUTE FUNCTION update_product_updated_at();

CREATE TRIGGER update_cart_items_updated_at
    BEFORE UPDATE ON cart_items
    FOR EACH ROW
    EXECUTE FUNCTION update_product_updated_at();

CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_product_updated_at();

-- Function to automatically track stock movements
CREATE OR REPLACE FUNCTION track_product_stock_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Track quantity changes for products
    IF OLD.quantity IS DISTINCT FROM NEW.quantity THEN
        INSERT INTO stock_movements (
            product_id, 
            movement_type, 
            quantity_change, 
            quantity_after, 
            reason, 
            performed_by
        ) VALUES (
            NEW.id,
            CASE 
                WHEN NEW.quantity > OLD.quantity THEN 'stock_in'
                ELSE 'stock_out'
            END,
            NEW.quantity - OLD.quantity,
            NEW.quantity,
            'Product quantity updated',
            NEW.updated_by
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for product stock tracking
CREATE TRIGGER track_product_stock_trigger
    AFTER UPDATE ON products
    FOR EACH ROW
    WHEN (OLD.quantity IS DISTINCT FROM NEW.quantity)
    EXECUTE FUNCTION track_product_stock_changes();

-- Function to track variant stock changes
CREATE OR REPLACE FUNCTION track_variant_stock_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Track quantity changes for variants
    IF OLD.quantity IS DISTINCT FROM NEW.quantity THEN
        INSERT INTO stock_movements (
            product_id, 
            variant_id,
            movement_type, 
            quantity_change, 
            quantity_after, 
            reason, 
            performed_by
        ) VALUES (
            NEW.product_id,
            NEW.id,
            CASE 
                WHEN NEW.quantity > OLD.quantity THEN 'stock_in'
                ELSE 'stock_out'
            END,
            NEW.quantity - OLD.quantity,
            NEW.quantity,
            'Variant quantity updated',
            (SELECT updated_by FROM products WHERE id = NEW.product_id)
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for variant stock tracking
CREATE TRIGGER track_variant_stock_trigger
    AFTER UPDATE ON product_variants
    FOR EACH ROW
    WHEN (OLD.quantity IS DISTINCT FROM NEW.quantity)
    EXECUTE FUNCTION track_variant_stock_changes();

-- Function to generate order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        NEW.order_number := 'ORD-' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMMDD') || '-' || 
                            LPAD(nextval('order_sequence')::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create sequence for order numbers
CREATE SEQUENCE IF NOT EXISTS order_sequence START 1;

-- Trigger for order number generation
CREATE TRIGGER generate_order_number_trigger
    BEFORE INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION generate_order_number();

-- Function to ensure only one primary image per product
CREATE OR REPLACE FUNCTION ensure_single_primary_image()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_primary = TRUE THEN
        -- Unset other primary images for this product
        UPDATE product_images 
        SET is_primary = FALSE 
        WHERE product_id = NEW.product_id AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for primary image constraint
CREATE TRIGGER ensure_single_primary_image_trigger
    BEFORE INSERT OR UPDATE ON product_images
    FOR EACH ROW
    WHEN (NEW.is_primary = TRUE)
    EXECUTE FUNCTION ensure_single_primary_image();

-- =============================================
-- UTILITY FUNCTIONS
-- =============================================

-- Function to get product with variant prices
CREATE OR REPLACE FUNCTION get_product_price_range(product_id_param UUID)
RETURNS TABLE (
    min_price DECIMAL(12, 2),
    max_price DECIMAL(12, 2),
    min_sale_price DECIMAL(12, 2),
    max_sale_price DECIMAL(12, 2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        LEAST(p.price, COALESCE(MIN(pv.price), p.price)) as min_price,
        GREATEST(p.price, COALESCE(MAX(pv.price), p.price)) as max_price,
        LEAST(p.sale_price, COALESCE(MIN(pv.sale_price), p.sale_price)) as min_sale_price,
        GREATEST(p.sale_price, COALESCE(MAX(pv.sale_price), p.sale_price)) as max_sale_price
    FROM products p
    LEFT JOIN product_variants pv ON p.id = pv.product_id AND pv.is_active = TRUE
    WHERE p.id = product_id_param
    GROUP BY p.id, p.price, p.sale_price;
END;
$$ LANGUAGE plpgsql;

-- Function to get low stock products
CREATE OR REPLACE FUNCTION get_low_stock_products()
RETURNS TABLE (
    product_id UUID,
    product_name VARCHAR(255),
    sku VARCHAR(100),
    current_quantity INTEGER,
    threshold INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as product_id,
        p.name as product_name,
        p.sku,
        p.quantity as current_quantity,
        p.low_stock_threshold as threshold
    FROM products p
    WHERE p.track_quantity = TRUE 
    AND p.quantity <= p.low_stock_threshold 
    AND p.deleted_at IS NULL
    AND p.status = 'published'
    ORDER BY p.quantity ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to get cart total
CREATE OR REPLACE FUNCTION get_cart_total(cart_id_param UUID)
RETURNS DECIMAL(12, 2) AS $$
DECLARE
    total DECIMAL(12, 2);
BEGIN
    SELECT COALESCE(SUM(ci.quantity * ci.price), 0)
    INTO total
    FROM cart_items ci
    WHERE ci.cart_id = cart_id_param;
    
    RETURN total;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired carts
CREATE OR REPLACE FUNCTION cleanup_expired_carts()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM shopping_carts 
    WHERE expires_at < CURRENT_TIMESTAMP 
    AND status = 'active';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- VIEWS FOR REPORTING
-- =============================================

-- Active products view
CREATE OR REPLACE VIEW active_products AS
SELECT 
    p.*,
    c.name as category_name,
    c.slug as category_slug,
    (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = TRUE LIMIT 1) as primary_image,
    (SELECT COUNT(*) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = TRUE) as variant_count
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.deleted_at IS NULL 
AND p.status = 'published'
AND c.deleted_at IS NULL 
AND c.is_active = TRUE;

-- Product inventory view
CREATE OR REPLACE VIEW product_inventory AS
SELECT 
    p.id,
    p.name,
    p.sku,
    p.quantity,
    p.low_stock_threshold,
    CASE 
        WHEN p.quantity = 0 THEN 'out_of_stock'
        WHEN p.quantity <= p.low_stock_threshold THEN 'low_stock'
        ELSE 'in_stock'
    END as stock_status,
    c.name as category_name
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.deleted_at IS NULL 
AND p.track_quantity = TRUE;

-- Order summary view
CREATE OR REPLACE VIEW order_summary AS
SELECT 
    o.*,
    u.name as customer_name,
    u.email as customer_email,
    (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
FROM orders o
LEFT JOIN users u ON o.user_id = u.id;

-- =============================================
-- SAMPLE DATA
-- =============================================

-- Insert sample categories
INSERT INTO categories (name, description, slug, created_by) 
SELECT 
    'Electronics',
    'Electronic devices and accessories',
    'electronics',
    u.id
FROM users u 
WHERE u.role = 'super_admin' 
LIMIT 1
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, description, slug, created_by) 
SELECT 
    'Clothing',
    'Apparel and fashion items',
    'clothing',
    u.id
FROM users u 
WHERE u.role = 'super_admin' 
LIMIT 1
ON CONFLICT (slug) DO NOTHING;

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
        'categories', 'products', 'product_images', 'product_variants',
        'shopping_carts', 'cart_items', 'orders', 'order_items',
        'stock_movements', 'product_imports'
    );
    
    IF table_count = 10 THEN
        RAISE NOTICE 'SUCCESS: All product tables created (%)!', table_count;
    ELSE
        RAISE WARNING 'WARNING: Missing product tables! Expected 10, found %', table_count;
    END IF;
END $$;

-- Final message
RAISE NOTICE '';
RAISE NOTICE '🛍️ Product Management System Initialized Successfully!';
RAISE NOTICE '================================================================';
RAISE NOTICE '';
RAISE NOTICE '📊 Created Tables (10):';
RAISE NOTICE '   ✓ categories (product organization)';
RAISE NOTICE '   ✓ products (main product catalog)';
RAISE NOTICE '   ✓ product_images (product images)';
RAISE NOTICE '   ✓ product_variants (size, color variants)';
RAISE NOTICE '   ✓ shopping_carts (user shopping carts)';
RAISE NOTICE '   ✓ cart_items (items in carts)';
RAISE NOTICE '   ✓ orders (order management)';
RAISE NOTICE '   ✓ order_items (items in orders)';
RAISE NOTICE '   ✓ stock_movements (inventory tracking)';
RAISE NOTICE '   ✓ product_imports (bulk import history)';
RAISE NOTICE '';
RAISE NOTICE '🔧 Created Functions & Triggers:';
RAISE NOTICE '   ✓ Automatic stock movement tracking';
RAISE NOTICE '   ✓ Order number generation';
RAISE NOTICE '   ✓ Price range calculations';
RAISE NOTICE '   ✓ Low stock monitoring';
RAISE NOTICE '   ✓ Cart total calculations';
RAISE NOTICE '';
RAISE NOTICE '📈 Created Views (3):';
RAISE NOTICE '   ✓ active_products';
RAISE NOTICE '   ✓ product_inventory';
RAISE NOTICE '   ✓ order_summary';
RAISE NOTICE '';
RAISE NOTICE '🎯 Features Available:';
RAISE NOTICE '   ✓ Complete product catalog management';
RAISE NOTICE '   ✓ Category organization with hierarchy';
RAISE NOTICE '   ✓ Product variants (size, color, etc.)';
RAISE NOTICE '   ✓ Shopping cart functionality';
RAISE NOTICE '   ✓ Order management system';
RAISE NOTICE '   ✓ Inventory tracking with stock movements';
RAISE NOTICE '   ✓ Bulk import/export capabilities';
RAISE NOTICE '   ✓ Low stock alerts';
RAISE NOTICE '   ✓ Product image management';
RAISE NOTICE '';
RAISE NOTICE '🚀 Ready for product management operations!';
RAISE NOTICE '================================================================';