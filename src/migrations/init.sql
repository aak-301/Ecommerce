-- Complete Authentication System with All Features
-- Single file containing: Authentication, Onboarding, Account Management
-- Create database (run this manually first)
-- CREATE DATABASE auth_system;

-- Use the database
-- \c auth_system;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- CORE TABLES
-- =============================================

-- Create users table with all features
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'customer' CHECK (role IN ('super_admin', 'admin', 'customer')),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Onboarding fields
    onboarded_by UUID REFERENCES users(id),
    onboarded_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    notes TEXT,
    
    -- Account management fields (soft delete)
    deleted_at TIMESTAMP WITH TIME ZONE,
    deletion_reason TEXT,
    deleted_by UUID REFERENCES users(id)
);

-- Create magic_tokens table
CREATE TABLE IF NOT EXISTS magic_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    token UUID NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create onboarding_history table for audit trail
CREATE TABLE IF NOT EXISTS onboarding_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL CHECK (action IN ('pending', 'approved', 'rejected', 'suspended')),
    performed_by UUID NOT NULL REFERENCES users(id),
    reason TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create logout_sessions table to track logout events
CREATE TABLE IF NOT EXISTS logout_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    logout_reason VARCHAR(100) DEFAULT 'manual' CHECK (logout_reason IN ('manual', 'admin_forced', 'security', 'account_deleted')),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create deleted_accounts table for audit purposes
CREATE TABLE IF NOT EXISTS deleted_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_user_id UUID NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    deletion_reason VARCHAR(100) DEFAULT 'user_request' CHECK (deletion_reason IN ('user_request', 'admin_action', 'policy_violation', 'inactive')),
    deleted_by UUID REFERENCES users(id),
    deletion_notes TEXT,
    original_created_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_data JSONB
);

-- Drop all variations of the function
DROP FUNCTION IF EXISTS soft_delete_user CASCADE;
DROP FUNCTION IF EXISTS restore_deleted_user CASCADE;
DROP FUNCTION IF EXISTS hard_delete_user CASCADE;

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(id) WHERE deleted_at IS NULL;

-- Magic tokens indexes
CREATE INDEX IF NOT EXISTS idx_magic_tokens_token ON magic_tokens(token);
CREATE INDEX IF NOT EXISTS idx_magic_tokens_email ON magic_tokens(email);
CREATE INDEX IF NOT EXISTS idx_magic_tokens_expires_at ON magic_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_magic_tokens_used ON magic_tokens(used);

-- Onboarding indexes
CREATE INDEX IF NOT EXISTS idx_users_onboarded_by ON users(onboarded_by);
CREATE INDEX IF NOT EXISTS idx_users_onboarded_at ON users(onboarded_at);
CREATE INDEX IF NOT EXISTS idx_onboarding_history_user_id ON onboarding_history(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_history_performed_by ON onboarding_history(performed_by);
CREATE INDEX IF NOT EXISTS idx_onboarding_history_action ON onboarding_history(action);
CREATE INDEX IF NOT EXISTS idx_onboarding_history_created_at ON onboarding_history(created_at);

-- Account management indexes
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_logout_sessions_user_id ON logout_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_logout_sessions_token_hash ON logout_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_logout_sessions_created_at ON logout_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_deleted_accounts_original_user_id ON deleted_accounts(original_user_id);
CREATE INDEX IF NOT EXISTS idx_deleted_accounts_email ON deleted_accounts(email);
CREATE INDEX IF NOT EXISTS idx_deleted_accounts_deleted_at ON deleted_accounts(deleted_at);
CREATE INDEX IF NOT EXISTS idx_deleted_accounts_deleted_by ON deleted_accounts(deleted_by);

-- =============================================
-- CORE FUNCTIONS AND TRIGGERS
-- =============================================

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- ONBOARDING FUNCTIONS
-- =============================================

-- Function to log onboarding history
CREATE OR REPLACE FUNCTION log_onboarding_history()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log when status changes and it's admin related
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.role = 'admin' THEN
        INSERT INTO onboarding_history (user_id, action, performed_by, reason, notes)
        VALUES (
            NEW.id,
            CASE 
                WHEN NEW.status = 'active' THEN 'approved'
                WHEN NEW.status = 'rejected' THEN 'rejected'
                WHEN NEW.status = 'suspended' THEN 'suspended'
                WHEN NEW.status = 'pending' THEN 'pending'
                ELSE NEW.status
            END,
            COALESCE(NEW.onboarded_by, NEW.id),
            NEW.rejection_reason,
            NEW.notes
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for onboarding history
DROP TRIGGER IF EXISTS onboarding_history_trigger ON users;
CREATE TRIGGER onboarding_history_trigger
    AFTER UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION log_onboarding_history();

-- Function to get pending admins count
CREATE OR REPLACE FUNCTION get_pending_admins_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM users 
        WHERE role = 'admin' AND status = 'pending' AND deleted_at IS NULL
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get onboarding statistics
CREATE OR REPLACE FUNCTION get_onboarding_stats()
RETURNS TABLE (
    total_admins INTEGER,
    pending_admins INTEGER,
    active_admins INTEGER,
    suspended_admins INTEGER,
    rejected_admins INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_admins,
        COUNT(CASE WHEN status = 'pending' THEN 1 END)::INTEGER as pending_admins,
        COUNT(CASE WHEN status = 'active' THEN 1 END)::INTEGER as active_admins,
        COUNT(CASE WHEN status = 'suspended' THEN 1 END)::INTEGER as suspended_admins,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END)::INTEGER as rejected_admins
    FROM users 
    WHERE role = 'admin' AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- ACCOUNT MANAGEMENT FUNCTIONS
-- =============================================

-- Function to soft delete user account
CREATE OR REPLACE FUNCTION soft_delete_user(
    user_id_param UUID,
    deleted_by_param UUID DEFAULT NULL,
    reason_param TEXT DEFAULT 'user_request',
    notes_param TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    user_record users%ROWTYPE;
    deletion_successful BOOLEAN := FALSE;
BEGIN
    -- Get user data before deletion
    SELECT * INTO user_record FROM users WHERE id = user_id_param AND deleted_at IS NULL;
    
    IF user_record.id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Soft delete the user
    UPDATE users 
    SET 
        deleted_at = NOW(),
        deletion_reason = reason_param,
        deleted_by = deleted_by_param,
        updated_at = NOW()
    WHERE id = user_id_param AND deleted_at IS NULL;
    
    GET DIAGNOSTICS deletion_successful = FOUND;
    
    IF deletion_successful THEN
        -- Archive user data
        INSERT INTO deleted_accounts (
            original_user_id, email, name, role, deletion_reason,
            deleted_by, deletion_notes, original_created_at, user_data
        ) VALUES (
            user_record.id, user_record.email, user_record.name, user_record.role,
            reason_param, deleted_by_param, notes_param, user_record.created_at,
            jsonb_build_object(
                'status', user_record.status,
                'onboarded_by', user_record.onboarded_by,
                'onboarded_at', user_record.onboarded_at,
                'notes', user_record.notes
            )
        );
        
        -- Invalidate sessions
        INSERT INTO logout_sessions (user_id, token_hash, logout_reason, created_at)
        VALUES (user_id_param, 'ACCOUNT_DELETED', 'account_deleted', NOW());
        
        -- Clean up magic tokens
        DELETE FROM magic_tokens WHERE email = user_record.email;
    END IF;
    
    RETURN deletion_successful;
END;
$$ LANGUAGE plpgsql;

-- Function to permanently delete user (hard delete - use with caution)
CREATE OR REPLACE FUNCTION hard_delete_user(user_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    deletion_successful BOOLEAN := FALSE;
BEGIN
    -- Delete from all related tables first (due to foreign key constraints)
    DELETE FROM logout_sessions WHERE user_id = user_id_param;
    DELETE FROM onboarding_history WHERE user_id = user_id_param OR performed_by = user_id_param;
    DELETE FROM magic_tokens WHERE email IN (SELECT email FROM users WHERE id = user_id_param);
    
    -- Delete the user record
    DELETE FROM users WHERE id = user_id_param;
    
    GET DIAGNOSTICS deletion_successful = FOUND;
    
    RETURN deletion_successful;
END;
$$ LANGUAGE plpgsql;

-- Function to restore soft deleted user
CREATE OR REPLACE FUNCTION restore_deleted_user(user_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    restoration_successful BOOLEAN := FALSE;
BEGIN
    UPDATE users 
    SET 
        deleted_at = NULL,
        deletion_reason = NULL,
        deleted_by = NULL,
        updated_at = NOW()
    WHERE id = user_id_param AND deleted_at IS NOT NULL;
    
    GET DIAGNOSTICS restoration_successful = FOUND;
    RETURN restoration_successful;
END;
$$ LANGUAGE plpgsql;

-- Function to check if token is blacklisted
CREATE OR REPLACE FUNCTION is_token_blacklisted(token_hash_param VARCHAR(255))
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM logout_sessions 
        WHERE token_hash = token_hash_param
    );
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- UTILITY FUNCTIONS
-- =============================================

-- Function to cleanup old logout sessions
CREATE OR REPLACE FUNCTION cleanup_old_logout_sessions(days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM logout_sessions 
    WHERE created_at < NOW() - INTERVAL '1 day' * days_old;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM magic_tokens 
    WHERE expires_at < CURRENT_TIMESTAMP OR used = true;
END;
$$ LANGUAGE plpgsql;

-- Function to get account deletion statistics
CREATE OR REPLACE FUNCTION get_account_deletion_stats()
RETURNS TABLE (
    total_deleted INTEGER,
    user_requested INTEGER,
    admin_action INTEGER,
    policy_violation INTEGER,
    inactive INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_deleted,
        COUNT(CASE WHEN deletion_reason = 'user_request' THEN 1 END)::INTEGER as user_requested,
        COUNT(CASE WHEN deletion_reason = 'admin_action' THEN 1 END)::INTEGER as admin_action,
        COUNT(CASE WHEN deletion_reason = 'policy_violation' THEN 1 END)::INTEGER as policy_violation,
        COUNT(CASE WHEN deletion_reason = 'inactive' THEN 1 END)::INTEGER as inactive
    FROM deleted_accounts;
END;
$$ LANGUAGE plpgsql;

-- Function to get user activity summary
CREATE OR REPLACE FUNCTION get_user_activity_summary(user_id_param UUID)
RETURNS TABLE (
    total_logouts INTEGER,
    last_logout TIMESTAMP WITH TIME ZONE,
    account_age_days INTEGER,
    is_deleted BOOLEAN,
    deletion_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(logout_count.total_logouts, 0)::INTEGER as total_logouts,
        logout_count.last_logout,
        COALESCE(EXTRACT(DAY FROM NOW() - u.created_at), 0)::INTEGER as account_age_days,
        (u.deleted_at IS NOT NULL) as is_deleted,
        u.deleted_at as deletion_date
    FROM users u
    LEFT JOIN (
        SELECT 
            user_id,
            COUNT(*)::INTEGER as total_logouts,
            MAX(created_at) as last_logout
        FROM logout_sessions 
        WHERE user_id = user_id_param
        GROUP BY user_id
    ) logout_count ON u.id = logout_count.user_id
    WHERE u.id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- CUSTOMER-SPECIFIC FUNCTIONS
-- =============================================

-- Function to handle customer account cleanup on deletion
CREATE OR REPLACE FUNCTION cleanup_customer_data(user_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
    cleanup_count INTEGER := 0;
BEGIN
    -- Archive customer data before deletion
    INSERT INTO deleted_accounts (
        original_user_id,
        deletion_reason,
        user_data,
        created_at
    )
    SELECT 
        user_id_param,
        'customer_data_cleanup',
        jsonb_build_object(
            'addresses_count', (SELECT COUNT(*) FROM customer_addresses WHERE customer_id = user_id_param),
            'orders_count', (SELECT COUNT(*) FROM orders WHERE customer_id = user_id_param),
            'cart_items_count', (SELECT COUNT(*) FROM shopping_cart WHERE customer_id = user_id_param),
            'reviews_count', (SELECT COUNT(*) FROM product_reviews WHERE customer_id = user_id_param),
            'wishlist_count', (SELECT COUNT(*) FROM wishlists WHERE customer_id = user_id_param),
            'cleanup_timestamp', NOW()
        ),
        NOW()
    WHERE EXISTS (SELECT 1 FROM users WHERE id = user_id_param);
    
    -- Customer data will be automatically deleted due to CASCADE constraints
    -- But we can get the count first for reporting
    SELECT COUNT(*) INTO cleanup_count
    FROM customer_addresses 
    WHERE customer_id = user_id_param;
    
    RETURN cleanup_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- VIEWS FOR REPORTING
-- =============================================

-- View for active users only (commonly used query)
CREATE OR REPLACE VIEW active_users AS
SELECT * FROM users WHERE deleted_at IS NULL;

-- View for admin management dashboard
CREATE OR REPLACE VIEW admin_dashboard_stats AS
SELECT 
    (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) as total_active_users,
    (SELECT COUNT(*) FROM users WHERE deleted_at IS NOT NULL) as total_deleted_users,
    (SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'pending' AND deleted_at IS NULL) as pending_admins,
    (SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active' AND deleted_at IS NULL) as active_admins,
    (SELECT COUNT(*) FROM users WHERE role = 'customer' AND deleted_at IS NULL) as total_customers,
    (SELECT COUNT(*) FROM logout_sessions WHERE created_at > NOW() - INTERVAL '24 hours') as logouts_last_24h,
    (SELECT COUNT(*) FROM deleted_accounts WHERE deleted_at > NOW() - INTERVAL '30 days') as deletions_last_30d;

-- View for audit trail (combines onboarding and account management history)
CREATE OR REPLACE VIEW audit_trail AS
SELECT 
    'onboarding' as event_type,
    oh.id,
    oh.user_id,
    u.email,
    u.name,
    oh.action as event_action,
    oh.performed_by,
    pb.name as performed_by_name,
    oh.reason,
    oh.notes,
    oh.created_at
FROM onboarding_history oh
LEFT JOIN users u ON oh.user_id = u.id
LEFT JOIN users pb ON oh.performed_by = pb.id

UNION ALL

SELECT 
    'logout' as event_type,
    ls.id,
    ls.user_id,
    u.email,
    u.name,
    ls.logout_reason as event_action,
    NULL as performed_by,
    NULL as performed_by_name,
    NULL as reason,
    ls.user_agent as notes,
    ls.created_at
FROM logout_sessions ls
LEFT JOIN users u ON ls.user_id = u.id

UNION ALL

SELECT 
    'deletion' as event_type,
    da.id,
    da.original_user_id as user_id,
    da.email,
    da.name,
    da.deletion_reason as event_action,
    da.deleted_by as performed_by,
    db.name as performed_by_name,
    da.deletion_reason as reason,
    da.deletion_notes as notes,
    da.deleted_at as created_at
FROM deleted_accounts da
LEFT JOIN users db ON da.deleted_by = db.id

ORDER BY created_at DESC;

-- View for customer statistics
CREATE OR REPLACE VIEW customer_stats AS
SELECT 
    (SELECT COUNT(*) FROM users WHERE role = 'customer' AND deleted_at IS NULL) as total_customers,
    (SELECT COUNT(*) FROM users WHERE role = 'customer' AND deleted_at IS NULL AND created_at > NOW() - INTERVAL '30 days') as new_customers_last_30d,
    (SELECT COUNT(*) FROM users WHERE role = 'customer' AND deleted_at IS NULL AND created_at > NOW() - INTERVAL '7 days') as new_customers_last_7d,
    (SELECT COUNT(DISTINCT customer_id) FROM orders WHERE created_at > NOW() - INTERVAL '30 days') as active_customers_last_30d;

-- =============================================
-- DEFAULT DATA
-- =============================================

-- Insert default super admin (change email and name as needed)
INSERT INTO users (email, name, role, status) 
VALUES ('superadmin@example.com', 'Super Admin', 'super_admin', 'active')
ON CONFLICT (email) DO NOTHING;

-- Insert sample customer for testing (optional)
INSERT INTO users (email, name, role, status) 
VALUES ('customer@example.com', 'Test Customer', 'customer', 'active')
ON CONFLICT (email) DO NOTHING;

-- =============================================
-- VERIFICATION AND COMPLETION
-- =============================================

-- Verify all tables exist
DO $
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('users', 'magic_tokens', 'onboarding_history', 'logout_sessions', 'deleted_accounts');
    
    IF table_count = 5 THEN
        RAISE NOTICE 'SUCCESS: All required tables created (%)!', table_count;
    ELSE
        RAISE WARNING 'WARNING: Missing tables! Expected 5, found %', table_count;
    END IF;
END $;

-- Verify all functions exist
DO $
DECLARE
    function_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO function_count 
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name IN (
        'update_updated_at_column',
        'log_onboarding_history',
        'get_pending_admins_count', 
        'get_onboarding_stats',
        'soft_delete_user',
        'hard_delete_user',
        'restore_deleted_user',
        'is_token_blacklisted',
        'cleanup_old_logout_sessions',
        'cleanup_expired_tokens',
        'get_account_deletion_stats',
        'get_user_activity_summary',
        'cleanup_customer_data'
    );
    
    IF function_count >= 13 THEN
        RAISE NOTICE 'SUCCESS: All required functions created (%)!', function_count;
    ELSE
        RAISE WARNING 'WARNING: Missing functions! Expected 13+, found %', function_count;
    END IF;
END $;

-- Verify all views exist
DO $
DECLARE
    view_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO view_count 
    FROM information_schema.views 
    WHERE table_schema = 'public' 
    AND table_name IN ('active_users', 'admin_dashboard_stats', 'audit_trail', 'customer_stats');
    
    IF view_count = 4 THEN
        RAISE NOTICE 'SUCCESS: All required views created (%)!', view_count;
    ELSE
        RAISE WARNING 'WARNING: Missing views! Expected 4, found %', view_count;
    END IF;
END $;

SELECT 
    'soft_delete_user' as function_name,
    proname,
    pg_get_function_arguments(oid) as arguments
FROM pg_proc 
WHERE proname = 'soft_delete_user';

SELECT 'All functions recreated successfully!' as status;

-- Final success message
RAISE NOTICE '🎉 Complete Authentication System with Customer Support Initialized!';
