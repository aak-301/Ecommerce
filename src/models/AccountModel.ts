// src/models/AccountModel.ts
import pool from "../config/database";
import { User } from "../types";
import { LogoutSession, DeletedAccount } from "../types/account";
import crypto from "crypto";

export class AccountModel {
  // Create logout session record
  static async createLogoutSession(
    userId: string,
    token: string,
    reason: string = "manual",
    ipAddress?: string,
    userAgent?: string
  ): Promise<LogoutSession> {
    // Hash the token for security (don't store actual JWT)
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const query = `
      INSERT INTO logout_sessions (user_id, token_hash, logout_reason, ip_address, user_agent)
      VALUES ($1::UUID, $2::TEXT, $3::TEXT, $4::INET, $5::TEXT)
      RETURNING *
    `;

    const result = await pool.query(query, [
      userId,
      tokenHash,
      reason,
      ipAddress || null,
      userAgent || null,
    ]);
    return result.rows[0];
  }

  // Check if token is blacklisted
  static async isTokenBlacklisted(token: string): Promise<boolean> {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const query = `SELECT is_token_blacklisted($1::TEXT) as is_blacklisted`;
    const result = await pool.query(query, [tokenHash]);

    return result.rows[0].is_blacklisted;
  }

  static async softDeleteUser(
    userId: string,
    deletedBy?: string,
    reason: string = "user_request",
    notes?: string
  ): Promise<boolean> {
    const query = `SELECT soft_delete_user($1, $2, $3, $4) as success`;
    console.log("Hello-sftU");
    
    const result = await pool.query(query, [
      userId,
      deletedBy || null,
      reason,
      notes || null,
    ]);

    return result.rows[0].success;
  }

  // Hard delete user account (permanent) - FIXED
  static async hardDeleteUser(userId: string): Promise<boolean> {
    const query = `SELECT hard_delete_user($1) as success`;
    const result = await pool.query(query, [userId]);

    return result.rows[0].success;
  }

  // Restore soft deleted user - FIXED
  static async restoreDeletedUser(userId: string): Promise<boolean> {
    const query = `SELECT restore_deleted_user($1) as success`;
    const result = await pool.query(query, [userId]);

    return result.rows[0].success;
  }

  // Get user logout history
  static async getUserLogoutHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<LogoutSession[]> {
    const query = `
      SELECT * FROM logout_sessions 
      WHERE user_id = $1::UUID 
      ORDER BY created_at DESC 
      LIMIT $2::INTEGER OFFSET $3::INTEGER
    `;

    const result = await pool.query(query, [userId, limit, offset]);
    return result.rows;
  }

  // Get deleted accounts (admin only)
  static async getDeletedAccounts(
    limit: number = 50,
    offset: number = 0,
    deletedBy?: string
  ): Promise<DeletedAccount[]> {
    let query = `
      SELECT da.*, u.name as deleted_by_name 
      FROM deleted_accounts da
      LEFT JOIN users u ON da.deleted_by = u.id
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (deletedBy) {
      query += ` WHERE da.deleted_by = $${paramIndex}::UUID`;
      params.push(deletedBy);
      paramIndex++;
    }

    query += ` ORDER BY da.deleted_at DESC LIMIT $${paramIndex}::INTEGER OFFSET $${
      paramIndex + 1
    }::INTEGER`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  // Get specific deleted account
  static async getDeletedAccountById(
    originalUserId: string
  ): Promise<DeletedAccount | null> {
    const query = `
      SELECT da.*, u.name as deleted_by_name 
      FROM deleted_accounts da
      LEFT JOIN users u ON da.deleted_by = u.id
      WHERE da.original_user_id = $1::UUID
    `;

    const result = await pool.query(query, [originalUserId]);
    return result.rows[0] || null;
  }

  // Force logout all user sessions (admin action)
  static async forceLogoutAllUserSessions(
    userId: string,
    performedBy: string,
    reason: string = "admin_forced"
  ): Promise<void> {
    const query = `
      INSERT INTO logout_sessions (user_id, token_hash, logout_reason, created_at)
      VALUES ($1::UUID, $2::TEXT, $3::TEXT, NOW())
    `;

    await pool.query(query, [userId, "FORCE_LOGOUT_ALL", reason]);
  }

  // Clean up old logout sessions
  static async cleanupOldLogoutSessions(daysOld: number = 30): Promise<number> {
    const query = `SELECT cleanup_old_logout_sessions($1::INTEGER) as deleted_count`;
    const result = await pool.query(query, [daysOld]);

    return result.rows[0].deleted_count;
  }

  // Get account deletion statistics
  static async getAccountDeletionStats(): Promise<{
    total_deleted: number;
    user_requested: number;
    admin_action: number;
    policy_violation: number;
    inactive: number;
  }> {
    const query = `
      SELECT 
        COUNT(*)::INTEGER as total_deleted,
        COUNT(CASE WHEN deletion_reason = 'user_request' THEN 1 END)::INTEGER as user_requested,
        COUNT(CASE WHEN deletion_reason = 'admin_action' THEN 1 END)::INTEGER as admin_action,
        COUNT(CASE WHEN deletion_reason = 'policy_violation' THEN 1 END)::INTEGER as policy_violation,
        COUNT(CASE WHEN deletion_reason = 'inactive' THEN 1 END)::INTEGER as inactive
      FROM deleted_accounts
    `;

    const result = await pool.query(query);
    return result.rows[0];
  }

  // Get user by ID (including soft-deleted users for admin operations)
  static async getUserById(
    userId: string,
    includeSoftDeleted: boolean = false
  ): Promise<User | null> {
    let query = "SELECT * FROM users WHERE id = $1::UUID";

    if (!includeSoftDeleted) {
      query += " AND deleted_at IS NULL";
    }

    const result = await pool.query(query, [userId]);
    return result.rows[0] || null;
  }

  // Get user by email (excluding soft-deleted by default)
  static async getUserByEmail(
    email: string,
    includeSoftDeleted: boolean = false
  ): Promise<User | null> {
    let query = "SELECT * FROM users WHERE email = $1::TEXT";

    if (!includeSoftDeleted) {
      query += " AND deleted_at IS NULL";
    }

    const result = await pool.query(query, [email]);
    return result.rows[0] || null;
  }

  // Update user's last activity timestamp
  static async updateLastActivity(userId: string): Promise<void> {
    const query = `
    UPDATE users 
    SET updated_at = NOW() 
    WHERE id = $1::UUID AND deleted_at IS NULL
  `;

    await pool.query(query, [userId]);
  }

  // Get all active users (excluding soft-deleted)
  static async getAllActiveUsers(
    limit: number = 50,
    offset: number = 0,
    role?: string
  ): Promise<User[]> {
    let query = `
    SELECT * FROM users 
    WHERE deleted_at IS NULL
  `;

    const params: any[] = [];
    let paramIndex = 1;

    if (role) {
      query += ` AND role = $${paramIndex}::TEXT`;
      params.push(role);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex}::INTEGER OFFSET $${
      paramIndex + 1
    }::INTEGER`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  // Count active users
  static async countActiveUsers(role?: string): Promise<number> {
    let query =
      "SELECT COUNT(*)::INTEGER as count FROM users WHERE deleted_at IS NULL";
    const params: any[] = [];

    if (role) {
      query += " AND role = $1::TEXT";
      params.push(role);
    }

    const result = await pool.query(query, params);
    return result.rows[0].count;
  }

  // Search users (excluding soft-deleted)
  static async searchUsers(
    searchTerm: string,
    limit: number = 50,
    offset: number = 0,
    role?: string
  ): Promise<User[]> {
    let query = `
    SELECT * FROM users 
    WHERE deleted_at IS NULL
    AND (name ILIKE $1::TEXT OR email ILIKE $1::TEXT)
  `;

    const params: any[] = [`%${searchTerm}%`];
    let paramIndex = 2;

    if (role) {
      query += ` AND role = $${paramIndex}::TEXT`;
      params.push(role);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex}::INTEGER OFFSET $${
      paramIndex + 1
    }::INTEGER`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  // Get user activity summary
  static async getUserActivitySummary(userId: string): Promise<{
    total_logins: number;
    total_logouts: number;
    last_login: Date | null;
    last_logout: Date | null;
    account_age_days: number;
  }> {
    const query = `
    SELECT 
      COALESCE(logout_count.total_logouts, 0)::INTEGER as total_logouts,
      logout_count.last_logout,
      COALESCE(EXTRACT(DAY FROM NOW() - u.created_at), 0)::INTEGER as account_age_days,
      u.created_at,
      u.updated_at as last_activity
    FROM users u
    LEFT JOIN (
      SELECT 
        user_id,
        COUNT(*)::INTEGER as total_logouts,
        MAX(created_at) as last_logout
      FROM logout_sessions 
      WHERE user_id = $1::UUID
      GROUP BY user_id
    ) logout_count ON u.id = logout_count.user_id
    WHERE u.id = $1::UUID
  `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      throw new Error("User not found");
    }

    const row = result.rows[0];

    return {
      total_logins: 0, // This would require login tracking implementation
      total_logouts: row.total_logouts,
      last_login: null, // This would require login tracking implementation
      last_logout: row.last_logout,
      account_age_days: row.account_age_days,
    };
  }

  // Get recent logout sessions across all users (admin view)
  static async getRecentLogoutSessions(
    limit: number = 50,
    offset: number = 0,
    userId?: string
  ): Promise<LogoutSession[]> {
    let query = `
    SELECT 
      ls.*,
      u.name as user_name,
      u.email as user_email,
      u.role as user_role
    FROM logout_sessions ls
    JOIN users u ON ls.user_id = u.id
  `;

    const params: any[] = [];
    let paramIndex = 1;

    if (userId) {
      query += ` WHERE ls.user_id = $${paramIndex}::UUID`;
      params.push(userId);
      paramIndex++;
    }

    query += ` ORDER BY ls.created_at DESC LIMIT $${paramIndex}::INTEGER OFFSET $${
      paramIndex + 1
    }::INTEGER`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  // Bulk force logout users (admin operation)
  static async bulkForceLogoutUsers(
    userIds: string[],
    performedBy: string,
    reason: string = "admin_bulk_action"
  ): Promise<number> {
    if (userIds.length === 0) return 0;

    // Create logout records for all users
    const values = userIds
      .map(
        (userId, index) =>
          `($${index * 3 + 1}::UUID, $${index * 3 + 2}::TEXT, $${
            index * 3 + 3
          }::TEXT, NOW())`
      )
      .join(", ");

    const params: any[] = [];
    userIds.forEach((userId) => {
      params.push(userId, "BULK_FORCE_LOGOUT", reason);
    });

    const query = `
    INSERT INTO logout_sessions (user_id, token_hash, logout_reason, created_at)
    VALUES ${values}
  `;

    const result = await pool.query(query, params);
    return result.rowCount || 0;
  }

  // Get deletion statistics by date range
  static async getDeletionStatsByDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<{
    daily_deletions: Array<{
      date: string;
      count: number;
      user_request: number;
      admin_action: number;
      policy_violation: number;
      inactive: number;
    }>;
    total_in_range: number;
  }> {
    const query = `
    SELECT 
      DATE(deleted_at) as date,
      COUNT(*)::INTEGER as count,
      COUNT(CASE WHEN deletion_reason = 'user_request' THEN 1 END)::INTEGER as user_request,
      COUNT(CASE WHEN deletion_reason = 'admin_action' THEN 1 END)::INTEGER as admin_action,
      COUNT(CASE WHEN deletion_reason = 'policy_violation' THEN 1 END)::INTEGER as policy_violation,
      COUNT(CASE WHEN deletion_reason = 'inactive' THEN 1 END)::INTEGER as inactive
    FROM deleted_accounts
    WHERE deleted_at BETWEEN $1::TIMESTAMP AND $2::TIMESTAMP
    GROUP BY DATE(deleted_at)
    ORDER BY date DESC
  `;

    const result = await pool.query(query, [startDate, endDate]);

    const totalQuery = `
    SELECT COUNT(*)::INTEGER as total
    FROM deleted_accounts
    WHERE deleted_at BETWEEN $1::TIMESTAMP AND $2::TIMESTAMP
  `;

    const totalResult = await pool.query(totalQuery, [startDate, endDate]);

    return {
      daily_deletions: result.rows,
      total_in_range: totalResult.rows[0].total,
    };
  }
}
