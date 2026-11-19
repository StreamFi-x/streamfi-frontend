/**
 * Deterministic cache tags and keys. Readers tag entries with the identifier
 * they looked the row up by; writers invalidate every identifier the row can
 * be looked up by (see lib/cache/invalidation.ts).
 *
 * Components are URI-encoded so user-controlled values (usernames) cannot
 * forge separators and collide with another entry.
 */

const part = (value: string) => encodeURIComponent(value.trim());

export const cacheTags = {
  userByName: (username: string) => `user:name:${part(username.toLowerCase())}`,
  userByWallet: (wallet: string) => `user:wallet:${part(wallet)}`,
  categories: () => "categories",
};

export function cacheKey(namespace: string, ...parts: string[]): string {
  return [namespace, ...parts.map(part)].join(":");
}
