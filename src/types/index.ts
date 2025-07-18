// src/types/index.ts - Complete updated types
export type UserRole = "super_admin" | "admin" | "customer";
export type UserStatus = "pending" | "active" | "suspended" | "rejected";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  created_at: Date;
  updated_at: Date;
  // Onboarding fields
  onboarded_by?: string;
  onboarded_at?: Date;
  rejection_reason?: string;
  notes?: string;
  // Soft delete fields
  deleted_at?: Date;
  deletion_reason?: string;
  deleted_by?: string;
}

export interface MagicToken {
  id: string;
  email: string;
  token: string;
  expires_at: Date;
  used: boolean;
  created_at: Date;
}

export interface AuthRequest extends Request {
  user?: User;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}
