/**
 * Account deletion lifecycle (#1406). See docs/data-integrity.md.
 *
 *   request  -> users.deleted_at set (tombstone) + user_deletions row "pending"
 *   cancel   -> allowed while pending (or failed before any purge step ran)
 *   purge    -> after purge_after, unless on legal hold, and only once the
 *               user's custodial Stellar wallet (if any) holds no funds:
 *                 mux_assets -> mux_live_stream -> media -> database
 *               each step is idempotent and recorded in completed_steps; the
 *               database step is one transaction (streamfi_purge_user)
 *
 * Every state transition is a single conditional SQL statement, so cancel and
 * purge cannot both win, and two purge workers cannot claim the same user.
 */
import { sql } from "@vercel/postgres";
import { invalidateUserCaches } from "@/lib/cache/invalidation";
import {
  deleteMuxAssetIfExists,
  deleteMuxLiveStreamIfExists,
  disableMuxStream,
  enableMuxStream,
} from "@/lib/mux/server";
import { deleteImage, extractPublicIdFromUrl } from "@/utils/upload/cloudinary";
import { getAccountBalances } from "@/lib/stellar/horizon";
import { toStroops } from "@/lib/stellar/tip-reconciliation";

function errorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.length > 500 ? `${message.slice(0, 500)}…` : message;
}

export const PURGE_STEPS = [
  "mux_assets",
  "mux_live_stream",
  "media",
  "database",
] as const;
export type PurgeStep = (typeof PURGE_STEPS)[number];

/** Grace window between the request and the irreversible purge. */
export function deletionGraceDays(): number {
  const configured = Number(process.env.ACCOUNT_DELETION_GRACE_DAYS);
  return Number.isInteger(configured) && configured >= 1 ? configured : 30;
}

/** A purge attempt is abandoned after this many failures and needs an operator. */
export const MAX_PURGE_ATTEMPTS = 5;
const CLAIM_MINUTES = 15;

export interface DeletionRecord {
  id: string;
  user_id: string;
  status: "pending" | "cancelled" | "purging" | "failed" | "purged";
  requested_at: string;
  requested_by_type: "self" | "admin";
  purge_after: string;
  legal_hold: boolean;
  completed_steps: string[];
  attempts: number;
  last_error: string | null;
}

// ── request ──────────────────────────────────────────────────────────────────

export type RequestDeletionResult =
  | { outcome: "created"; deletion: DeletionRecord }
  | { outcome: "already_pending"; deletion: DeletionRecord }
  | { outcome: "not_found" };

export async function requestAccountDeletion(input: {
  userId: string;
  requestedByType: "self" | "admin";
  requestedBy: string;
  reason?: string | null;
}): Promise<RequestDeletionResult> {
  // One statement: the tombstone and the deletion row commit together. The
  // partial unique index uq_user_deletions_open makes a repeat request a no-op.
  const { rows } = await sql`
    WITH target AS (
      SELECT id FROM users
      WHERE id = ${input.userId} AND deleted_at IS NULL
      FOR UPDATE
    ),
    ins AS (
      INSERT INTO user_deletions (user_id, requested_by_type, requested_by, reason, purge_after)
      SELECT id, ${input.requestedByType}, ${input.requestedBy}, ${input.reason ?? null},
             now() + make_interval(days => ${deletionGraceDays()})
      FROM target
      ON CONFLICT DO NOTHING
      RETURNING *
    ),
    tomb AS (
      UPDATE users
      SET deleted_at = now(), is_live = false, current_viewers = 0, updated_at = now()
      WHERE id IN (SELECT user_id FROM ins)
      RETURNING id, mux_stream_id, username, wallet
    )
    SELECT ins.*, tomb.mux_stream_id, tomb.username AS user_username,
           tomb.wallet AS user_wallet
    FROM ins JOIN tomb ON tomb.id = ins.user_id
  `;

  if (rows.length === 1) {
    const {
      mux_stream_id: muxStreamId,
      user_username: username,
      user_wallet: wallet,
      ...deletion
    } = rows[0];
    await invalidateUserCaches({ id: input.userId, username, wallet });
    // Stop the tombstoned account from broadcasting. Best effort: the purge
    // deletes the live stream later regardless.
    if (muxStreamId) {
      await disableMuxStream(String(muxStreamId)).catch(err =>
        console.error(
          `[deletion] could not disable Mux stream for user ${input.userId}: ${errorMessage(err)}`
        )
      );
    }
    return { outcome: "created", deletion: deletion as DeletionRecord };
  }

  const open = await findOpenDeletion(input.userId);
  return open
    ? { outcome: "already_pending", deletion: open }
    : { outcome: "not_found" };
}

async function findOpenDeletion(
  userId: string
): Promise<DeletionRecord | null> {
  const { rows } = await sql`
    SELECT * FROM user_deletions
    WHERE user_id = ${userId} AND status IN ('pending', 'purging', 'failed')
    LIMIT 1
  `;
  return (rows[0] as DeletionRecord | undefined) ?? null;
}

// ── cancel ───────────────────────────────────────────────────────────────────

export type CancelDeletionResult =
  | { outcome: "cancelled" }
  | { outcome: "already_cancelled" }
  | { outcome: "purge_in_progress" }
  | { outcome: "already_purged" }
  | { outcome: "not_found" };

export async function cancelAccountDeletion(input: {
  userId: string;
  cancelledBy: string;
}): Promise<CancelDeletionResult> {
  // Only a deletion that no purge step has touched can be cancelled. A purge
  // worker claims rows by moving them to "purging" with the same kind of
  // conditional update, so exactly one of cancel/claim succeeds.
  const { rows } = await sql`
    WITH c AS (
      UPDATE user_deletions
      SET status = 'cancelled', cancelled_at = now(), cancelled_by = ${input.cancelledBy},
          claimed_until = NULL, updated_at = now()
      WHERE user_id = ${input.userId}
        AND status IN ('pending', 'failed')
        AND cardinality(completed_steps) = 0
      RETURNING user_id
    ),
    restored AS (
      UPDATE users SET deleted_at = NULL, updated_at = now()
      WHERE id IN (SELECT user_id FROM c)
      RETURNING id, mux_stream_id, username, wallet
    )
    SELECT id, mux_stream_id, username, wallet FROM restored
  `;

  if (rows.length === 1) {
    await invalidateUserCaches({
      id: input.userId,
      username: rows[0].username,
      wallet: rows[0].wallet,
    });
    if (rows[0].mux_stream_id) {
      await enableMuxStream(String(rows[0].mux_stream_id)).catch(err =>
        console.error(
          `[deletion] could not re-enable Mux stream for user ${input.userId}: ${errorMessage(err)}`
        )
      );
    }
    return { outcome: "cancelled" };
  }

  const { rows: latest } = await sql`
    SELECT status FROM user_deletions
    WHERE user_id = ${input.userId}
    ORDER BY requested_at DESC
    LIMIT 1
  `;
  const status = latest[0]?.status;
  if (status === "cancelled") {
    return { outcome: "already_cancelled" };
  }
  if (status === "purged") {
    return { outcome: "already_purged" };
  }
  if (status === "purging" || status === "failed") {
    return { outcome: "purge_in_progress" };
  }
  return { outcome: "not_found" };
}

// ── admin ────────────────────────────────────────────────────────────────────

export async function setLegalHold(input: {
  userId: string;
  hold: boolean;
  reason: string | null;
}): Promise<boolean> {
  const result = await sql`
    UPDATE user_deletions
    SET legal_hold = ${input.hold},
        legal_hold_reason = ${input.hold ? input.reason : null},
        updated_at = now()
    WHERE user_id = ${input.userId}
      AND status IN ('pending', 'purging', 'failed')
  `;
  return result.rowCount === 1;
}

/** Let an operator re-arm a purge that exhausted MAX_PURGE_ATTEMPTS. */
export async function resetPurgeAttempts(userId: string): Promise<boolean> {
  const result = await sql`
    UPDATE user_deletions
    SET attempts = 0, updated_at = now()
    WHERE user_id = ${userId} AND status = 'failed'
  `;
  return result.rowCount === 1;
}

export async function listDeletions(status: string | null, limit = 100) {
  const { rows } = await sql`
    SELECT d.id, d.user_id, d.status, d.requested_at, d.requested_by_type,
           d.requested_by, d.reason, d.purge_after, d.legal_hold,
           d.legal_hold_reason, d.cancelled_at, d.cancelled_by, d.attempts,
           d.completed_steps, d.last_error, d.purged_at, u.username
    FROM user_deletions d
    JOIN users u ON u.id = d.user_id
    WHERE (${status}::text IS NULL AND d.status IN ('pending', 'purging', 'failed'))
       OR d.status = ${status}
    ORDER BY d.purge_after ASC
    LIMIT ${limit}
  `;
  return rows;
}

// ── purge ────────────────────────────────────────────────────────────────────

export type PurgeMetrics = {
  claimed: number;
  purged: number;
  failed: number;
  released_for_legal_hold: number;
  skipped_deadline: number;
};

/** Claim up to `batchSize` due deletions for this worker. */
export async function claimDueDeletions(
  batchSize: number
): Promise<DeletionRecord[]> {
  const { rows } = await sql`
    UPDATE user_deletions
    SET status = 'purging',
        claimed_until = now() + make_interval(mins => ${CLAIM_MINUTES}),
        attempts = attempts + 1,
        updated_at = now()
    WHERE id IN (
      SELECT id FROM user_deletions
      WHERE purge_after <= now()
        AND legal_hold = false
        AND attempts < ${MAX_PURGE_ATTEMPTS}
        AND (status IN ('pending', 'failed')
             OR (status = 'purging' AND claimed_until < now()))
      ORDER BY purge_after
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    )
      AND legal_hold = false
      AND (status IN ('pending', 'failed')
           OR (status = 'purging' AND claimed_until < now()))
    RETURNING *
  `;
  return rows as DeletionRecord[];
}

export async function purgeDueDeletions(options: {
  batchSize: number;
  deadlineExpired: () => boolean;
}): Promise<PurgeMetrics> {
  const metrics: PurgeMetrics = {
    claimed: 0,
    purged: 0,
    failed: 0,
    released_for_legal_hold: 0,
    skipped_deadline: 0,
  };

  const claimed = await claimDueDeletions(options.batchSize);
  metrics.claimed = claimed.length;

  for (const deletion of claimed) {
    if (options.deadlineExpired()) {
      // Leave the claim to expire; the next run resumes from completed_steps.
      metrics.skipped_deadline++;
      continue;
    }
    const outcome = await purgeOne(deletion);
    if (outcome === "purged") {
      metrics.purged++;
    } else if (outcome === "legal_hold") {
      metrics.released_for_legal_hold++;
    } else {
      metrics.failed++;
    }
  }

  return metrics;
}

async function purgeOne(
  deletion: DeletionRecord
): Promise<"purged" | "failed" | "legal_hold"> {
  const done = new Set(deletion.completed_steps ?? []);
  try {
    // Checked on every attempt, before any irreversible step. Not recorded as
    // a completed step because it mutates nothing.
    await assertCustodialWalletEmpty(deletion.user_id);

    for (const step of PURGE_STEPS) {
      if (done.has(step)) {
        continue;
      }
      // A legal hold placed after the claim stops the purge before the next
      // irreversible step.
      if (await isOnLegalHold(deletion.id)) {
        await releaseClaim(deletion.id);
        return "legal_hold";
      }
      await runStep(step, deletion);
    }
    return "purged";
  } catch (err) {
    const message = errorMessage(err);
    console.error(
      `[purge] deletion ${deletion.id} failed (attempt ${deletion.attempts}): ${message}`
    );
    await sql`
      UPDATE user_deletions
      SET status = 'failed', last_error = ${message}, claimed_until = NULL, updated_at = now()
      WHERE id = ${deletion.id} AND status = 'purging'
    `;
    return "failed";
  }
}

/**
 * The purge scrubs users.encrypted_stellar_key. If that custodial wallet still
 * holds funds, destroying the key would destroy the funds, so the purge fails
 * (visible to admins, retried on the next run) until they are moved. Native
 * XLM up to PURGE_CUSTODIAL_MAX_XLM (default 2, covering the minimum reserve)
 * is tolerated; any other asset balance blocks.
 */
async function assertCustodialWalletEmpty(userId: string) {
  const { rows } = await sql`
    SELECT wallet, encrypted_stellar_key IS NOT NULL AS custodial
    FROM users WHERE id = ${userId}
  `;
  const wallet = rows[0]?.wallet;
  if (!rows[0]?.custodial || !/^G[A-Z2-7]{55}$/.test(String(wallet))) {
    return;
  }
  const balances = await getAccountBalances(String(wallet));
  if (!balances) {
    return;
  }
  const nativeLimit = toStroops(process.env.PURGE_CUSTODIAL_MAX_XLM ?? "2");
  const holdsFunds = balances.some(b =>
    b.assetType === "native"
      ? toStroops(b.balance) > nativeLimit
      : toStroops(b.balance) > toStroops("0")
  );
  if (holdsFunds) {
    throw new Error(
      "custodial wallet still holds funds; the user must export the key or move the funds before the purge can run"
    );
  }
}

async function isOnLegalHold(deletionId: string): Promise<boolean> {
  const { rows } = await sql`
    SELECT legal_hold FROM user_deletions WHERE id = ${deletionId}
  `;
  return rows[0]?.legal_hold === true;
}

async function releaseClaim(deletionId: string) {
  await sql`
    UPDATE user_deletions
    SET status = 'pending', claimed_until = NULL, updated_at = now()
    WHERE id = ${deletionId} AND status = 'purging'
  `;
}

async function markStepDone(deletionId: string, step: PurgeStep) {
  await sql`
    UPDATE user_deletions
    SET completed_steps = array_append(completed_steps, ${step}), updated_at = now()
    WHERE id = ${deletionId}
      AND status = 'purging'
      AND NOT (${step} = ANY(completed_steps))
  `;
}

async function runStep(step: PurgeStep, deletion: DeletionRecord) {
  switch (step) {
    case "mux_assets": {
      const { rows } = await sql`
        SELECT mux_asset_id FROM stream_recordings WHERE user_id = ${deletion.user_id}
        UNION
        SELECT mux_asset_id FROM stream_clips
        WHERE (streamer_id = ${deletion.user_id} OR clipped_by = ${deletion.user_id})
          AND mux_asset_id IS NOT NULL
      `;
      for (const row of rows) {
        await deleteMuxAssetIfExists(String(row.mux_asset_id));
      }
      await markStepDone(deletion.id, step);
      return;
    }
    case "mux_live_stream": {
      const { rows } = await sql`
        SELECT mux_stream_id FROM users WHERE id = ${deletion.user_id}
      `;
      if (rows[0]?.mux_stream_id) {
        await deleteMuxLiveStreamIfExists(String(rows[0].mux_stream_id));
      }
      await markStepDone(deletion.id, step);
      return;
    }
    case "media": {
      const { rows } = await sql`
        SELECT avatar, banner, creator->>'thumbnail' AS thumbnail
        FROM users WHERE id = ${deletion.user_id}
      `;
      for (const url of [
        rows[0]?.avatar,
        rows[0]?.banner,
        rows[0]?.thumbnail,
      ]) {
        const publicId = cloudinaryPublicId(url);
        if (publicId) {
          await deleteImage(publicId);
        }
      }
      await markStepDone(deletion.id, step);
      return;
    }
    case "database": {
      // Single transaction; also marks the deletion purged. Raises (and
      // changes nothing) on an unmapped foreign key or a legal hold.
      await sql`SELECT streamfi_purge_user(${deletion.id}::uuid)`;
      return;
    }
  }
}

/** Only images we uploaded to Cloudinary; preset avatar icons are shared assets. */
function cloudinaryPublicId(url: unknown): string | null {
  if (typeof url !== "string" || !url) {
    return null;
  }
  try {
    const host = new URL(url).hostname;
    if (
      host !== "res.cloudinary.com" &&
      !host.endsWith(".res.cloudinary.com")
    ) {
      return null;
    }
  } catch {
    return null;
  }
  return extractPublicIdFromUrl(url);
}
