// src/models/User.ts - Updated to exclude soft-deleted users by default
import pool from "../config/database";
import { User, UserRole, UserStatus } from "../types";
import { v4 as uuidv4 } from "uuid";

export class UserModel {
  static async findByEmail(
    email: string,
    includeSoftDeleted: boolean = false
  ): Promise<User | null> {
    let query = "SELECT * FROM users WHERE email = $1";

    if (!includeSoftDeleted) {
      query += " AND deleted_at IS NULL";
    }

    const result = await pool.query(query, [email]);
    return result.rows[0] || null;
  }

  static async findById(
    id: string,
    includeSoftDeleted: boolean = false
  ): Promise<User | null> {
    let query = "SELECT * FROM users WHERE id = $1";

    if (!includeSoftDeleted) {
      query += " AND deleted_at IS NULL";
    }

    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  static async create(
    email: string,
    name: string,
    role: UserRole = "customer"
  ): Promise<User> {
    const id = uuidv4();
    const status: UserStatus = role === "admin" ? "pending" : "active";

    const query = `
      INSERT INTO users (id, email, name, role, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [id, email, name, role, status]);
    return result.rows[0];
  }

  static async updateStatus(
    id: string,
    status: UserStatus
  ): Promise<User | null> {
    const query = `
      UPDATE users 
      SET status = $1, updated_at = NOW() 
      WHERE id = $2 AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await pool.query(query, [status, id]);
    return result.rows[0] || null;
  }

  static async getAllPendingAdmins(): Promise<User[]> {
    const query = `
      SELECT * FROM users 
      WHERE role = $1 AND status = $2 AND deleted_at IS NULL 
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query, ["admin", "pending"]);
    return result.rows;
  }

  // Get all active users (excluding soft-deleted)
  static async getAllUsers(
    limit: number = 50,
    offset: number = 0,
    role?: UserRole,
    status?: UserStatus
  ): Promise<User[]> {
    let query = `
      SELECT * FROM users 
      WHERE deleted_at IS NULL
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (role) {
      query += ` AND role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${
      paramIndex + 1
    }`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  // Count active users
  static async countUsers(
    role?: UserRole,
    status?: UserStatus
  ): Promise<number> {
    let query =
      "SELECT COUNT(*)::INTEGER as count FROM users WHERE deleted_at IS NULL";
    const params: any[] = [];
    let paramIndex = 1;

    if (role) {
      query += ` AND role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const result = await pool.query(query, params);
    return result.rows[0].count;
  }

  // Search users (excluding soft-deleted)
  static async searchUsers(
    searchTerm: string,
    limit: number = 50,
    offset: number = 0,
    role?: UserRole
  ): Promise<User[]> {
    let query = `
      SELECT * FROM users 
      WHERE deleted_at IS NULL
      AND (name ILIKE $1 OR email ILIKE $1)
    `;

    const params: any[] = [`%${searchTerm}%`];
    let paramIndex = 2;

    if (role) {
      query += ` AND role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${
      paramIndex + 1
    }`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  // Update user profile
  static async updateProfile(
    id: string,
    updates: Partial<Pick<User, "name" | "email">>
  ): Promise<User | null> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.name) {
      fields.push(`name = $${paramIndex}`);
      values.push(updates.name);
      paramIndex++;
    }

    if (updates.email) {
      fields.push(`email = $${paramIndex}`);
      values.push(updates.email);
      paramIndex++;
    }

    if (fields.length === 0) {
      throw new Error("No fields to update");
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE users 
      SET ${fields.join(", ")}
      WHERE id = $${paramIndex} AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }
}
