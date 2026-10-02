import type { MinTipConfig } from "./types";

export const minTipStore = new Map<string, MinTipConfig>();

export function getMinTip(creator_id: string): MinTipConfig {
  return minTipStore.get(creator_id) ?? { creator_id, min_xlm: 0, min_usdc: 0 };
}

export function setMinTip(
  creator_id: string,
  min_xlm?: number,
  min_usdc?: number
): MinTipConfig {
  const current = getMinTip(creator_id);
  const updated: MinTipConfig = {
    creator_id,
    min_xlm: min_xlm ?? current.min_xlm,
    min_usdc: min_usdc ?? current.min_usdc,
  };
  minTipStore.set(creator_id, updated);
  return updated;
}

export function checkTip(
  creator_id: string,
  asset: string,
  amount: number
): { allowed: boolean; reason?: string } {
  const config = getMinTip(creator_id);

  if (asset === "XLM") {
    if (amount < config.min_xlm) {
      return {
        allowed: false,
        reason: `Minimum XLM tip is ${config.min_xlm}. You sent ${amount}.`,
      };
    }
    return { allowed: true };
  }

  if (asset === "USDC") {
    if (amount < config.min_usdc) {
      return {
        allowed: false,
        reason: `Minimum USDC tip is ${config.min_usdc}. You sent ${amount}.`,
      };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: `Unsupported asset: "${asset}". Use XLM or USDC.` };
}
