import { sql } from "@vercel/postgres";
import { invalidateTags } from "./index";
import { cacheTags } from "./tags";

export interface UserCacheRef {
  id?: string | null;
  username?: string | null;
  wallet?: string | null;
  /** Identifiers the row had before this write (handle or wallet changes). */
  previousUsername?: string | null;
  previousWallet?: string | null;
}

async function lookupIdentity(
  ref: UserCacheRef
): Promise<{ username: string | null; wallet: string | null } | undefined> {
  if (ref.id) {
    const { rows } = await sql`
      SELECT username, wallet FROM users WHERE id = ${ref.id} LIMIT 1
    `;
    return rows[0] as { username: string | null; wallet: string | null };
  }
  if (ref.wallet) {
    const { rows } = await sql`
      SELECT username, wallet FROM users WHERE wallet = ${ref.wallet} LIMIT 1
    `;
    return rows[0] as { username: string | null; wallet: string | null };
  }
  if (ref.username) {
    const { rows } = await sql`
      SELECT username, wallet FROM users
      WHERE LOWER(username) = ${ref.username.toLowerCase()} LIMIT 1
    `;
    return rows[0] as { username: string | null; wallet: string | null };
  }
  return undefined;
}

/**
 * Invalidates every cached read of one user row (profile, stats, profile
 * layouts). Callers pass whatever identifiers they already have; missing ones
 * are resolved from the row so a write keyed by wallet still clears entries
 * looked up by username. Never throws: a failed invalidation is bounded by the
 * policy TTL.
 */
export async function invalidateUserCaches(ref: UserCacheRef): Promise<void> {
  const usernames = [ref.username, ref.previousUsername];
  const wallets = [ref.wallet, ref.previousWallet];

  if (!ref.username || !ref.wallet) {
    try {
      const row = await lookupIdentity(ref);
      usernames.push(row?.username);
      wallets.push(row?.wallet);
    } catch (err) {
      console.error("[cache] user identity lookup failed:", err);
    }
  }

  const tags = [
    ...usernames.filter((u): u is string => !!u).map(cacheTags.userByName),
    ...wallets.filter((w): w is string => !!w).map(cacheTags.userByWallet),
  ];
  await invalidateTags(tags);
}

export async function invalidateCategoryCaches(): Promise<void> {
  await invalidateTags([cacheTags.categories()]);
}

/** A follow edge changes both users' follower/following counts. */
export async function invalidateFollowCaches(
  followerId: string,
  followeeId: string
): Promise<void> {
  await Promise.all([
    invalidateUserCaches({ id: followerId }),
    invalidateUserCaches({ id: followeeId }),
  ]);
}
