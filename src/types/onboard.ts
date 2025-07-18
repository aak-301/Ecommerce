// src/types/onboard.ts
export interface OnboardingHistory {
  id: string;
  user_id: string;
  action: "pending" | "approved" | "rejected" | "suspended";
  performed_by: string;
  reason?: string;
  notes?: string;
  created_at: Date;
}

export interface OnboardingStats {
  total_admins: number;
  pending_admins: number;
  active_admins: number;
  suspended_admins: number;
  rejected_admins: number;
}

export interface OnboardRequest {
  userId: string;
  action: "approve" | "reject" | "suspend";
  reason?: string;
  notes?: string;
}

export interface AdminWithOnboardingInfo {
  id: string;
  email: string;
  name: string;
  role: "admin";
  status: "pending" | "active" | "suspended" | "rejected";
  onboarded_by?: string;
  onboarded_at?: Date;
  rejection_reason?: string;
  notes?: string;
  created_at: Date;
  updated_at: Date;
  onboarded_by_name?: string;
  onboarding_history?: OnboardingHistory[];
}
