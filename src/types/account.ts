// src/types/account.ts
export interface LogoutSession {
  id: string;
  user_id: string;
  token_hash: string;
  logout_reason: "manual" | "admin_forced" | "security" | "account_deleted";
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

export interface DeletedAccount {
  id: string;
  original_user_id: string;
  email: string;
  name: string;
  role: string;
  deletion_reason:
    | "user_request"
    | "admin_action"
    | "policy_violation"
    | "inactive";
  deleted_by?: string;
  deletion_notes?: string;
  original_created_at: Date;
  deleted_at: Date;
  user_data: any;
}

export interface LogoutRequest {
  reason?: "manual" | "security";
  allDevices?: boolean; // For future implementation
}

export interface DeleteAccountRequest {
  reason?: string;
  password?: string; // For future password confirmation
  feedback?: string;
}

export interface AdminDeleteAccountRequest {
  userId: string;
  reason: "admin_action" | "policy_violation" | "inactive";
  notes?: string;
}
