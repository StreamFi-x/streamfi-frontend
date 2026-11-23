/**
 * Reserved usernames blocklist preventing collisions with static Next.js app
 * routes, API paths, and platform/system terms.
 *
 * Because user profiles live at the dynamic top-level route `app/[username]`,
 * registering any static route segment or system term as a handle would either
 * shadow/break the profile page or conflict with application navigation.
 */

/**
 * Every static top-level route directory under `app/`.
 * Keep this list synchronized with `app/` whenever a new top-level route is added.
 */
export const STATIC_APP_ROUTES = [
  "admin",
  "api",
  "browse",
  "dashboard",
  "explore",
  "onboarding",
  "overlay",
  "settings",
  "test-tip",
] as const;

/**
 * Additional reserved system, platform, and web-standard identifiers that
 * cannot be claimed as user handles.
 */
export const RESERVED_SYSTEM_TERMS = [
  "about",
  "account",
  "accounts",
  "app",
  "auth",
  "billing",
  "blog",
  "cdn",
  "channel",
  "channels",
  "clips",
  "community",
  "config",
  "contact",
  "creator",
  "creators",
  "dev",
  "docs",
  "donate",
  "download",
  "embed",
  "events",
  "faq",
  "favicon",
  "feed",
  "followers",
  "following",
  "help",
  "home",
  "index",
  "internal",
  "jobs",
  "legal",
  "live",
  "login",
  "logout",
  "me",
  "metrics",
  "mod",
  "moderation",
  "moderator",
  "new",
  "next",
  "_next",
  "notifications",
  "oauth",
  "official",
  "payout",
  "payouts",
  "pricing",
  "privacy",
  "profile",
  "profiles",
  "public",
  "register",
  "report",
  "reports",
  "robots",
  "root",
  "rss",
  "search",
  "security",
  "signin",
  "signout",
  "signup",
  "sitemap",
  "staff",
  "static",
  "status",
  "stream",
  "streamer",
  "streamers",
  "streamfi",
  "streams",
  "studio",
  "subscribe",
  "subscriptions",
  "support",
  "system",
  "terms",
  "tip",
  "tips",
  "tos",
  "trending",
  "u",
  "user",
  "users",
  "verify",
  "video",
  "videos",
  "wallet",
  "wallets",
  "watch",
  "webhooks",
  "well-known",
  "www",
] as const;

const STATIC_ROUTE_SET: ReadonlySet<string> = new Set(STATIC_APP_ROUTES);

export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  ...STATIC_APP_ROUTES,
  ...RESERVED_SYSTEM_TERMS,
]);

/**
 * Normalizes a candidate username for reserved-word comparison.
 */
export function normalizeUsernameForCheck(username: string): string {
  return username.trim().toLowerCase();
}

/**
 * Returns true if the given username collides with a static app route or
 * reserved system term (case-insensitive).
 */
export function isReservedUsername(username: string): boolean {
  if (!username || typeof username !== "string") {
    return false;
  }
  const normalized = normalizeUsernameForCheck(username);
  if (!normalized) {
    return false;
  }
  return RESERVED_USERNAMES.has(normalized);
}

/**
 * Returns a user-facing error message if the username is reserved, or null if
 * the username is allowed.
 */
export function getReservedUsernameError(username: string): string | null {
  if (!isReservedUsername(username)) {
    return null;
  }
  const normalized = normalizeUsernameForCheck(username);
  if (STATIC_ROUTE_SET.has(normalized)) {
    return `The username "${normalized}" is reserved because it conflicts with a built-in application route. Please choose a different username.`;
  }
  return `The username "${normalized}" is reserved by StreamFi and cannot be used. Please choose a different username.`;
}
