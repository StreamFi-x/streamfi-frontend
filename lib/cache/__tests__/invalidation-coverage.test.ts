/**
 * @jest-environment node
 *
 * Enforces the rule from docs/caching-policy.md: every code path that writes
 * data behind a cached read invalidates it. A new write path fails this test
 * until it calls the invalidation helper or is added to the allowlist with a
 * reason. This is what stops the policy decaying back into ad hoc caching.
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative, sep } from "path";

const ROOT = join(__dirname, "..", "..", "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      return name === "__tests__" || name === "node_modules"
        ? []
        : sourceFiles(full);
    }
    return /\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)
      ? [full]
      : [];
  });
}

const files = [
  ...sourceFiles(join(ROOT, "app")),
  ...sourceFiles(join(ROOT, "lib")),
].map(f => ({
  path: relative(ROOT, f).split(sep).join("/"),
  // Ignore commented-out code (e.g. app/api/users/update/Dupdate.ts).
  code: readFileSync(f, "utf8")
    .split("\n")
    .filter(line => !/^\s*(\/\/|\*)/.test(line))
    .join("\n"),
}));

const RULES = [
  {
    name: "user rows / follow edges",
    writes:
      /\b(UPDATE\s+users\b|DELETE\s+FROM\s+users\b|INSERT\s+INTO\s+users\b|INSERT\s+INTO\s+user_follows\b|DELETE\s+FROM\s+user_follows\b)/i,
    invalidation: /invalidate(User|Follow)Caches\(/,
    allow: {
      "app/api/streams/viewers/route.ts":
        "current_viewers/total_views change on every join/leave; TTL-bounded by publicProfile",
      "app/api/users/notifications/route.ts":
        "notifications are not part of any cached read",
      "lib/notifications.ts": "notifications are not part of any cached read",
      "app/api/routes-f/auth-password-reset-confirm/route.ts":
        "password_hash is never cached",
      "app/api/routes-f/referrals/route.ts":
        "referral_code is not part of any cached read",
      "app/api/routes-f/referrals/[code]/route.ts":
        "referred_by is not part of any cached read",
      "app/api/routes-f/admin-user-unsuspend/route.ts":
        "is_suspended is not part of any cached read",
      "app/api/auth/session/route.ts":
        "creates a row with no username or wallet yet",
      "app/api/debug/clear-users/route.ts": "dev-only wipe of every table",
    } as Record<string, string>,
  },
  {
    name: "stream categories",
    writes: /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+stream_categories\b/i,
    invalidation: /invalidateCategoryCaches\(/,
    allow: {} as Record<string, string>,
  },
];

describe.each(RULES)("cache invalidation coverage: $name", rule => {
  const writers = files.filter(f => rule.writes.test(f.code));

  it("finds the write paths it is guarding", () => {
    expect(writers.length).toBeGreaterThan(0);
  });

  it("every writer invalidates or is allowlisted with a reason", () => {
    const missing = writers
      .filter(f => !rule.invalidation.test(f.code) && !(f.path in rule.allow))
      .map(f => f.path);
    expect(missing).toEqual([]);
  });

  it("the allowlist has no stale entries", () => {
    const stale = Object.keys(rule.allow).filter(
      path => !writers.some(f => f.path === path)
    );
    expect(stale).toEqual([]);
  });
});
