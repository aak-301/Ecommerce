-- =============================================
-- PRODUCT MANAGEMENT SYSTEM MIGRATION - Updated with Customer Features
-- File: src/migrations/products.sql
-- =============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- PRODUCT MANAGEMENT TABLES
-- =============================================

-- Create categories table for product organization
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    slug VARCHAR(255) UNIQUE NOT NULL,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    short_description VARCHAR(500),
    sku VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    
    -- Pricing
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    sale_price DECIMAL(10,2),
    cost_price DECIMAL(10,2),
    
    -- Inventory
    quantity INTEGER NOT NULL DEFAULT 0,
    min_quantity INTEGER DEFAULT 0,
    max_quantity INTEGER,
    track_quantity BOOLEAN DEFAULT TRUE,
    allow_backorder BOOLEAN DEFAULT FALSE,
    
    -- Product status
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive', 'out_of_stock')),
    is_featured BOOLEAN DEFAULT FALSE,
    is_digital BOOLEAN DEFAULT FALSE,
    
    -- SEO & Marketing
    meta_title VARCHAR(255),
    meta_description TEXT,
    tags TEXT[], -- Array of tags
    
    -- Media
    featured_image TEXT,
    gallery_images TEXT[], -- Array of image URLs
    
    -- Dimensions & Shipping
    weight DECIMAL(8,2),
    length DECIMAL(8,2),
    width DECIMAL(8,2),
    height DECIMAL(8,2),
    shipping_class VARCHAR(100),
    
    -- User association (CASCADE DELETE when user is deleted)
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Soft delete
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Create product variants table (for size, color, etc.)
CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) UNIQUE NOT NULL,
    price DECIMAL(10,2),
    sale_price DECIMAL(10,2),
    quantity INTEGER NOT NULL DEFAULT 0,
    attributes JSONB, -- Store variant attributes like {"size": "M", "color": "Red"}
    image TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create product attributes table (for filtering)
CREATE TABLE IF NOT EXISTS product_attributes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    attribute_name VARCHAR(100) NOT NULL,
    attribute_value VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create inventory history table for tracking stock changes
CREATE TABLE IF NOT EXISTS inventory_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    change_type VARCHAR(50) NOT NULL CHECK (change_type IN ('stock_in', 'stock_out', 'adjustment', 'sale', 'return', 'damaged')),
    quantity_change INTEGER NOT NULL,
    quantity_before INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL,
    reason TEXT,
    reference_id UUID, -- Order ID, adjustment ID, etc.
    performed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create bulk import history table
CREATE TABLE IF NOT EXISTS bulk_import_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename VARCHAR(255) NOT NULL,
    total_rows INTEGER NOT NULL DEFAULT 0,
    successful_rows INTEGER NOT NULL DEFAULT 0,
    failed_rows INTEGER NOT NULL DEFAULT 0,
    import_type VARCHAR(50) NOT NULL CHECK (import_type IN ('products', 'inventory', 'categories')),
    status VARCHAR(50) NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed', 'partial')),
    error_log JSONB, -- Store detailed error information
    imported_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create metadata table for storing additional info about deleted users
CREATE TABLE IF NOT EXISTS deleted_accounts_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_user_id UUID NOT NULL,
    metadata_type VARCHAR(100) NOT NULL,
    metadata_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- CUSTOMER SHOPPING TABLES
-- =============================================

-- Create customer addresses table
CREATE TABLE IF NOT EXISTS customer_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL DEFAULT 'shipping' CHECK (type IN ('shipping', 'billing')),
    is_default BOOLEAN DEFAULT FALSE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    company VARCHAR(255),
    address_line_1 VARCHAR(255) NOT NULL,
    address_line_2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    phone VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create shopping cart table
CREATE TABLE IF NOT EXISTS shopping_cart (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    price_at_time DECIMAL(10,2) NOT NULL, -- Store price when added to cart
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(customer_id, product_id, variant_id)
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    
    -- Order status
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
    
    -- Pricing
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    shipping_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    
    -- Payment info
    payment_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'partial_refund')),
    payment_method VARCHAR(50),
    payment_reference TEXT,
    
    -- Addresses (store as JSONB for flexibility)
    shipping_address JSONB NOT NULL,
    billing_address JSONB NOT NULL,
    
    -- Order notes
    customer_notes TEXT,
    admin_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    shipped_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
    cancellation_reason TEXT
);

-- Create order items table
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
    
    -- Product details at time of order
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(100) NOT NULL,
    variant_name VARCHAR(255),
    variant_sku VARCHAR(100),
    
    -- Pricing
    unit_price DECIMAL(10,2) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    total_price DECIMAL(10,2) NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create product reviews table
CREATE TABLE IF NOT EXISTS product_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(255),
    review_text TEXT,
    is_verified_purchase BOOLEAN DEFAULT FALSE,
    is_approved BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(product_id, customer_id, order_id)
);

-- Create wishlist table
CREATE TABLE IF NOT EXISTS wishlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(customer_id, product_id)
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Product indexes
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_created_by ON products(created_by);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_quantity ON products(quantity);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);

-- Category indexes
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_created_by ON categories(created_by);

-- Variant indexes
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_product_variants_active ON product_variants(is_active);

-- Attribute indexes
CREATE INDEX IF NOT EXISTS idx_product_attributes_product_id ON product_attributes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_attributes_name ON product_attributes(attribute_name);
CREATE INDEX IF NOT EXISTS idx_product_attributes_value ON product_attributes(attribute_value);

-- Inventory history indexes
CREATE INDEX IF NOT EXISTS idx_inventory_history_product_id ON inventory_history(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_history_variant_id ON inventory_history(variant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_history_performed_by ON inventory_history(performed_by);
CREATE INDEX IF NOT EXISTS idx_inventory_history_created_at ON inventory_history(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_history_change_type ON inventory_history(change_type);

-- Bulk import indexes
CREATE INDEX IF NOT EXISTS idx_bulk_import_history_imported_by ON bulk_import_history(imported_by);
CREATE INDEX IF NOT EXISTS idx_bulk_import_history_status ON bulk_import_history(status);
CREATE INDEX IF NOT EXISTS idx_bulk_import_history_created_at ON bulk_import_history(created_at);

-- Metadata indexes
CREATE INDEX IF NOT EXISTS idx_deleted_accounts_metadata_user_id ON deleted_accounts_metadata(original_user_id);
CREATE INDEX IF NOT EXISTS idx_deleted_accounts_metadata_type ON deleted_accounts_metadata(metadata_type);

-- Customer shopping indexes
CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer_id ON customer_addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_type ON customer_addresses(type);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_default ON customer_addresses(is_default);

CREATE INDEX IF NOT EXISTS idx_shopping_cart_customer_id ON shopping_cart(customer_id);
CREATE INDEX IF NOT EXISTS idx_shopping_cart_product_id ON shopping_cart(product_id);
CREATE INDEX IF NOT EXISTS idx_shopping_cart_created_at ON shopping_cart(created_at);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_customer_id ON product_reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_approved ON product_reviews(is_approved);

CREATE INDEX IF NOT EXISTS idx_wishlists_customer_id ON wishlists(customer_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_product_id ON wishlists(product_id);

-- Full text search indexes
CREATE INDEX IF NOT EXISTS idx_products_search ON products USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '') || ' ' || COALESCE(short_description, '')));
CREATE INDEX IF NOT EXISTS idx_categories_search ON categories USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- =============================================
-- CORE FUNCTIONS
-- =============================================

-- Trigger to automatically update updated_at for products
CREATE OR REPLACE FUNCTION update_product_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update product status based on inventory
CREATE OR REPLACE FUNCTION update_product_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-update status based on quantity
    IF NEW.track_quantity = TRUE THEN
        IF NEW.quantity = 0 AND NEW.allow_backorder = FALSE THEN
            NEW.status = 'out_of_stock';
        ELSIF NEW.quantity > 0 AND OLD.status = 'out_of_stock' THEN
            NEW.status = 'active';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to log inventory changes
CREATE OR REPLACE FUNCTION log_inventory_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Log when inventory is updated
    IF TG_OP = 'INSERT' THEN
        INSERT INTO inventory_history (
            product_id, change_type, quantity_change, 
            quantity_before, quantity_after, reason, performed_by
        ) VALUES (
            NEW.product_id, 'stock_in', NEW.quantity,
            0, NEW.quantity, 'Initial inventory', NEW.created_by
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- CREATE TRIGGERS
-- =============================================

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_product_updated_at();

CREATE TRIGGER update_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_variants_updated_at
    BEFORE UPDATE ON product_variants
    FOR EACH ROW
    EXECUTE FUNCTION update_product_updated_at();

CREATE TRIGGER update_shopping_cart_updated_at
    BEFORE UPDATE ON shopping_cart
    FOR EACH ROW
    EXECUTE FUNCTION update_product_updated_at();

CREATE TRIGGER update_customer_addresses_updated_at
    BEFORE UPDATE ON customer_addresses
    FOR EACH ROW
    EXECUTE FUNCTION update_product_updated_at();

CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_product_updated_at();

CREATE TRIGGER product_status_change
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_product_status();

CREATE TRIGGER inventory_change_notification
    AFTER INSERT ON inventory_history
    FOR EACH ROW
    EXECUTE FUNCTION log_inventory_change();

-- =============================================
-- CUSTOMER SHOPPING FUNCTIONS
-- =============================================

-- Function to generate unique order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS VARCHAR(50) AS $$
DECLARE
    new_order_number VARCHAR(50);
    counter INTEGER := 1;
BEGIN
    LOOP
        new_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');
        
        IF NOT EXISTS (SELECT 1 FROM orders WHERE order_number = new_order_number) THEN
            EXIT;
        END IF;
        
        counter := counter + 1;
    END LOOP;
    
    RETURN new_order_number;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate cart total
CREATE OR REPLACE FUNCTION calculate_cart_total(customer_id_param UUID)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    total DECIMAL(10,2) := 0;
BEGIN
    SELECT COALESCE(SUM(sc.quantity * sc.price_at_time), 0)
    INTO total
    FROM shopping_cart sc
    JOIN products p ON sc.product_id = p.id
    WHERE sc.customer_id = customer_id_param
    AND p.deleted_at IS NULL
    AND p.status = 'active';
    
    RETURN total;
END;
$$ LANGUAGE plpgsql;

-- Function to add item to cart (with duplicate handling)
CREATE OR REPLACE FUNCTION add_to_cart(
    customer_id_param UUID,
    product_id_param UUID,
    variant_id_param UUID DEFAULT NULL,
    quantity_param INTEGER DEFAULT 1,
    price_param DECIMAL(10,2)
)
RETURNS BOOLEAN AS $$
DECLARE
    existing_quantity INTEGER := 0;
BEGIN
    -- Check if item already exists in cart
    SELECT quantity INTO existing_quantity
    FROM shopping_cart
    WHERE customer_id = customer_id_param
    AND product_id = product_id_param
    AND (variant_id = variant_id_param OR (variant_id IS NULL AND variant_id_param IS NULL));
    
    IF existing_quantity > 0 THEN
        -- Update existing item
        UPDATE shopping_cart
        SET quantity = existing_quantity + quantity_param,
            updated_at = NOW()
        WHERE customer_id = customer_id_param
        AND product_id = product_id_param
        AND (variant_id = variant_id_param OR (variant_id IS NULL AND variant_id_param IS NULL));
    ELSE
        -- Insert new item
        INSERT INTO shopping_cart (customer_id, product_id, variant_id, quantity, price_at_time)
        VALUES (customer_id_param, product_id_param, variant_id_param, quantity_param, price_param);
    END IF;
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to get product by slug
CREATE OR REPLACE FUNCTION get_product_by_slug(slug_param VARCHAR(255))
RETURNS TABLE (
    id UUID,
    name VARCHAR(255),
    description TEXT,
    price DECIMAL(10,2),
    sale_price DECIMAL(10,2),
    quantity INTEGER,
    status VARCHAR(50),
    featured_image TEXT,
    gallery_images TEXT[],
    category_name VARCHAR(255),
    average_rating DECIMAL(3,2),
    review_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.description,
        p.price,
        p.sale_price,
        p.quantity,
        p.status,
        p.featured_image,
        p.gallery_images,
        c.name as category_name,
        COALESCE(AVG(pr.rating), 0)::DECIMAL(3,2) as average_rating,
        COUNT(pr.id)::INTEGER as review_count
    FROM products p
    WHERE p.deleted_at IS NULL
    AND p.track_quantity = TRUE
    AND p.quantity <= p.min_quantity
    AND (user_id_param IS NULL OR p.created_by = user_id_param)
    ORDER BY p.quantity ASC, p.name ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to get product statistics
CREATE OR REPLACE FUNCTION get_product_stats(user_id_param UUID DEFAULT NULL)
RETURNS TABLE (
    total_products INTEGER,
    active_products INTEGER,
    draft_products INTEGER,
    out_of_stock_products INTEGER,
    low_stock_products INTEGER,
    total_value DECIMAL(12,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_products,
        COUNT(CASE WHEN status = 'active' THEN 1 END)::INTEGER as active_products,
        COUNT(CASE WHEN status = 'draft' THEN 1 END)::INTEGER as draft_products,
        COUNT(CASE WHEN status = 'out_of_stock' OR quantity = 0 THEN 1 END)::INTEGER as out_of_stock_products,
        COUNT(CASE WHEN track_quantity = TRUE AND quantity <= min_quantity THEN 1 END)::INTEGER as low_stock_products,
        COALESCE(SUM(price * quantity), 0)::DECIMAL(12,2) as total_value
    FROM products 
    WHERE deleted_at IS NULL
    AND (user_id_param IS NULL OR created_by = user_id_param);
END;
$$ LANGUAGE plpgsql;

-- Function to generate unique SKU
CREATE OR REPLACE FUNCTION generate_unique_sku(prefix_param VARCHAR(10) DEFAULT 'PRD')
RETURNS VARCHAR(100) AS $$
DECLARE
    new_sku VARCHAR(100);
    counter INTEGER := 1;
BEGIN
    LOOP
        new_sku := prefix_param || '-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');
        
        IF NOT EXISTS (SELECT 1 FROM products WHERE sku = new_sku) 
           AND NOT EXISTS (SELECT 1 FROM product_variants WHERE sku = new_sku) THEN
            EXIT;
        END IF;
        
        counter := counter + 1;
    END LOOP;
    
    RETURN new_sku;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up deleted user's products
CREATE OR REPLACE FUNCTION cleanup_user_products(user_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Archive important product data before deletion
    INSERT INTO deleted_accounts_metadata (
        original_user_id,
        metadata_type,
        metadata_data,
        created_at
    )
    SELECT 
        user_id_param,
        'products_summary',
        jsonb_build_object(
            'total_products', COUNT(*),
            'total_value', COALESCE(SUM(price * quantity), 0),
            'deletion_timestamp', NOW()
        ),
        NOW()
    FROM products 
    WHERE created_by = user_id_param AND deleted_at IS NULL;
    
    -- Products will be automatically deleted due to CASCADE constraint
    -- But we can get the count first
    SELECT COUNT(*) INTO deleted_count 
    FROM products 
    WHERE created_by = user_id_param;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to bulk update product prices
CREATE OR REPLACE FUNCTION bulk_update_product_prices(
    product_ids UUID[],
    new_price DECIMAL(10,2)
)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER := 0;
BEGIN
    UPDATE products 
    SET 
        price = new_price,
        updated_at = NOW()
    WHERE id = ANY(product_ids)
    AND deleted_at IS NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- VIEWS FOR REPORTING
-- =============================================

-- View for customer order summary
CREATE OR REPLACE VIEW customer_order_summary AS
SELECT 
    o.id,
    o.order_number,
    o.customer_id,
    u.name as customer_name,
    u.email as customer_email,
    o.status,
    o.payment_status,
    o.total_amount,
    o.created_at,
    o.updated_at,
    COUNT(oi.id) as total_items,
    SUM(oi.quantity) as total_quantity
FROM orders o
LEFT JOIN users u ON o.customer_id = u.id
LEFT JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id, u.name, u.email;

-- View for product with reviews summary
CREATE OR REPLACE VIEW products_with_reviews AS
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
WHERE p.deleted_at IS NULL
GROUP BY p.id, c.name, c.slug;

-- View for active products with category info
CREATE OR REPLACE VIEW active_products_view AS
SELECT 
    p.id,
    p.name,
    p.description,
    p.sku,
    p.slug,
    p.price,
    p.sale_price,
    p.quantity,
    p.min_quantity,
    p.status,
    p.is_featured,
    p.featured_image,
    p.gallery_images,
    p.tags,
    p.created_at,
    p.updated_at,
    c.name as category_name,
    c.slug as category_slug,
    u.name as created_by_name,
    COALESCE(AVG(pr.rating), 0) as average_rating,
    COUNT(pr.id) as review_count,
    CASE 
        WHEN p.track_quantity = TRUE AND p.quantity <= p.min_quantity THEN TRUE 
        ELSE FALSE 
    END as is_low_stock
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN users u ON p.created_by = u.id
LEFT JOIN product_reviews pr ON p.id = pr.product_id AND pr.is_approved = TRUE
WHERE p.deleted_at IS NULL
GROUP BY p.id, c.name, c.slug, u.name;

-- View for inventory status
CREATE OR REPLACE VIEW inventory_status_view AS
SELECT 
    p.id as product_id,
    p.name as product_name,
    p.sku,
    p.quantity as current_stock,
    p.min_quantity,
    p.max_quantity,
    CASE 
        WHEN p.quantity = 0 THEN 'out_of_stock'
        WHEN p.track_quantity = TRUE AND p.quantity <= p.min_quantity THEN 'low_stock'
        WHEN p.max_quantity IS NOT NULL AND p.quantity >= p.max_quantity THEN 'overstock'
        ELSE 'in_stock'
    END as stock_status,
    p.created_by,
    u.name as owner_name
FROM products p
LEFT JOIN users u ON p.created_by = u.id
WHERE p.deleted_at IS NULL
AND p.track_quantity = TRUE;

-- View for low stock alerts
CREATE OR REPLACE VIEW low_stock_alert AS
SELECT 
    p.id,
    p.name,
    p.sku,
    p.quantity,
    p.min_quantity,
    p.status,
    c.name as category_name,
    u.name as created_by_name,
    u.email as owner_email
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN users u ON p.created_by = u.id
WHERE p.deleted_at IS NULL
AND p.track_quantity = TRUE
AND p.quantity <= p.min_quantity
ORDER BY p.quantity ASC;

-- View for product performance
CREATE OR REPLACE VIEW product_performance AS
SELECT 
    p.id,
    p.name,
    p.sku,
    p.price,
    p.quantity,
    COALESCE(sales.total_sold, 0) as total_sold,
    COALESCE(sales.total_revenue, 0) as total_revenue,
    COALESCE(AVG(pr.rating), 0) as average_rating,
    COUNT(pr.id) as review_count,
    p.created_at
FROM products p
LEFT JOIN (
    SELECT 
        oi.product_id,
        SUM(oi.quantity) as total_sold,
        SUM(oi.total_price) as total_revenue
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.status IN ('delivered', 'shipped')
    GROUP BY oi.product_id
) sales ON p.id = sales.product_id
LEFT JOIN product_reviews pr ON p.id = pr.product_id AND pr.is_approved = TRUE
WHERE p.deleted_at IS NULL
GROUP BY p.id, sales.total_sold, sales.total_revenue
ORDER BY sales.total_revenue DESC NULLS LAST;

-- View for customer shopping summary
CREATE OR REPLACE VIEW customer_shopping_summary AS
SELECT 
    u.id as customer_id,
    u.name,
    u.email,
    COUNT(DISTINCT o.id) as total_orders,
    COALESCE(SUM(o.total_amount), 0) as total_spent,
    COALESCE(AVG(o.total_amount), 0) as average_order_value,
    MAX(o.created_at) as last_order_date,
    COUNT(DISTINCT sc.product_id) as cart_items,
    COUNT(DISTINCT w.product_id) as wishlist_items
FROM users u
LEFT JOIN orders o ON u.id = o.customer_id AND o.status != 'cancelled'
LEFT JOIN shopping_cart sc ON u.id = sc.customer_id
LEFT JOIN wishlists w ON u.id = w.customer_id
WHERE u.role = 'customer' AND u.deleted_at IS NULL
GROUP BY u.id, u.name, u.email;

-- =============================================
-- SAMPLE DATA
-- =============================================

-- Insert sample categories (only if they don't exist)
INSERT INTO categories (name, description, slug, is_active, created_by)
SELECT 'Electronics', 'Electronic devices and gadgets', 'electronics', true, u.id
FROM users u 
WHERE u.role = 'super_admin' 
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'electronics')
LIMIT 1;

INSERT INTO categories (name, description, slug, is_active, created_by)
SELECT 'Clothing', 'Fashion and apparel', 'clothing', true, u.id
FROM users u 
WHERE u.role = 'super_admin' 
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'clothing')
LIMIT 1;

INSERT INTO categories (name, description, slug, is_active, created_by)
SELECT 'Books', 'Books and literature', 'books', true, u.id
FROM users u 
WHERE u.role = 'super_admin' 
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'books')
LIMIT 1;

INSERT INTO categories (name, description, slug, is_active, created_by)
SELECT 'Home & Garden', 'Home and garden products', 'home-garden', true, u.id
FROM users u 
WHERE u.role = 'super_admin' 
AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'home-garden')
LIMIT 1;

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- Display all created functions, triggers, and views
DO $
BEGIN
    RAISE NOTICE '=== CREATED FUNCTIONS ===';
    RAISE NOTICE 'Functions created in this migration:';
    RAISE NOTICE '1. update_product_updated_at()';
    RAISE NOTICE '2. update_product_status()';
    RAISE NOTICE '3. log_inventory_change()';
    RAISE NOTICE '4. generate_order_number()';
    RAISE NOTICE '5. calculate_cart_total(UUID)';
    RAISE NOTICE '6. add_to_cart(UUID, UUID, UUID, INTEGER, DECIMAL)';
    RAISE NOTICE '7. get_product_by_slug(VARCHAR)';
    RAISE NOTICE '8. search_products(TEXT, UUID, INTEGER, INTEGER)';
    RAISE NOTICE '9. get_category_products(UUID, INTEGER, INTEGER)';
    RAISE NOTICE '10. update_inventory_on_order(UUID)';
    RAISE NOTICE '11. cancel_order(UUID, UUID, TEXT)';
    RAISE NOTICE '12. get_customer_order_stats(UUID)';
    RAISE NOTICE '13. update_product_quantity(UUID, UUID, INTEGER, VARCHAR, TEXT, UUID, UUID)';
    RAISE NOTICE '14. soft_delete_product(UUID, UUID)';
    RAISE NOTICE '15. restore_product(UUID)';
    RAISE NOTICE '16. get_low_stock_products(UUID)';
    RAISE NOTICE '17. get_product_stats(UUID)';
    RAISE NOTICE '18. generate_unique_sku(VARCHAR)';
    RAISE NOTICE '19. cleanup_user_products(UUID)';
    RAISE NOTICE '20. bulk_update_product_prices(UUID[], DECIMAL)';
    RAISE NOTICE '';
    RAISE NOTICE '=== CREATED TRIGGERS ===';
    RAISE NOTICE 'Triggers created:';
    RAISE NOTICE '1. update_products_updated_at ON products';
    RAISE NOTICE '2. update_categories_updated_at ON categories';
    RAISE NOTICE '3. update_product_variants_updated_at ON product_variants';
    RAISE NOTICE '4. update_shopping_cart_updated_at ON shopping_cart';
    RAISE NOTICE '5. update_customer_addresses_updated_at ON customer_addresses';
    RAISE NOTICE '6. update_orders_updated_at ON orders';
    RAISE NOTICE '7. product_status_change ON products';
    RAISE NOTICE '8. inventory_change_notification ON inventory_history';
    RAISE NOTICE '';
    RAISE NOTICE '=== CREATED VIEWS ===';
    RAISE NOTICE 'Views created:';
    RAISE NOTICE '1. customer_order_summary';
    RAISE NOTICE '2. products_with_reviews';
    RAISE NOTICE '3. active_products_view';
    RAISE NOTICE '4. inventory_status_view';
    RAISE NOTICE '5. low_stock_alert';
    RAISE NOTICE '6. product_performance';
    RAISE NOTICE '7. customer_shopping_summary';
    RAISE NOTICE '';
    RAISE NOTICE '🛍️ Complete Product & Customer Management System Migration Completed Successfully!';
END $; p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN product_reviews pr ON p.id = pr.product_id AND pr.is_approved = TRUE
    WHERE p.slug = slug_param 
    AND p.deleted_at IS NULL 
    AND p.status = 'active'
    GROUP BY p.id, c.name;
END;
$ LANGUAGE plpgsql;

-- Function to search products
CREATE OR REPLACE FUNCTION search_products(
    search_term TEXT DEFAULT NULL,
    category_id_param UUID DEFAULT NULL,
    limit_param INTEGER DEFAULT 20,
    offset_param INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    name VARCHAR(255),
    slug VARCHAR(255),
    price DECIMAL(10,2),
    sale_price DECIMAL(10,2),
    featured_image TEXT,
    category_name VARCHAR(255),
    average_rating DECIMAL(3,2),
    review_count INTEGER
) AS $
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.slug,
        p.price,
        p.sale_price,
        p.featured_image,
        c.name as category_name,
        COALESCE(AVG(pr.rating), 0)::DECIMAL(3,2) as average_rating,
        COUNT(pr.id)::INTEGER as review_count
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN product_reviews pr ON p.id = pr.product_id AND pr.is_approved = TRUE
    WHERE p.deleted_at IS NULL 
    AND p.status = 'active'
    AND (search_term IS NULL OR p.name ILIKE '%' || search_term || '%' OR p.description ILIKE '%' || search_term || '%')
    AND (category_id_param IS NULL OR p.category_id = category_id_param)
    GROUP BY p.id, c.name
    ORDER BY p.created_at DESC
    LIMIT limit_param OFFSET offset_param;
END;
$ LANGUAGE plpgsql;

-- Function to get category products
CREATE OR REPLACE FUNCTION get_category_products(
    category_id_param UUID,
    limit_param INTEGER DEFAULT 20,
    offset_param INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    name VARCHAR(255),
    slug VARCHAR(255),
    price DECIMAL(10,2),
    sale_price DECIMAL(10,2),
    featured_image TEXT,
    average_rating DECIMAL(3,2),
    review_count INTEGER
) AS $
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.slug,
        p.price,
        p.sale_price,
        p.featured_image,
        COALESCE(AVG(pr.rating), 0)::DECIMAL(3,2) as average_rating,
        COUNT(pr.id)::INTEGER as review_count
    FROM products p
    LEFT JOIN product_reviews pr ON p.id = pr.product_id AND pr.is_approved = TRUE
    WHERE p.category_id = category_id_param
    AND p.deleted_at IS NULL 
    AND p.status = 'active'
    GROUP BY p.id
    ORDER BY p.created_at DESC
    LIMIT limit_param OFFSET offset_param;
END;
$ LANGUAGE plpgsql;

-- Function to update inventory on order placement
CREATE OR REPLACE FUNCTION update_inventory_on_order(order_id_param UUID)
RETURNS BOOLEAN AS $
DECLARE
    item_record RECORD;
    success BOOLEAN := TRUE;
BEGIN
    FOR item_record IN
        SELECT oi.product_id, oi.variant_id, oi.quantity
        FROM order_items oi
        WHERE oi.order_id = order_id_param
    LOOP
        -- Update inventory using existing function
        IF NOT update_product_quantity(
            item_record.product_id,
            item_record.variant_id,
            -item_record.quantity, -- Negative to reduce stock
            'sale',
            'Order placement',
            NULL, -- performed_by_param
            order_id_param
        ) THEN
            success := FALSE;
            EXIT;
        END IF;
    END LOOP;
    
    RETURN success;
END;
$ LANGUAGE plpgsql;

-- Function to cancel order and restore inventory
CREATE OR REPLACE FUNCTION cancel_order(
    order_id_param UUID,
    cancelled_by_param UUID,
    reason_param TEXT DEFAULT 'Customer cancellation'
)
RETURNS BOOLEAN AS $
DECLARE
    item_record RECORD;
    order_status VARCHAR(50);
BEGIN
    -- Check current order status
    SELECT status INTO order_status
    FROM orders
    WHERE id = order_id_param;
    
    IF order_status NOT IN ('pending', 'confirmed') THEN
        RETURN FALSE; -- Cannot cancel shipped/delivered orders
    END IF;
    
    -- Update order status
    UPDATE orders
    SET status = 'cancelled',
        cancelled_at = NOW(),
        cancelled_by = cancelled_by_param,
        cancellation_reason = reason_param,
        updated_at = NOW()
    WHERE id = order_id_param;
    
    -- Restore inventory
    FOR item_record IN
        SELECT oi.product_id, oi.variant_id, oi.quantity
        FROM order_items oi
        WHERE oi.order_id = order_id_param
    LOOP
        PERFORM update_product_quantity(
            item_record.product_id,
            item_record.variant_id,
            item_record.quantity, -- Positive to restore stock
            'return',
            'Order cancellation',
            cancelled_by_param,
            order_id_param
        );
    END LOOP;
    
    RETURN TRUE;
END;
$ LANGUAGE plpgsql;

-- Function to get customer order statistics
CREATE OR REPLACE FUNCTION get_customer_order_stats(customer_id_param UUID)
RETURNS TABLE (
    total_orders INTEGER,
    total_spent DECIMAL(12,2),
    pending_orders INTEGER,
    completed_orders INTEGER,
    cancelled_orders INTEGER,
    average_order_value DECIMAL(12,2)
) AS $
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_orders,
        COALESCE(SUM(total_amount), 0)::DECIMAL(12,2) as total_spent,
        COUNT(CASE WHEN status IN ('pending', 'confirmed', 'processing') THEN 1 END)::INTEGER as pending_orders,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END)::INTEGER as completed_orders,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END)::INTEGER as cancelled_orders,
        COALESCE(AVG(total_amount), 0)::DECIMAL(12,2) as average_order_value
    FROM orders 
    WHERE customer_id = customer_id_param;
END;
$ LANGUAGE plpgsql;

-- =============================================
-- PRODUCT MANAGEMENT FUNCTIONS
-- =============================================

-- Function to update product quantity and log inventory change
CREATE OR REPLACE FUNCTION update_product_quantity(
    product_id_param UUID,
    variant_id_param UUID DEFAULT NULL,
    quantity_change_param INTEGER,
    change_type_param VARCHAR(50),
    reason_param TEXT DEFAULT NULL,
    performed_by_param UUID,
    reference_id_param UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $
DECLARE
    current_quantity INTEGER;
    new_quantity INTEGER;
    update_successful BOOLEAN := FALSE;
BEGIN
    -- Update product or variant quantity
    IF variant_id_param IS NOT NULL THEN
        -- Update variant quantity
        SELECT quantity INTO current_quantity FROM product_variants WHERE id = variant_id_param;
        
        IF current_quantity IS NULL THEN
            RETURN FALSE;
        END IF;
        
        new_quantity := current_quantity + quantity_change_param;
        
        IF new_quantity >= 0 THEN
            UPDATE product_variants SET quantity = new_quantity WHERE id = variant_id_param;
            GET DIAGNOSTICS update_successful = ROW_COUNT;
        END IF;
    ELSE
        -- Update product quantity
        SELECT quantity INTO current_quantity FROM products WHERE id = product_id_param AND deleted_at IS NULL;
        
        IF current_quantity IS NULL THEN
            RETURN FALSE;
        END IF;
        
        new_quantity := current_quantity + quantity_change_param;
        
        IF new_quantity >= 0 THEN
            UPDATE products SET quantity = new_quantity WHERE id = product_id_param AND deleted_at IS NULL;
            GET DIAGNOSTICS update_successful = ROW_COUNT;
        END IF;
    END IF;
    
    -- Log the inventory change
    IF update_successful THEN
        INSERT INTO inventory_history (
            product_id, variant_id, change_type, quantity_change,
            quantity_before, quantity_after, reason, reference_id, performed_by
        ) VALUES (
            product_id_param, variant_id_param, change_type_param, quantity_change_param,
            current_quantity, new_quantity, reason_param, reference_id_param, performed_by_param
        );
    END IF;
    
    RETURN update_successful;
END;
$ LANGUAGE plpgsql;

-- Function to soft delete product
CREATE OR REPLACE FUNCTION soft_delete_product(
    product_id_param UUID,
    deleted_by_param UUID
)
RETURNS BOOLEAN AS $
DECLARE
    deletion_successful BOOLEAN := FALSE;
BEGIN
    UPDATE products 
    SET 
        deleted_at = NOW(),
        deleted_by = deleted_by_param,
        updated_at = NOW()
    WHERE id = product_id_param AND deleted_at IS NULL;
    
    GET DIAGNOSTICS deletion_successful = ROW_COUNT;
    RETURN deletion_successful;
END;
$ LANGUAGE plpgsql;

-- Function to restore soft deleted product
CREATE OR REPLACE FUNCTION restore_product(product_id_param UUID)
RETURNS BOOLEAN AS $
DECLARE
    restoration_successful BOOLEAN := FALSE;
BEGIN
    UPDATE products 
    SET 
        deleted_at = NULL,
        deleted_by = NULL,
        updated_at = NOW()
    WHERE id = product_id_param AND deleted_at IS NOT NULL;
    
    GET DIAGNOSTICS restoration_successful = ROW_COUNT;
    RETURN restoration_successful;
END;
$ LANGUAGE plpgsql;

-- Function to get low stock products
CREATE OR REPLACE FUNCTION get_low_stock_products(user_id_param UUID DEFAULT NULL)
RETURNS TABLE (
    product_id UUID,
    product_name VARCHAR(255),
    sku VARCHAR(100),
    current_quantity INTEGER,
    min_quantity INTEGER,
    status VARCHAR(50)
) AS $
BEGIN
    RETURN QUERY
    SELECT 
        p.id as product_id,
        p.name as product_name,
        p.sku,
        p.quantity as current_quantity,
        p.min_quantity,
        p.status
    FROM products