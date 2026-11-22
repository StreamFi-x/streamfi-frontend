import { sql } from "@vercel/postgres";

export const DEFAULT_USERNAME_COOLDOWN_DAYS = 30;
export const DEFAULT_USERNAME_REDIRECT_TTL_DAYS = 90;
export const DEFAULT_USERNAME_HOLD_DAYS = 30;
export const DEFAULT_OWNERSHIP_WARNING_DAYS = 90;

export function getUsernameCooldownDays(): number {
  const raw = Number(process.env.USERNAME_CHANGE_COOLDOWN_DAYS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_USERNAME_COOLDOWN_DAYS;
}

export function getUsernameRedirectTtlDays(): number {
  const raw = Number(process.env.USERNAME_REDIRECT_TTL_DAYS);
  return Number.isFinite(raw) && raw > 0
    ? raw
    : DEFAULT_USERNAME_REDIRECT_TTL_DAYS;
}

export function getUsernameHoldDays(): number {
  const raw = Number(process.env.USERNAME_REREGISTRATION_HOLD_DAYS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_USERNAME_HOLD_DAYS;
}

export function getOwnershipWarningDays(): number {
  const raw = Number(process.env.USERNAME_OWNERSHIP_WARNING_DAYS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_OWNERSHIP_WARNING_DAYS;
}

export interface CooldownCheckResult {
  allowed: boolean;
  lastChangedAt: string | null;
  nextAllowedAt: string | null;
  retryAfterSeconds: number;
  remainingDays: number;
}

/**
 * Checks whether a user is allowed to change their username right now or is
 * still within the cooldown window since their previous username change (#1730).
 */
export async function checkUsernameChangeCooldown(input: {
  userId: string;
  lastChangedAt?: string | Date | null;
  now?: Date;
}): Promise<CooldownCheckResult> {
  const now = input.now ?? new Date();
  const cooldownDays = getUsernameCooldownDays();
  const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;

  let changedAtDate: Date | null = null;

  if (input.lastChangedAt) {
    const parsed = new Date(input.lastChangedAt);
    if (!Number.isNaN(parsed.getTime())) {
      changedAtDate = parsed;
    }
  }

  if (!changedAtDate) {
    try {
      const { rows } = await sql`
        SELECT changed_at
        FROM username_history
        WHERE user_id = ${input.userId}
        ORDER BY changed_at DESC
        LIMIT 1
      `;
      if (rows[0]?.changed_at) {
        const parsed = new Date(rows[0].changed_at);
        if (!Number.isNaN(parsed.getTime())) {
          changedAtDate = parsed;
        }
      }
    } catch {
      // Fallback if table does not exist yet in test/legacy environments
    }
  }

  if (!changedAtDate) {
    return {
      allowed: true,
      lastChangedAt: null,
      nextAllowedAt: null,
      retryAfterSeconds: 0,
      remainingDays: 0,
    };
  }

  const nextAllowedMs = changedAtDate.getTime() + cooldownMs;
  const remainingMs = nextAllowedMs - now.getTime();

  if (remainingMs <= 0) {
    return {
      allowed: true,
      lastChangedAt: changedAtDate.toISOString(),
      nextAllowedAt: null,
      retryAfterSeconds: 0,
      remainingDays: 0,
    };
  }

  const retryAfterSeconds = Math.ceil(remainingMs / 1000);
  const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));

  return {
    allowed: false,
    lastChangedAt: changedAtDate.toISOString(),
    nextAllowedAt: new Date(nextAllowedMs).toISOString(),
    retryAfterSeconds,
    remainingDays,
  };
}

export interface ReleaseHoldCheckResult {
  held: boolean;
  previousOwnerId: string | null;
  releasedAt: string | null;
  availableAt: string | null;
  retryAfterSeconds: number;
}

/**
 * Checks whether a username that was recently released by another account is
 * still under its re-registration cooldown hold (#1734).
 */
export async function checkUsernameReleaseHold(input: {
  username: string;
  requestingUserId?: string | null;
  now?: Date;
}): Promise<ReleaseHoldCheckResult> {
  const normalized = input.username.trim().toLowerCase();
  const now = input.now ?? new Date();
  const holdDays = getUsernameHoldDays();
  const holdMs = holdDays * 24 * 60 * 60 * 1000;

  try {
    const { rows } = await sql`
      SELECT user_id, changed_at, hold_until
      FROM username_history
      WHERE LOWER(previous_username) = ${normalized}
      ORDER BY changed_at DESC
      LIMIT 1
    `;

    const latest = rows[0];
    if (!latest) {
      return {
        held: false,
        previousOwnerId: null,
        releasedAt: null,
        availableAt: null,
        retryAfterSeconds: 0,
      };
    }

    const previousOwnerId = String(latest.user_id);
    const releasedAtDate = new Date(latest.changed_at);
    const holdUntilDate = latest.hold_until
      ? new Date(latest.hold_until)
      : new Date(releasedAtDate.getTime() + holdMs);

    // The original owner may reclaim their own previous handle (subject to their own change cooldown)
    if (input.requestingUserId && previousOwnerId === input.requestingUserId) {
      return {
        held: false,
        previousOwnerId,
        releasedAt: releasedAtDate.toISOString(),
        availableAt: null,
        retryAfterSeconds: 0,
      };
    }

    const remainingMs = holdUntilDate.getTime() - now.getTime();
    if (remainingMs > 0) {
      return {
        held: true,
        previousOwnerId,
        releasedAt: releasedAtDate.toISOString(),
        availableAt: holdUntilDate.toISOString(),
        retryAfterSeconds: Math.ceil(remainingMs / 1000),
      };
    }

    return {
      held: false,
      previousOwnerId,
      releasedAt: releasedAtDate.toISOString(),
      availableAt: null,
      retryAfterSeconds: 0,
    };
  } catch {
    return {
      held: false,
      previousOwnerId: null,
      releasedAt: null,
      availableAt: null,
      retryAfterSeconds: 0,
    };
  }
}

/**
 * Records a username change in `username_history` (#1730, #1734).
 */
export async function recordUsernameChange(input: {
  userId: string;
  previousUsername: string;
  newUsername: string;
  now?: Date;
}): Promise<void> {
  const prev = input.previousUsername.trim().toLowerCase();
  const next = input.newUsername.trim().toLowerCase();
  if (!prev || !next || prev === next) {
    return;
  }

  const now = input.now ?? new Date();
  const redirectUntil = new Date(
    now.getTime() + getUsernameRedirectTtlDays() * 24 * 60 * 60 * 1000
  );
  const holdUntil = new Date(
    now.getTime() + getUsernameHoldDays() * 24 * 60 * 60 * 1000
  );

  await sql`
    INSERT INTO username_history (
      user_id,
      previous_username,
      new_username,
      changed_at,
      redirect_until,
      hold_until
    )
    VALUES (
      ${input.userId},
      ${prev},
      ${next},
      ${now.toISOString()},
      ${redirectUntil.toISOString()},
      ${holdUntil.toISOString()}
    )
  `;

  try {
    await sql`
      UPDATE users
      SET username_changed_at = ${now.toISOString()}
      WHERE id = ${input.userId} AND deleted_at IS NULL
    `;
  } catch {
    // Column may not be mocked in standalone unit tests
  }
}

export interface UsernameRedirectResolution {
  shouldRedirect: boolean;
  targetUsername: string | null;
  previousUsername: string | null;
  changedAt: string | null;
  redirectUntil: string | null;
}

/**
 * Resolves a redirect target when a lookup for a current username fails (#1730).
 * Looks up `username_history` for the handle and resolves to the creator's
 * current active username if the redirect window has not expired.
 */
export async function resolveUsernameRedirect(
  requestedUsername: string,
  now: Date = new Date()
): Promise<UsernameRedirectResolution> {
  const normalized = requestedUsername.trim().toLowerCase();
  if (!normalized) {
    return {
      shouldRedirect: false,
      targetUsername: null,
      previousUsername: null,
      changedAt: null,
      redirectUntil: null,
    };
  }

  try {
    const { rows } = await sql`
      SELECT
        h.previous_username,
        h.new_username,
        h.user_id,
        h.changed_at,
        h.redirect_until,
        u.username AS current_username,
        u.deleted_at
      FROM username_history h
      JOIN users u ON u.id = h.user_id AND u.deleted_at IS NULL
      WHERE LOWER(h.previous_username) = ${normalized}
      ORDER BY h.changed_at DESC
      LIMIT 1
    `;

    const row = rows[0];
    if (!row || row.deleted_at) {
      return {
        shouldRedirect: false,
        targetUsername: null,
        previousUsername: null,
        changedAt: null,
        redirectUntil: null,
      };
    }

    const redirectUntilDate = row.redirect_until
      ? new Date(row.redirect_until)
      : new Date(
          new Date(row.changed_at).getTime() +
            getUsernameRedirectTtlDays() * 24 * 60 * 60 * 1000
        );

    if (redirectUntilDate.getTime() <= now.getTime()) {
      return {
        shouldRedirect: false,
        targetUsername: null,
        previousUsername: String(row.previous_username),
        changedAt: new Date(row.changed_at).toISOString(),
        redirectUntil: redirectUntilDate.toISOString(),
      };
    }

    const targetUsername = String(
      row.current_username || row.new_username || ""
    ).trim();

    if (!targetUsername || targetUsername.toLowerCase() === normalized) {
      return {
        shouldRedirect: false,
        targetUsername: null,
        previousUsername: String(row.previous_username),
        changedAt: new Date(row.changed_at).toISOString(),
        redirectUntil: redirectUntilDate.toISOString(),
      };
    }

    return {
      shouldRedirect: true,
      targetUsername,
      previousUsername: String(row.previous_username),
      changedAt: new Date(row.changed_at).toISOString(),
      redirectUntil: redirectUntilDate.toISOString(),
    };
  } catch {
    return {
      shouldRedirect: false,
      targetUsername: null,
      previousUsername: null,
      changedAt: null,
      redirectUntil: null,
    };
  }
}

export interface UsernameOwnershipWarning {
  hasRecentOwnershipChange: boolean;
  previousOwnerId: string | null;
  previousOwnerReleasedAt: string | null;
  notice: string | null;
}

/**
 * Checks if a username currently owned by `currentUserId` was previously
 * owned and released by a DIFFERENT account within the warning window (#1734).
 * Used to warn visitors following old bookmarked stream/profile links that
 * the handle now belongs to a different channel.
 */
export async function getUsernameOwnershipWarning(input: {
  username: string;
  currentUserId: string;
  now?: Date;
}): Promise<UsernameOwnershipWarning> {
  const normalized = input.username.trim().toLowerCase();
  const now = input.now ?? new Date();
  const warningWindowMs = getOwnershipWarningDays() * 24 * 60 * 60 * 1000;

  try {
    const { rows } = await sql`
      SELECT user_id, changed_at
      FROM username_history
      WHERE LOWER(previous_username) = ${normalized}
        AND user_id != ${input.currentUserId}
      ORDER BY changed_at DESC
      LIMIT 1
    `;

    const latest = rows[0];
    if (!latest) {
      return {
        hasRecentOwnershipChange: false,
        previousOwnerId: null,
        previousOwnerReleasedAt: null,
        notice: null,
      };
    }

    const releasedAt = new Date(latest.changed_at);
    if (now.getTime() - releasedAt.getTime() > warningWindowMs) {
      return {
        hasRecentOwnershipChange: false,
        previousOwnerId: String(latest.user_id),
        previousOwnerReleasedAt: releasedAt.toISOString(),
        notice: null,
      };
    }

    return {
      hasRecentOwnershipChange: true,
      previousOwnerId: String(latest.user_id),
      previousOwnerReleasedAt: releasedAt.toISOString(),
      notice: `This username (@${normalized}) was recently released by a previous creator and registered by a new account. If you followed an old bookmarked link, this is not the same channel as before.`,
    };
  } catch {
    return {
      hasRecentOwnershipChange: false,
      previousOwnerId: null,
      previousOwnerReleasedAt: null,
      notice: null,
    };
  }
}
