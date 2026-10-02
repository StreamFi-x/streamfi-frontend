export interface MinTipConfig {
  creator_id: string;
  min_xlm: number;
  min_usdc: number;
}

export interface CheckTipResult {
  allowed: boolean;
  reason?: string;
}
