// lib/users/profile-partial-update.ts
/**
 * Utilities for handling partial updates of a user profile.
 * Implements normalization of social links, diff generation, and conflict detection.
 */

export interface ProfileSnapshot {
  username: string;
  bio: string;
  socialLinks: Record<string, string>;
  avatar?: string | File | null;
  banner?: string | File | null;
  updatedAt?: string | null;
}

/**
 * Normalizes various input shapes into a Record<string, string> of social links.
 * Accepts:
 *   - null / undefined → empty object
 *   - JSON string representing either an object or an array of link objects
 *   - Array of objects with { platform, socialLink? , url? }
 *   - Plain object mapping platform to link string
 */
export function normalizeSocialLinksRecord(input: unknown): Record<string, string> {
  const result: Record<string, string> = {};

  if (input == null) {
    return result;
  }

  // If it's already a plain object
  if (typeof input === "object" && !Array.isArray(input)) {
    // Treat as Record<string, unknown>
    const obj = input as Record<string, unknown>;
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        result[key] = value;
      } else if (value != null) {
        result[key] = String(value);
      }
    }
    return result;
  }

  // If it's a JSON string, attempt to parse it
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      return normalizeSocialLinksRecord(parsed);
    } catch {
      // Not JSON – treat as empty
      return result;
    }
  }

  // If it's an array of link objects
  if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item !== "object" || item == null) continue;
      const platform = (item as any).platform;
      const link = (item as any).socialLink ?? (item as any).url;
      if (typeof platform === "string" && typeof link === "string") {
        result[platform] = link;
      }
    }
    return result;
  }

  // Fallback – return empty record
  return result;
}

/**
 * Computes a minimal patch between an initial and a current profile snapshot.
 * Returns the patch object containing only changed fields, a map of base values,
 * a list of changed field names, and a flag indicating whether any changes exist.
 */
export function computeProfilePatch(
  initial: ProfileSnapshot,
  current: ProfileSnapshot,
): {
  patch: Partial<{
    username: string;
    bio: string;
    socialLinks: Record<string, string>;
    avatar: string | File;
    banner: File;
  }>;
  baseValues: Record<string, unknown>;
  changedFields: string[];
  hasChanges: boolean;
} {
  const patch: any = {};
  const changedFields: string[] = [];
  const baseValues: Record<string, unknown> = {};

  // Helper to compare values (deep for objects/records)
  const isEqual = (a: unknown, b: unknown): boolean => {
    if (a === b) return true;
    // Compare objects via JSON stringification (good enough for our simple structures)
    if (typeof a === "object" && typeof b === "object" && a != null && b != null) {
      try {
        return JSON.stringify(a) === JSON.stringify(b);
      } catch {
        return false;
      }
    }
    return false;
  };

  // username
  baseValues.username = initial.username;
  if (!isEqual(initial.username, current.username)) {
    patch.username = current.username;
    changedFields.push("username");
  }

  // bio (allow empty string as a valid change)
  baseValues.bio = initial.bio;
  if (!isEqual(initial.bio, current.bio)) {
    patch.bio = current.bio;
    changedFields.push("bio");
  }

  // socialLinks – normalize both sides before comparison
  const initLinks = normalizeSocialLinksRecord(initial.socialLinks);
  const currLinks = normalizeSocialLinksRecord(current.socialLinks);
  baseValues.socialLinks = initLinks;
  if (!isEqual(initLinks, currLinks)) {
    patch.socialLinks = currLinks;
    changedFields.push("socialLinks");
  }

  // avatar – treat undefined/null as equivalent
  baseValues.avatar = initial.avatar ?? null;
  if (!isEqual(initial.avatar ?? null, current.avatar ?? null)) {
    // If current.avatar is a File, we keep it as-is; if it's a string we keep string.
    if (current.avatar != null) {
      patch.avatar = current.avatar as string | File;
    }
    changedFields.push("avatar");
  }

  // banner – same logic as avatar
  baseValues.banner = initial.banner ?? null;
  if (!isEqual(initial.banner ?? null, current.banner ?? null)) {
    if (current.banner != null) {
      patch.banner = current.banner as File;
    }
    changedFields.push("banner");
  }

  const hasChanges = changedFields.length > 0;
  return { patch, baseValues, changedFields, hasChanges };
}

/**
 * Detects conflicting field updates based on server state.
 * Returns an array of field names that are in conflict.
 */
export function detectFieldConflicts(params: {
  serverRow: Record<string, unknown>;
  incomingFields: string[];
  expectedUpdatedAt?: string | null;
  baseValues?: Record<string, unknown> | null;
}): string[] {
  const { serverRow, incomingFields, expectedUpdatedAt, baseValues } = params;

  // If caller does not provide an expected timestamp, we assume no conflict.
  if (expectedUpdatedAt == null) {
    return [];
  }

  const serverUpdatedRaw = serverRow["updated_at"] ?? serverRow["updatedAt"];
  if (typeof serverUpdatedRaw !== "string") {
    // If server does not expose a parsable timestamp, be conservative and signal conflict.
    return incomingFields;
  }

  const normalize = (s: string) => {
    try {
      return new Date(s).toISOString();
    } catch {
      return s;
    }
  };

  const expectedNorm = normalize(expectedUpdatedAt);
  const serverNorm = normalize(serverUpdatedRaw as string);

  // If timestamps match, no conflict.
  if (expectedNorm === serverNorm) {
    return [];
  }

  // Timestamps differ – need to compare values.
  if (!baseValues) {
    // Without a baseline, we cannot decide; treat all incoming fields as conflicted.
    return incomingFields;
  }

  const conflicts: string[] = [];
  const isEqual = (a: unknown, b: unknown): boolean => {
    if (a === b) return true;
    if (typeof a === "object" && typeof b === "object" && a != null && b != null) {
      try {
        return JSON.stringify(a) === JSON.stringify(b);
      } catch {
        return false;
      }
    }
    return false;
  };

  for (const field of incomingFields) {
    const serverVal = serverRow[field];
    const baseVal = baseValues[field];
    if (!isEqual(serverVal, baseVal)) {
      conflicts.push(field);
    }
  }

  return conflicts;
}
