/**
 * Canonical contracts for the loosely-typed JSONB columns on `users` (#1407).
 *
 * These Zod schemas are the source of truth for shape. Every application write
 * to users.sociallinks, users.creator or users.notifications must go through
 * the `prepare*` / `build*` helpers below. The database enforces a coarser
 * structural invariant (see db/migrations/20260925110000_jsonb_contract_functions.sql)
 * so that direct SQL cannot store a value of the wrong JSON type.
 *
 * Evolution rules (docs/data-integrity.md):
 *  - add new fields as optional; never make an existing optional field required;
 *  - a renamed/removed field stays in the schema as a deprecated optional key
 *    until the audit reports no stored rows using it;
 *  - legacy shapes are recognised explicitly below and are either normalised
 *    losslessly or reported, never silently dropped.
 */
import { createHash, randomUUID } from "crypto";
import { z } from "zod";

export type JsonbColumn = "sociallinks" | "creator" | "notifications";

export class JsonbContractError extends Error {
  constructor(
    readonly column: JsonbColumn,
    readonly issues: string[]
  ) {
    super(`Invalid ${column}: ${issues.join("; ")}`);
    this.name = "JsonbContractError";
  }
}

function describeIssues(error: z.ZodError): string[] {
  return error.issues.map(issue => {
    const path = issue.path.length ? issue.path.join(".") : "(root)";
    return `${path}: ${issue.message}`;
  });
}

function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Values sometimes arrive (or were stored) as a JSON string containing the
 * document ("double-encoded"). Decoding is lossless when the inner text parses.
 */
function decodeJsonString(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

// ── socialLinks ──────────────────────────────────────────────────────────────

/** Current shape, written by the settings page: { [platform]: url }. */
export const socialLinksSchema = z
  .record(
    z.string().trim().min(1).max(64),
    z
      .string()
      .trim()
      .max(2048)
      .refine(isHttpUrl, { message: "must be an http(s) URL" })
  )
  .refine(links => Object.keys(links).length <= 20, {
    message: "at most 20 social links",
  });

export type SocialLinks = z.infer<typeof socialLinksSchema>;

/**
 * Legacy element shapes: types/user.ts SocialLink, utils/userValidators, and
 * [{url, platform?}] written by /api/routes-f/profile-update-social-links.
 */
const legacyTitledLinkSchema = z
  .object({ socialTitle: z.string(), socialLink: z.string() })
  .strict();
const legacyPlatformLinkSchema = z
  .object({
    platform: z.string().optional(),
    url: z.string(),
    title: z.string().optional(),
  })
  .strict();
const legacySocialLinksArraySchema = z.array(
  z.union([legacyTitledLinkSchema, legacyPlatformLinkSchema])
);

const PLATFORM_DOMAINS: Array<[string, string[]]> = [
  ["instagram", ["instagram.com"]],
  ["twitter", ["twitter.com", "x.com"]],
  ["facebook", ["facebook.com", "fb.com"]],
  ["youtube", ["youtube.com", "youtu.be"]],
  ["telegram", ["telegram.org", "telegram.me", "t.me"]],
  ["discord", ["discord.com", "discord.gg"]],
  ["tiktok", ["tiktok.com"]],
];

/**
 * Platform key for a social link, from the URL's host (the host itself or a
 * subdomain of it). Same platform set as the settings page, but matched on
 * the parsed hostname rather than a substring of the whole URL.
 */
export function detectPlatformFromUrl(url: string): string {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "other";
  }
  for (const [platform, domains] of PLATFORM_DOMAINS) {
    if (domains.some(d => host === d || host.endsWith(`.${d}`))) {
      return platform;
    }
  }
  return "other";
}

/**
 * Convert a legacy array to the canonical map. Returns null when that cannot
 * be done without losing data (two links mapping to the same platform key).
 */
function legacySocialLinksToMap(
  links: z.infer<typeof legacySocialLinksArraySchema>
): Record<string, string> | null {
  const map: Record<string, string> = {};
  for (const link of links) {
    const [key, url] =
      "socialLink" in link
        ? [detectPlatformFromUrl(link.socialLink), link.socialLink]
        : [
            link.platform?.trim().toLowerCase() ||
              detectPlatformFromUrl(link.url),
            link.url,
          ];
    if (key in map) {
      return null;
    }
    map[key] = url;
  }
  return map;
}

/**
 * Validate a socialLinks value for writing. Accepts the canonical map or a
 * legacy array (registration still defaults to []), and always returns the
 * canonical map.
 */
export function prepareSocialLinks(input: unknown): SocialLinks {
  const decoded = decodeJsonString(input);
  const legacy = legacySocialLinksArraySchema.safeParse(decoded);
  if (legacy.success) {
    const map = legacySocialLinksToMap(legacy.data);
    if (!map) {
      throw new JsonbContractError("sociallinks", [
        "(root): more than one link for the same platform",
      ]);
    }
    return parseOrThrow(socialLinksSchema, map, "sociallinks");
  }
  return parseOrThrow(socialLinksSchema, decoded, "sociallinks");
}

// ── creator ─────────────────────────────────────────────────────────────────

const creatorFields = {
  streamTitle: z.string().max(200),
  description: z.string().max(2000),
  category: z.string().max(100),
  tags: z.array(z.string().max(50)).max(50),
  payout: z.string().max(256),
  thumbnail: z.string().max(2048),
  lastUpdated: z.string().datetime({ offset: true }),
};

/** Stored as a number or a numeric string; read with Number()/::numeric. */
const priceField = z.union([
  z.number().nonnegative(),
  z.string().regex(/^(\d+(\.\d+)?)?$/, "must be a non-negative number"),
]);

/**
 * Full creator document. `title` and `socialLinks` are deprecated keys that
 * older rows still carry (readers fall back to creator.title, and the watch
 * page reads creator.socialLinks); they stay valid but are no longer written.
 */
export const creatorSchema = z
  .object({
    streamTitle: creatorFields.streamTitle.optional(),
    description: creatorFields.description.optional(),
    category: creatorFields.category.optional(),
    tags: creatorFields.tags.optional(),
    payout: creatorFields.payout.optional(),
    thumbnail: creatorFields.thumbnail.optional(),
    lastUpdated: creatorFields.lastUpdated.optional(),
    title: z.string().max(200).optional(),
    socialLinks: socialLinksSchema.optional(),
    // Written by /api/routes-f/preview/custom with jsonb_set.
    customThumbnailUrl: z.string().url().max(2048).optional(),
    customThumbnailUpdatedAt: z.string().datetime({ offset: true }).optional(),
    // Read by streams/key, streams/update and users/[username].
    subscriptionPrice: priceField.optional(),
    subscription_price_usdc: priceField.optional(),
  })
  .strict();

export type Creator = z.infer<typeof creatorSchema>;

/** A partial update: only current (non-deprecated) keys may be written. */
export const creatorPatchSchema = z
  .object({
    streamTitle: creatorFields.streamTitle,
    description: creatorFields.description,
    category: creatorFields.category,
    tags: creatorFields.tags,
    payout: creatorFields.payout,
    thumbnail: creatorFields.thumbnail,
    lastUpdated: creatorFields.lastUpdated,
  })
  .partial()
  .strict();

export type CreatorPatch = z.infer<typeof creatorPatchSchema>;

function dropUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined)
  ) as T;
}

/** Validate a complete creator document that REPLACES the stored one. */
export function prepareCreator(input: unknown): Creator {
  const decoded = decodeJsonString(input);
  const document =
    decoded && typeof decoded === "object" && !Array.isArray(decoded)
      ? dropUndefined(decoded as Record<string, unknown>)
      : decoded;
  return parseOrThrow(creatorSchema, document, "creator");
}

/**
 * A patch can only be merged into NULL or an object. Anything else is a
 * malformed stored value that must be repaired through the audit rather than
 * overwritten by an unrelated update.
 */
export function isMergeableCreator(stored: unknown): boolean {
  return (
    isNullish(stored) || (typeof stored === "object" && !Array.isArray(stored))
  );
}

/**
 * Validate a partial update. Callers merge it in SQL with
 * `creator = creator || patch::jsonb` so concurrent updates to different keys
 * are not lost and the stored document is never re-derived from a stale read.
 */
export function prepareCreatorPatch(patch: CreatorPatch): CreatorPatch {
  return parseOrThrow(
    creatorPatchSchema,
    dropUndefined(patch as Record<string, unknown>),
    "creator"
  );
}

// ── notifications (users.notifications is JSONB[]) ───────────────────────────

export const NOTIFICATION_TYPES = ["follow", "live"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const notificationSchema = z
  .object({
    id: z.string().uuid(),
    type: z.enum(NOTIFICATION_TYPES),
    title: z.string().min(1).max(200),
    text: z.string().min(1).max(1000),
    read: z.boolean(),
    created_at: z.string().datetime({ offset: true }),
  })
  .strict();

export type StoredNotification = z.infer<typeof notificationSchema>;

/** Written by the first notifications endpoint (commit 4180b04): { title, text }. */
const legacyNotificationSchema = z
  .object({
    title: z.string(),
    text: z.string(),
    read: z.boolean().optional(),
  })
  .strict();

export function buildNotification(
  type: NotificationType,
  title: string,
  text: string,
  now: Date = new Date()
): StoredNotification {
  return parseOrThrow(
    notificationSchema,
    {
      id: randomUUID(),
      type,
      title,
      text,
      read: false,
      created_at: now.toISOString(),
    },
    "notifications"
  );
}

export interface NotificationView {
  id: string;
  type: NotificationType | "legacy";
  title: string;
  text: string;
  read: boolean;
  created_at: string | null;
}

/**
 * Read helper. Legacy elements have no id, type, read flag or timestamp: they
 * get a deterministic id, type "legacy", read = true (the old unread counter
 * compared `read === false`, so they were never counted as unread) and a null
 * timestamp rather than a fabricated one. Elements matching no known shape are
 * skipped and counted so callers can log them.
 */
export function readNotifications(stored: unknown): {
  notifications: NotificationView[];
  skipped: number;
} {
  if (!Array.isArray(stored)) {
    return { notifications: [], skipped: isNullish(stored) ? 0 : 1 };
  }
  const notifications: NotificationView[] = [];
  let skipped = 0;
  stored.forEach((element, index) => {
    const current = notificationSchema.safeParse(element);
    if (current.success) {
      notifications.push(current.data);
      return;
    }
    const legacy = legacyNotificationSchema.safeParse(element);
    if (legacy.success) {
      notifications.push({
        id: legacyNotificationId(index, legacy.data.title, legacy.data.text),
        type: "legacy",
        title: legacy.data.title,
        text: legacy.data.text,
        read: legacy.data.read ?? true,
        created_at: null,
      });
      return;
    }
    skipped++;
  });
  return { notifications, skipped };
}

function legacyNotificationId(index: number, title: string, text: string) {
  const hex = createHash("sha256")
    .update(`${index}\u0000${title}\u0000${text}`)
    .digest("hex");
  return `legacy-${hex.slice(0, 32)}`;
}

// ── audit classification ─────────────────────────────────────────────────────

/**
 * valid         matches the canonical schema
 * normalizable  a recognised legacy/double-encoded shape with a deterministic,
 *               lossless canonical form (`canonical`)
 * legacy        a recognised legacy shape that is readable but has no lossless
 *               canonical form; left in place and reported
 * nonconforming allowed by the database constraint but fails the canonical
 *               schema (e.g. a non-http URL, an unknown key); needs review
 * invalid       violates the database structural contract; must be repaired or
 *               quarantined before migration 20260925120000 can be applied
 */
export type Classification =
  | "valid"
  | "normalizable"
  | "legacy"
  | "nonconforming"
  | "invalid";

export interface ClassificationResult<T> {
  classification: Classification;
  canonical?: T;
  issues: string[];
}

/** Mirrors streamfi_jsonb_sociallinks_ok(). */
function socialLinksStructurallyValid(value: unknown): boolean {
  if (isNullish(value)) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(
      el => el !== null && typeof el === "object" && !Array.isArray(el)
    );
  }
  if (typeof value === "object") {
    return Object.values(value).every(v => v === null || typeof v === "string");
  }
  return false;
}

export function classifySocialLinks(
  stored: unknown
): ClassificationResult<SocialLinks> {
  if (isNullish(stored)) {
    return { classification: "valid", canonical: undefined, issues: [] };
  }

  const current = socialLinksSchema.safeParse(stored);
  if (current.success && !Array.isArray(stored)) {
    return { classification: "valid", canonical: current.data, issues: [] };
  }

  const decoded = decodeJsonString(stored);
  const wasEncoded = decoded !== stored;

  const legacy = legacySocialLinksArraySchema.safeParse(decoded);
  if (legacy.success) {
    const map = legacySocialLinksToMap(legacy.data);
    const canonical = map ? socialLinksSchema.safeParse(map) : null;
    if (canonical?.success) {
      return {
        classification: "normalizable",
        canonical: canonical.data,
        issues: [],
      };
    }
    return {
      classification: wasEncoded ? "invalid" : "legacy",
      issues: map
        ? describeIssues(canonical!.error!)
        : ["(root): more than one link for the same platform"],
    };
  }

  if (wasEncoded) {
    const inner = socialLinksSchema.safeParse(decoded);
    if (inner.success && !Array.isArray(decoded)) {
      return {
        classification: "normalizable",
        canonical: inner.data,
        issues: ["(root): double-encoded JSON string"],
      };
    }
  }

  if (!socialLinksStructurallyValid(stored)) {
    return {
      classification: "invalid",
      issues: [`(root): unsupported ${jsonType(stored)} value`],
    };
  }

  const reparse = socialLinksSchema.safeParse(stored);
  return {
    classification: "nonconforming",
    issues: reparse.success ? [] : describeIssues(reparse.error),
  };
}

/** Mirrors streamfi_jsonb_creator_ok(). */
function creatorStructurallyValid(value: unknown): boolean {
  if (isNullish(value)) {
    return true;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const stringKeys = [
    "streamTitle",
    "title",
    "description",
    "category",
    "payout",
    "thumbnail",
    "lastUpdated",
    "customThumbnailUrl",
    "customThumbnailUpdatedAt",
  ];
  const priceKeys = ["subscriptionPrice", "subscription_price_usdc"];
  for (const [key, v] of Object.entries(value)) {
    if (stringKeys.includes(key) && v !== null && typeof v !== "string") {
      return false;
    }
    if (
      priceKeys.includes(key) &&
      v !== null &&
      typeof v !== "string" &&
      typeof v !== "number"
    ) {
      return false;
    }
    if (
      key === "tags" &&
      v !== null &&
      !(Array.isArray(v) && v.every(t => typeof t === "string"))
    ) {
      return false;
    }
    if (key === "socialLinks" && !socialLinksStructurallyValid(v)) {
      return false;
    }
  }
  return true;
}

export function classifyCreator(
  stored: unknown
): ClassificationResult<Creator> {
  if (isNullish(stored)) {
    return { classification: "valid", canonical: undefined, issues: [] };
  }

  const current = creatorSchema.safeParse(stored);
  if (current.success) {
    return { classification: "valid", canonical: current.data, issues: [] };
  }

  const decoded = decodeJsonString(stored);
  const wasEncoded = decoded !== stored;
  const candidate =
    decoded && typeof decoded === "object" && !Array.isArray(decoded)
      ? // null-valued keys are read exactly like absent keys (`creator?.x || …`)
        Object.fromEntries(
          Object.entries(decoded as Record<string, unknown>).filter(
            ([, v]) => v !== null
          )
        )
      : decoded;

  const normalized = creatorSchema.safeParse(candidate);
  if (normalized.success) {
    return {
      classification: "normalizable",
      canonical: normalized.data,
      issues: describeIssues(current.error),
    };
  }

  if (wasEncoded || !creatorStructurallyValid(stored)) {
    return {
      classification: "invalid",
      issues: describeIssues(normalized.error),
    };
  }

  return {
    classification: "nonconforming",
    issues: describeIssues(normalized.error),
  };
}

/** Mirrors streamfi_jsonb_notifications_ok() for one element. */
function notificationStructurallyValid(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const el = value as Record<string, unknown>;
  const optionalString = (k: string) => !(k in el) || typeof el[k] === "string";
  return (
    typeof el.title === "string" &&
    typeof el.text === "string" &&
    (!("read" in el) || typeof el.read === "boolean") &&
    optionalString("id") &&
    optionalString("type") &&
    optionalString("created_at")
  );
}

export interface NotificationsClassification {
  classification: Classification;
  /** Indexes of elements that violate the database contract. */
  invalidIndexes: number[];
  issues: string[];
}

export function classifyNotifications(
  stored: unknown
): NotificationsClassification {
  if (isNullish(stored)) {
    return { classification: "valid", invalidIndexes: [], issues: [] };
  }
  if (!Array.isArray(stored)) {
    return {
      classification: "invalid",
      invalidIndexes: [],
      issues: [`(root): expected an array, got ${jsonType(stored)}`],
    };
  }

  const invalidIndexes: number[] = [];
  const issues: string[] = [];
  let legacy = 0;
  let nonconforming = 0;

  stored.forEach((element, index) => {
    if (notificationSchema.safeParse(element).success) {
      return;
    }
    if (legacyNotificationSchema.safeParse(element).success) {
      legacy++;
      return;
    }
    if (!notificationStructurallyValid(element)) {
      invalidIndexes.push(index);
      issues.push(`${index}: unsupported notification element`);
      return;
    }
    nonconforming++;
    const parsed = notificationSchema.safeParse(element);
    if (!parsed.success) {
      issues.push(...describeIssues(parsed.error).map(i => `${index}.${i}`));
    }
  });

  const classification: Classification = invalidIndexes.length
    ? "invalid"
    : nonconforming
      ? "nonconforming"
      : legacy
        ? "legacy"
        : "valid";
  if (legacy) {
    issues.push(`${legacy} legacy {title, text} element(s)`);
  }
  return { classification, invalidIndexes, issues };
}

function jsonType(value: unknown): string {
  if (value === null) {
    return "null";
  }
  return Array.isArray(value) ? "array" : typeof value;
}

function parseOrThrow<T>(
  schema: z.ZodType<T>,
  value: unknown,
  column: JsonbColumn
): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new JsonbContractError(column, describeIssues(result.error));
  }
  return result.data;
}
