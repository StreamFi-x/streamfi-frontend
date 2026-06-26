import type { PushPlatform, PushToken } from "./types";

/**
 * Tokens are deduplicated per (viewer_id, platform): a viewer holds at most one
 * push token per platform. Registering again for the same pair replaces the
 * stored token value but keeps the same token_id (a stable registration slot).
 */
const tokens = new Map<string, PushToken>();
let counter = 0;

function key(viewerId: string, platform: PushPlatform): string {
  return `${viewerId}:${platform}`;
}

export interface RegisterResult {
  record: PushToken;
  /** True when an existing token for this viewer+platform was overwritten. */
  replaced: boolean;
}

export function registerToken(
  viewerId: string,
  platform: PushPlatform,
  token: string,
  now: number = Date.now()
): RegisterResult {
  const k = key(viewerId, platform);
  const existing = tokens.get(k);

  if (existing) {
    // Idempotent: re-registering the exact same token is a no-op.
    if (existing.token === token) {
      return { record: existing, replaced: false };
    }
    // Replace the token value in place, preserving the registration slot id.
    const updated: PushToken = {
      ...existing,
      token,
      registered_at: new Date(now).toISOString(),
    };
    tokens.set(k, updated);
    return { record: updated, replaced: true };
  }

  const record: PushToken = {
    token_id: `tok_${++counter}`,
    viewer_id: viewerId,
    platform,
    token,
    registered_at: new Date(now).toISOString(),
  };
  tokens.set(k, record);
  return { record, replaced: false };
}

export function removeByTokenId(tokenId: string): boolean {
  for (const [k, record] of tokens) {
    if (record.token_id === tokenId) {
      tokens.delete(k);
      return true;
    }
  }
  return false;
}

export function removeByViewerPlatform(
  viewerId: string,
  platform: PushPlatform
): boolean {
  return tokens.delete(key(viewerId, platform));
}

export function getToken(
  viewerId: string,
  platform: PushPlatform
): PushToken | undefined {
  return tokens.get(key(viewerId, platform));
}

export function resetStore(): void {
  tokens.clear();
  counter = 0;
}
