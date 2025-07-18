// src/models/OnboardModel.ts
import pool from "../config/database";
import { User } from "../types";
import {
  OnboardingHistory,
  OnboardingStats,
  AdminWithOnboardingInfo,
} from "../types/onboard";

export class OnboardModel {
  // Get all pending admins
  static async getPendingAdmins(): Promise<AdminWithOnboardingInfo[]> {
    const query = `
      SELECT 
        u.*,
        ob.name as onboarded_by_name
      FROM users u
      LEFT JOIN users ob ON u.onboarded_by = ob.id
      WHERE u.role = 'admin' AND u.status = 'pending'
      ORDER BY u.created_at DESC
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  // Get all admins with onboarding info
  static async getAllAdmins(
    status?: string,
    limit = 50,
    offset = 0
  ): Promise<AdminWithOnboardingInfo[]> {
    let query = `
      SELECT 
        u.*,
        ob.name as onboarded_by_name
      FROM users u
      LEFT JOIN users ob ON u.onboarded_by = ob.id
      WHERE u.role = 'admin'
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND u.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY u.created_at DESC LIMIT $${paramIndex} OFFSET $${
      paramIndex + 1
    }`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  // Get admin by ID with onboarding info
  static async getAdminById(
    id: string
  ): Promise<AdminWithOnboardingInfo | null> {
    const query = `
      SELECT 
        u.*,
        ob.name as onboarded_by_name
      FROM users u
      LEFT JOIN users ob ON u.onboarded_by = ob.id
      WHERE u.id = $1 AND u.role = 'admin'
    `;

    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  // Approve admin
  static async approveAdmin(
    userId: string,
    approvedBy: string,
    notes?: string
  ): Promise<User | null> {
    const query = `
      UPDATE users 
      SET 
        status = 'active',
        onboarded_by = $2,
        onboarded_at = NOW(),
        notes = $3,
        rejection_reason = NULL,
        updated_at = NOW()
      WHERE id = $1 AND role = 'admin'
      RETURNING *
    `;

    const result = await pool.query(query, [userId, approvedBy, notes]);
    return result.rows[0] || null;
  }

  // Reject admin
  static async rejectAdmin(
    userId: string,
    rejectedBy: string,
    reason?: string,
    notes?: string
  ): Promise<User | null> {
    const query = `
      UPDATE users 
      SET 
        status = 'rejected',
        onboarded_by = $2,
        onboarded_at = NOW(),
        rejection_reason = $3,
        notes = $4,
        updated_at = NOW()
      WHERE id = $1 AND role = 'admin'
      RETURNING *
    `;

    const result = await pool.query(query, [userId, rejectedBy, reason, notes]);
    return result.rows[0] || null;
  }

  // Suspend admin
  static async suspendAdmin(
    userId: string,
    suspendedBy: string,
    reason?: string,
    notes?: string
  ): Promise<User | null> {
    const query = `
      UPDATE users 
      SET 
        status = 'suspended',
        onboarded_by = $2,
        onboarded_at = NOW(),
        rejection_reason = $3,
        notes = $4,
        updated_at = NOW()
      WHERE id = $1 AND role = 'admin'
      RETURNING *
    `;

    const result = await pool.query(query, [
      userId,
      suspendedBy,
      reason,
      notes,
    ]);
    return result.rows[0] || null;
  }

  // Reactivate admin
  static async reactivateAdmin(
    userId: string,
    reactivatedBy: string,
    notes?: string
  ): Promise<User | null> {
    const query = `
      UPDATE users 
      SET 
        status = 'active',
        onboarded_by = $2,
        onboarded_at = NOW(),
        rejection_reason = NULL,
        notes = $3,
        updated_at = NOW()
      WHERE id = $1 AND role = 'admin'
      RETURNING *
    `;

    const result = await pool.query(query, [userId, reactivatedBy, notes]);
    return result.rows[0] || null;
  }

  // Get onboarding history for a user
  static async getOnboardingHistory(
    userId: string
  ): Promise<OnboardingHistory[]> {
    const query = `
      SELECT 
        oh.*,
        u.name as performed_by_name
      FROM onboarding_history oh
      LEFT JOIN users u ON oh.performed_by = u.id
      WHERE oh.user_id = $1
      ORDER BY oh.created_at DESC
    `;

    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  // Get onboarding statistics
  static async getOnboardingStats(): Promise<OnboardingStats> {
    const query = `SELECT * FROM get_onboarding_stats()`;
    const result = await pool.query(query);
    return result.rows[0];
  }

  // Get pending admins count
  static async getPendingAdminsCount(): Promise<number> {
    const query = `SELECT get_pending_admins_count() as count`;
    const result = await pool.query(query);
    return result.rows[0].count;
  }

  // Search admins
  static async searchAdmins(
    searchTerm: string,
    status?: string,
    limit = 50,
    offset = 0
  ): Promise<AdminWithOnboardingInfo[]> {
    let query = `
      SELECT 
        u.*,
        ob.name as onboarded_by_name
      FROM users u
      LEFT JOIN users ob ON u.onboarded_by = ob.id
      WHERE u.role = 'admin'
      AND (
        u.name ILIKE $1 OR 
        u.email ILIKE $1
      )
    `;

    const params: any[] = [`%${searchTerm}%`];
    let paramIndex = 2;

    if (status) {
      query += ` AND u.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY u.created_at DESC LIMIT $${paramIndex} OFFSET $${
      paramIndex + 1
    }`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  // Get admins onboarded by a specific super admin
  static async getAdminsByOnboarder(
    onboarderId: string,
    limit = 50,
    offset = 0
  ): Promise<AdminWithOnboardingInfo[]> {
    const query = `
      SELECT 
        u.*,
        ob.name as onboarded_by_name
      FROM users u
      LEFT JOIN users ob ON u.onboarded_by = ob.id
      WHERE u.role = 'admin' AND u.onboarded_by = $1
      ORDER BY u.onboarded_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [onboarderId, limit, offset]);
    return result.rows;
  }
}
