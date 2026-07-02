export interface CatalogItem {
  id: string;
  creator_id: string;
  name: string;
  cost: number;
  cooldown_seconds: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Balance {
  viewer_id: string;
  creator_id: string;
  balance: number;
  lifetime_earned: number;
  created_at: string;
  updated_at: string;
}

export interface GrantRequest {
  viewer_id: string;
  creator_id: string;
  amount: number;
  reason: string;
}

export interface SpendRequest {
  viewer_id: string;
  creator_id: string;
  amount: number;
  item: string;
}

export interface CatalogRequest {
  creator_id: string;
  name: string;
  cost: number;
  cooldown_seconds: number;
  enabled?: boolean;
}

export interface CatalogUpdateRequest {
  name?: string;
  cost?: number;
  cooldown_seconds?: number;
  enabled?: boolean;
}

export interface ErrorResponse {
  error: string;
  details?: Record<string, unknown>;
}

export interface SuccessResponse<T = unknown> {
  data: T;
  message?: string;
}

export type CatalogResponse = SuccessResponse<CatalogItem[]>;
export type CatalogItemResponse = SuccessResponse<CatalogItem>;
export type BalanceResponse = SuccessResponse<Balance>;
export type EmptyResponse = SuccessResponse<Record<string, never>>;