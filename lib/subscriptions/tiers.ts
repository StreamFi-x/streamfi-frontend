export interface TierConfig {
  label: string;
  durationDays: number;
}

/** Subscription tiers (mock catalogue shared by purchase and renewal). */
export const TIERS: Record<string, TierConfig> = {
  basic: { label: "Basic", durationDays: 30 },
  standard: { label: "Standard", durationDays: 90 },
  premium: { label: "Premium", durationDays: 365 },
};
