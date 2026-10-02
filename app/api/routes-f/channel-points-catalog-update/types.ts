export interface Reward {
  reward_id: string;
  creator_id: string;
  title: string;
  cost: number; // channel points required to redeem
  cooldown: number; // seconds a viewer must wait between redemptions
  stock: number | null; // remaining redemptions; null = unlimited
  updated_at: string; // ISO timestamp
}

export interface CatalogUpdateBody {
  creatorId: string;
  rewardId: string;
  title?: string;
  cost?: number;
  cooldown?: number;
  stock?: number | null;
}

export interface CatalogUpdateResponse {
  reward: Reward;
}
