// API Response Types
export interface ApiResponse<T> {
  apiVersion: string;
  success: boolean;
  data?: T;
  error?: string;
  [key: string]: unknown;
}

export interface ErrorResponse {
  apiVersion: string;
  success: false;
  error: string;
  [key: string]: unknown;
}

// Viewer Types
export interface Viewer {
  id: string;
  username: string;
  created_at: string;
}

export interface Creator {
  id: string;
  username: string;
  display_name: string;
  created_at: string;
}

// Feature 1: Viewer Birthday Configuration
export interface BirthdayConfig {
  viewer_id: string;
  birthday_iso: string | null;
  share_with_creators: boolean;
  updated_at: string;
}

export interface GetBirthdayResponse {
  birthday_iso?: string;
  share_with_creators: boolean;
}

export interface SetBirthdayRequest {
  viewer_id: string;
  birthday_iso: string;
  share_with_creators: boolean;
}

// Feature 2: Viewer Follow Age Summary
export interface FollowRelationship {
  id: string;
  viewer_id: string;
  creator_id: string;
  followed_at: string;
}

export interface FollowAgeSummary {
  follows_count: number;
  avg_follow_age_days: number;
  oldest_follow_at: string | null;
}

// Feature 3: Creator Verification Request
export type VerificationMethod = 'social' | 'id' | 'kyc';

export interface VerificationRequest {
  request_id: string;
  creator_id: string;
  method: VerificationMethod;
  proof_links: string[];
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  submitted_at: string;
  reviewed_at?: string;
}

export interface SubmitVerificationRequest {
  creator_id: string;
  method: VerificationMethod;
  proof_links: string[];
}

export interface SubmitVerificationResponse {
  request_id: string;
  status: 'pending';
}

// Feature 4: Viewer Color Blind Preference
export type ColorBlindMode = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';

export interface ColorBlindPreference {
  viewer_id: string;
  mode: ColorBlindMode;
  updated_at: string;
}

export interface GetColorBlindResponse {
  mode: ColorBlindMode;
}

export interface SetColorBlindRequest {
  viewer_id: string;
  mode: ColorBlindMode;
}

// Shared Utility Types
export interface DateValidationResult {
  isValid: boolean;
  error?: string;
  date?: Date;
}

export interface ValidationError {
  field: string;
  message: string;
}