/**
 * Mux asset <-> stream_recordings consistency sweep (#1409).
 * See docs/data-integrity.md for the drift model, grace periods and the
 * remediation lifecycle.
 *
 * Tables: stream_recordings (live recordings, written by the video.asset.ready
 * webhook) and stream_clips (rows with a mux_asset_id). A row and a Mux asset
 * correspond when <table>.mux_asset_id = asset.id. Playback IDs are carried
 * for investigation only — an asset can have several and they are not used for
 * matching.
 *
 * Safety rules:
 *  - "could not fetch" is never treated as "does not exist": an asset is only
 *    considered missing after a direct retrieve returns 404;
 *  - direction B (row without asset) only runs when the full asset listing
 *    succeeded;
 *  - nothing is deleted automatically. The only automatic action hides a
 *    recording (status = 'unavailable') after two 404 confirmations at least
 *    AUTO_HIDE_MIN_SPAN_MS apart; the row and an audit trail are preserved.
 */
import { sql } from "@vercel/postgres";
import {
  deleteMuxAssetIfExists,
  listMuxAssetsPage,
  retrieveMuxAsset,
  type MuxAssetSummary,
} from "@/lib/mux/server";
import { upsertRecordingFromAsset } from "@/lib/mux/recordings";
import { errorMessage } from "@/lib/jobs/runs";
import type { JobBodyResult, JobContext } from "@/lib/jobs/run-job";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Mux asset without a DB row: the row is written by the video.asset.ready
 * webhook. A live recording asset exists from the moment the stream starts
 * (up to Mux's 12 h maximum live duration) and Mux redelivers a failed
 * webhook for up to 24 h, so an asset younger than 12 h + 24 h may still get
 * its row legitimately.
 */
export const MUX_ORPHAN_GRACE_MS = 36 * HOUR_MS;
/**
 * DB row without a Mux asset: rows are only written after the asset is ready,
 * so there is no creation lag to wait out; the hour covers listing/API
 * eventual consistency around very recent writes.
 */
export const DB_ROW_GRACE_MS = 1 * HOUR_MS;
/** Two independent 404 confirmations this far apart before auto-hiding. */
export const AUTO_HIDE_MIN_SPAN_MS = 24 * HOUR_MS;
/** Mux timestamps are compared with the database clock; allow for skew. */
export const CLOCK_SKEW_MS = 5 * 60 * 1000;

const PAGE_SIZE = 100;
const MAX_PAGES = 200;
const DB_BATCH = 500;
/** Direct retrieve calls per run (confirmations), to respect Mux rate limits. */
const MAX_CONFIRMATIONS = 200;
const MAX_REPORTED_IDS = 20;

export type RowTable = "stream_recordings" | "stream_clips";
const ROW_TABLES: RowTable[] = ["stream_recordings", "stream_clips"];

export interface MuxSweepMetrics {
  mux_assets_listed: number;
  listing_complete: boolean;
  listing_error: string | null;
  db_rows_scanned: number;
  matched: number;
  recent_propagation: number;
  mux_asset_without_db_row: number;
  db_row_without_mux_asset: number;
  new_findings: number;
  auto_hidden: number;
  findings_resolved: number;
  check_failed: number;
  check_failed_asset_ids: string[];
  direction_b_skipped: boolean;
  confirmations_used: number;
}

function newMetrics(): MuxSweepMetrics {
  return {
    mux_assets_listed: 0,
    listing_complete: false,
    listing_error: null,
    db_rows_scanned: 0,
    matched: 0,
    recent_propagation: 0,
    mux_asset_without_db_row: 0,
    db_row_without_mux_asset: 0,
    new_findings: 0,
    auto_hidden: 0,
    findings_resolved: 0,
    check_failed: 0,
    check_failed_asset_ids: [],
    direction_b_skipped: false,
    confirmations_used: 0,
  };
}

function recordCheckFailed(metrics: MuxSweepMetrics, assetId: string) {
  metrics.check_failed++;
  if (metrics.check_failed_asset_ids.length < MAX_REPORTED_IDS) {
    metrics.check_failed_asset_ids.push(assetId);
  }
}

export async function runMuxReconciliation(
  ctx: JobContext
): Promise<JobBodyResult<MuxSweepMetrics>> {
  const metrics = newMetrics();
  const { rows: clock } = await sql`SELECT now() AS now`;
  const dbNow = new Date(clock[0].now).getTime();

  const assets = await listAllAssets(ctx, metrics);

  await reconcileMuxToDb(ctx, assets, dbNow, metrics);

  if (metrics.listing_complete && !ctx.deadlineExpired()) {
    await reconcileDbToMux(ctx, assets, dbNow, metrics);
  } else {
    metrics.direction_b_skipped = true;
  }

  const partial =
    !metrics.listing_complete ||
    metrics.direction_b_skipped ||
    metrics.check_failed > 0 ||
    ctx.deadlineExpired();
  return { status: partial ? "partial" : "completed", metrics };
}

async function listAllAssets(
  ctx: JobContext,
  metrics: MuxSweepMetrics
): Promise<Map<string, MuxAssetSummary>> {
  const assets = new Map<string, MuxAssetSummary>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    if (ctx.deadlineExpired()) {
      metrics.listing_error = "time budget exhausted while listing";
      return assets;
    }
    let batch: MuxAssetSummary[];
    try {
      batch = await listMuxAssetsPage(page, PAGE_SIZE);
    } catch (err) {
      // Includes rate limits / timeouts that survived the SDK's retries. The
      // listing is incomplete, so absence from it proves nothing.
      metrics.listing_error = errorMessage(err);
      return assets;
    }
    // Pages are newest-first; an asset created mid-listing can shift an item
    // onto the next page, so duplicates are expected and harmless.
    for (const asset of batch) {
      assets.set(asset.id, asset);
    }
    metrics.mux_assets_listed = assets.size;
    if (batch.length < PAGE_SIZE) {
      metrics.listing_complete = true;
      return assets;
    }
    if (page % 20 === 0) {
      await ctx.renewLease();
    }
  }
  metrics.listing_error = `stopped after ${MAX_PAGES} pages`;
  return assets;
}

// ── Direction A: Mux asset without a DB row ──────────────────────────────────

async function findRecordedAssetIds(ids: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (let i = 0; i < ids.length; i += DB_BATCH) {
    const chunk = ids.slice(i, i + DB_BATCH);
    const idList = JSON.stringify(chunk);
    const { rows } = await sql`
      SELECT mux_asset_id FROM stream_recordings
      WHERE mux_asset_id IN (SELECT jsonb_array_elements_text(${idList}::jsonb))
      UNION
      SELECT mux_asset_id FROM stream_clips
      WHERE mux_asset_id IN (SELECT jsonb_array_elements_text(${idList}::jsonb))
    `;
    rows.forEach(r => found.add(String(r.mux_asset_id)));
  }
  return found;
}

async function reconcileMuxToDb(
  ctx: JobContext,
  assets: Map<string, MuxAssetSummary>,
  dbNow: number,
  metrics: MuxSweepMetrics
) {
  const all = [...assets.values()];
  const recorded = await findRecordedAssetIds(all.map(a => a.id));
  metrics.matched += recorded.size;

  const eligibleBefore = dbNow - MUX_ORPHAN_GRACE_MS - CLOCK_SKEW_MS;
  const unmatched = all.filter(a => !recorded.has(a.id));
  const candidates: MuxAssetSummary[] = [];
  for (const asset of unmatched) {
    const settled =
      asset.createdAt.getTime() < eligibleBefore &&
      asset.status !== "preparing" &&
      !asset.isLive;
    if (settled) {
      candidates.push(asset);
    } else {
      metrics.recent_propagation++;
    }
  }

  // Re-check just before recording findings: a webhook may have written the
  // row while the listing was running.
  const lateArrivals = await findRecordedAssetIds(candidates.map(a => a.id));
  const orphans = candidates.filter(a => !lateArrivals.has(a.id));
  metrics.matched += lateArrivals.size;
  metrics.mux_asset_without_db_row = orphans.length;

  const owners = await resolveOwners(orphans);
  for (const asset of orphans) {
    const inserted = await upsertFinding({
      kind: "MUX_ASSET_WITHOUT_DB_ROW",
      runId: ctx.runId,
      muxAssetId: asset.id,
      rowTable: null,
      rowId: null,
      playbackId: asset.playbackId,
      userId: asset.liveStreamId
        ? (owners.get(asset.liveStreamId) ?? null)
        : null,
      liveStreamId: asset.liveStreamId,
      assetCreatedAt: asset.createdAt,
      previousStatus: null,
    });
    if (inserted) {
      metrics.new_findings++;
    }
  }

  // Close findings whose row has since appeared (e.g. webhook redelivered).
  const { rowCount } = await sql`
    UPDATE mux_drift_findings f
    SET status = 'resolved', resolved_at = now(), notes = 'database row now exists'
    WHERE f.kind = 'MUX_ASSET_WITHOUT_DB_ROW'
      AND f.status = 'open'
      AND (
        EXISTS (SELECT 1 FROM stream_recordings r WHERE r.mux_asset_id = f.mux_asset_id)
        OR EXISTS (SELECT 1 FROM stream_clips c WHERE c.mux_asset_id = f.mux_asset_id)
      )
  `;
  metrics.findings_resolved += rowCount ?? 0;

  // Close findings whose asset no longer exists in Mux (confirmed by 404).
  if (metrics.listing_complete) {
    const { rows: open } = await sql`
      SELECT id, mux_asset_id FROM mux_drift_findings
      WHERE kind = 'MUX_ASSET_WITHOUT_DB_ROW' AND status = 'open'
    `;
    for (const finding of open) {
      const assetId = String(finding.mux_asset_id);
      if (assets.has(assetId) || !canConfirm(metrics)) {
        continue;
      }
      const exists = await confirmAsset(assetId, metrics);
      if (exists === false) {
        const { rowCount: resolved } = await sql`
          UPDATE mux_drift_findings
          SET status = 'resolved', resolved_at = now(), notes = 'asset no longer exists in Mux'
          WHERE id = ${finding.id} AND status = 'open'
        `;
        metrics.findings_resolved += resolved ?? 0;
      }
    }
  }
}

async function resolveOwners(
  assets: MuxAssetSummary[]
): Promise<Map<string, string>> {
  const streamIds = [
    ...new Set(assets.map(a => a.liveStreamId).filter(Boolean)),
  ] as string[];
  const owners = new Map<string, string>();
  if (streamIds.length === 0) {
    return owners;
  }
  const { rows } = await sql`
    SELECT id, mux_stream_id FROM users
    WHERE mux_stream_id IN (
      SELECT jsonb_array_elements_text(${JSON.stringify(streamIds)}::jsonb)
    )
  `;
  rows.forEach(r => owners.set(String(r.mux_stream_id), String(r.id)));
  return owners;
}

// ── Direction B: DB row without a Mux asset ──────────────────────────────────

async function reconcileDbToMux(
  ctx: JobContext,
  assets: Map<string, MuxAssetSummary>,
  dbNow: number,
  metrics: MuxSweepMetrics
) {
  for (const table of ROW_TABLES) {
    await reconcileTable(table, ctx, assets, dbNow, metrics);
  }

  // Close findings whose asset reappeared or whose row is gone.
  const { rows: open } = await sql`
    SELECT f.id, f.mux_asset_id,
           CASE WHEN f.row_table = 'stream_clips'
                THEN NOT EXISTS (SELECT 1 FROM stream_clips c WHERE c.id = f.row_id)
                ELSE NOT EXISTS (SELECT 1 FROM stream_recordings r WHERE r.id = f.row_id)
           END AS row_gone
    FROM mux_drift_findings f
    WHERE f.kind = 'DB_ROW_WITHOUT_MUX_ASSET' AND f.status = 'open'
  `;
  for (const finding of open) {
    const note = finding.row_gone
      ? "database row no longer exists"
      : assets.has(String(finding.mux_asset_id))
        ? "asset exists in Mux again"
        : null;
    if (!note) {
      continue;
    }
    const { rowCount } = await sql`
      UPDATE mux_drift_findings
      SET status = 'resolved', resolved_at = now(), notes = ${note}
      WHERE id = ${finding.id} AND status = 'open'
    `;
    metrics.findings_resolved += rowCount ?? 0;
  }
}

/** One keyset page of rows that reference a Mux asset and are not hidden. */
async function scanRows(table: RowTable, cursor: string) {
  const { rows } =
    table === "stream_recordings"
      ? await sql`
          SELECT id, mux_asset_id, playback_id, user_id AS owner_id, status, created_at
          FROM stream_recordings
          WHERE id > ${cursor}::uuid AND status <> 'unavailable'
          ORDER BY id
          LIMIT ${DB_BATCH}
        `
      : await sql`
          SELECT id, mux_asset_id, playback_id, streamer_id AS owner_id, status, created_at
          FROM stream_clips
          WHERE id > ${cursor}::uuid
            AND mux_asset_id IS NOT NULL
            AND status <> 'unavailable'
          ORDER BY id
          LIMIT ${DB_BATCH}
        `;
  return rows;
}

async function reconcileTable(
  table: RowTable,
  ctx: JobContext,
  assets: Map<string, MuxAssetSummary>,
  dbNow: number,
  metrics: MuxSweepMetrics
) {
  const eligibleBefore = new Date(dbNow - DB_ROW_GRACE_MS);
  let cursor = "00000000-0000-0000-0000-000000000000";

  for (;;) {
    if (ctx.deadlineExpired()) {
      return;
    }
    const rows = await scanRows(table, cursor);
    if (rows.length === 0) {
      return;
    }
    cursor = String(rows[rows.length - 1].id);

    for (const row of rows) {
      metrics.db_rows_scanned++;
      const assetId = String(row.mux_asset_id);
      if (assets.has(assetId)) {
        continue;
      }
      if (new Date(row.created_at) > eligibleBefore) {
        metrics.recent_propagation++;
        continue;
      }
      if (!canConfirm(metrics)) {
        recordCheckFailed(metrics, assetId);
        continue;
      }
      const exists = await confirmAsset(assetId, metrics);
      if (exists !== false) {
        // true: listing raced with creation; null: check failed (recorded).
        continue;
      }
      metrics.db_row_without_mux_asset++;
      const inserted = await upsertFinding({
        kind: "DB_ROW_WITHOUT_MUX_ASSET",
        runId: ctx.runId,
        muxAssetId: assetId,
        rowTable: table,
        rowId: String(row.id),
        playbackId: row.playback_id ? String(row.playback_id) : null,
        userId: String(row.owner_id),
        liveStreamId: null,
        assetCreatedAt: null,
        previousStatus: String(row.status),
      });
      if (inserted) {
        metrics.new_findings++;
      }
      metrics.auto_hidden += await autoHideIfConfirmed(table, assetId, dbNow);
    }
    await ctx.renewLease();
  }
}

/**
 * Hide a row whose asset has been confirmed missing on two runs at least
 * AUTO_HIDE_MIN_SPAN_MS apart. Conditional on the row still pointing at the
 * same asset and not already hidden; the finding keeps previous_status so an
 * admin can restore it.
 */
async function autoHideIfConfirmed(
  table: RowTable,
  assetId: string,
  dbNow: number
): Promise<number> {
  const confirmedBefore = new Date(dbNow - AUTO_HIDE_MIN_SPAN_MS).toISOString();
  const { rows } =
    table === "stream_recordings"
      ? await sql`
          WITH finding AS (
            SELECT id, row_id FROM mux_drift_findings
            WHERE kind = 'DB_ROW_WITHOUT_MUX_ASSET'
              AND status = 'open'
              AND row_table = 'stream_recordings'
              AND mux_asset_id = ${assetId}
              AND detection_count >= 2
              AND first_detected_at <= ${confirmedBefore}::timestamptz
            FOR UPDATE
          ),
          hidden AS (
            UPDATE stream_recordings r
            SET status = 'unavailable', unavailable_at = now()
            FROM finding
            WHERE r.id = finding.row_id
              AND r.mux_asset_id = ${assetId}
              AND r.status <> 'unavailable'
            RETURNING finding.id AS finding_id
          )
          UPDATE mux_drift_findings f
          SET status = 'remediated', remediation_action = 'auto_marked_unavailable',
              remediated_at = now(), remediated_by = 'system'
          FROM hidden
          WHERE f.id = hidden.finding_id
          RETURNING f.id
        `
      : await sql`
          WITH finding AS (
            SELECT id, row_id FROM mux_drift_findings
            WHERE kind = 'DB_ROW_WITHOUT_MUX_ASSET'
              AND status = 'open'
              AND row_table = 'stream_clips'
              AND mux_asset_id = ${assetId}
              AND detection_count >= 2
              AND first_detected_at <= ${confirmedBefore}::timestamptz
            FOR UPDATE
          ),
          hidden AS (
            UPDATE stream_clips c
            SET status = 'unavailable', unavailable_at = now()
            FROM finding
            WHERE c.id = finding.row_id
              AND c.mux_asset_id = ${assetId}
              AND c.status <> 'unavailable'
            RETURNING finding.id AS finding_id
          )
          UPDATE mux_drift_findings f
          SET status = 'remediated', remediation_action = 'auto_marked_unavailable',
              remediated_at = now(), remediated_by = 'system'
          FROM hidden
          WHERE f.id = hidden.finding_id
          RETURNING f.id
        `;
  return rows.length;
}

/** Set a row's status (hide or restore), conditional on its current state. */
async function setRowStatus(
  table: RowTable,
  rowId: string,
  assetId: string,
  status: string,
  fromStatus: "visible" | "unavailable"
): Promise<number> {
  const unavailableAt =
    status === "unavailable" ? new Date().toISOString() : null;
  const hidden = fromStatus === "unavailable";
  const result =
    table === "stream_recordings"
      ? await sql`
          UPDATE stream_recordings
          SET status = ${status}, unavailable_at = ${unavailableAt}::timestamptz
          WHERE id = ${rowId}
            AND mux_asset_id = ${assetId}
            AND (status = 'unavailable') = ${hidden}
        `
      : await sql`
          UPDATE stream_clips
          SET status = ${status}, unavailable_at = ${unavailableAt}::timestamptz
          WHERE id = ${rowId}
            AND mux_asset_id = ${assetId}
            AND (status = 'unavailable') = ${hidden}
        `;
  return result.rowCount ?? 0;
}

// ── shared ───────────────────────────────────────────────────────────────────

function canConfirm(metrics: MuxSweepMetrics): boolean {
  return metrics.confirmations_used < MAX_CONFIRMATIONS;
}

/** true = exists, false = confirmed 404, null = could not check (recorded). */
async function confirmAsset(
  assetId: string,
  metrics: MuxSweepMetrics
): Promise<boolean | null> {
  metrics.confirmations_used++;
  try {
    return (await retrieveMuxAsset(assetId)) !== null;
  } catch {
    recordCheckFailed(metrics, assetId);
    return null;
  }
}

interface FindingInput {
  kind: "MUX_ASSET_WITHOUT_DB_ROW" | "DB_ROW_WITHOUT_MUX_ASSET";
  runId: string;
  muxAssetId: string;
  rowTable: RowTable | null;
  rowId: string | null;
  playbackId: string | null;
  userId: string | null;
  liveStreamId: string | null;
  assetCreatedAt: Date | null;
  previousStatus: string | null;
}

/** Idempotent per (kind, asset) while open; returns true for a new finding. */
async function upsertFinding(input: FindingInput): Promise<boolean> {
  const { rows } = await sql`
    INSERT INTO mux_drift_findings (
      kind, mux_asset_id, row_table, row_id, playback_id, user_id,
      mux_live_stream_id, asset_created_at, previous_status,
      first_detected_run_id, last_detected_run_id
    )
    VALUES (
      ${input.kind}, ${input.muxAssetId}, ${input.rowTable}, ${input.rowId}, ${input.playbackId},
      ${input.userId}, ${input.liveStreamId},
      ${input.assetCreatedAt ? input.assetCreatedAt.toISOString() : null},
      ${input.previousStatus}, ${input.runId}, ${input.runId}
    )
    ON CONFLICT (kind, mux_asset_id) WHERE status = 'open' DO UPDATE
      SET last_detected_run_id = EXCLUDED.last_detected_run_id,
          last_detected_at = now(),
          detection_count = mux_drift_findings.detection_count +
            CASE WHEN mux_drift_findings.last_detected_run_id = EXCLUDED.last_detected_run_id
                 THEN 0 ELSE 1 END
    RETURNING (xmax = 0) AS inserted
  `;
  return rows[0]?.inserted === true;
}

// ── admin ────────────────────────────────────────────────────────────────────

export type RemediationAction =
  | "dismiss"
  | "delete_mux_asset"
  | "adopt"
  | "mark_unavailable"
  | "restore";

export type RemediationResult =
  | { ok: true; action: RemediationAction }
  | { ok: false; status: 404 | 409 | 422; error: string };

export async function listFindings(status: string | null, limit = 200) {
  const { rows } = await sql`
    SELECT * FROM mux_drift_findings
    WHERE status = COALESCE(${status}, 'open')
    ORDER BY last_detected_at DESC
    LIMIT ${limit}
  `;
  return rows;
}

/**
 * Explicit admin remediation. Every action re-validates the current state
 * (finding still open, row/asset still in the expected state) immediately
 * before acting.
 */
export async function remediateFinding(
  findingId: string,
  action: RemediationAction,
  actor: string
): Promise<RemediationResult> {
  const { rows } = await sql`
    SELECT * FROM mux_drift_findings WHERE id = ${findingId}
  `;
  const finding = rows[0];
  if (!finding) {
    return { ok: false, status: 404, error: "Finding not found" };
  }

  const isOrphanAsset = finding.kind === "MUX_ASSET_WITHOUT_DB_ROW";
  const assetId = String(finding.mux_asset_id);

  if (action === "restore") {
    if (
      finding.kind !== "DB_ROW_WITHOUT_MUX_ASSET" ||
      finding.status !== "remediated"
    ) {
      return {
        ok: false,
        status: 409,
        error: "Only a hidden row can be restored",
      };
    }
    if (!(await retrieveMuxAsset(assetId))) {
      return {
        ok: false,
        status: 422,
        error: "The Mux asset still does not exist",
      };
    }
    const rowCount = await setRowStatus(
      finding.row_table as RowTable,
      String(finding.row_id),
      assetId,
      String(finding.previous_status ?? "ready"),
      "unavailable"
    );
    // Keep the original remediation_action for the audit trail.
    await sql`
      UPDATE mux_drift_findings
      SET status = 'resolved', resolved_at = now(),
          notes = ${`recording restored by ${actor}`}
      WHERE id = ${findingId} AND status = 'remediated'
    `;
    return rowCount === 1
      ? { ok: true, action }
      : { ok: false, status: 409, error: "Row is no longer hidden" };
  }

  if (finding.status !== "open") {
    return { ok: false, status: 409, error: `Finding is ${finding.status}` };
  }

  switch (action) {
    case "dismiss":
      await closeFinding(findingId, "dismissed", action, actor);
      return { ok: true, action };

    case "delete_mux_asset": {
      if (!isOrphanAsset) {
        return {
          ok: false,
          status: 409,
          error: "Only orphaned Mux assets can be deleted",
        };
      }
      const { rows: recorded } = await sql`
        SELECT 1 FROM stream_recordings WHERE mux_asset_id = ${assetId}
        UNION ALL
        SELECT 1 FROM stream_clips WHERE mux_asset_id = ${assetId}
      `;
      if (recorded.length > 0) {
        await closeFinding(findingId, "resolved", "none", actor);
        return {
          ok: false,
          status: 409,
          error: "A recording now references this asset; nothing deleted",
        };
      }
      await deleteMuxAssetIfExists(assetId);
      await closeFinding(findingId, "remediated", action, actor);
      return { ok: true, action };
    }

    case "adopt": {
      if (!isOrphanAsset) {
        return {
          ok: false,
          status: 409,
          error: "Only orphaned Mux assets can be adopted",
        };
      }
      const asset = await retrieveMuxAsset(assetId);
      if (!asset || asset.status !== "ready" || !asset.playbackId) {
        return {
          ok: false,
          status: 422,
          error: "Asset is missing, not ready or has no playback ID",
        };
      }
      const { rows: owner } = await sql`
        SELECT id FROM users
        WHERE mux_stream_id = ${asset.liveStreamId} AND deleted_at IS NULL
      `;
      if (!asset.liveStreamId || owner.length === 0) {
        return {
          ok: false,
          status: 422,
          error: "Asset does not belong to an active user's live stream",
        };
      }
      await upsertRecordingFromAsset({
        userId: String(owner[0].id),
        streamSessionId: null,
        assetId,
        playbackId: asset.playbackId,
        title: "Stream Recording",
        duration: null,
      });
      await closeFinding(findingId, "remediated", action, actor);
      return { ok: true, action };
    }

    case "mark_unavailable": {
      if (isOrphanAsset) {
        return {
          ok: false,
          status: 409,
          error: "Only database rows can be marked unavailable",
        };
      }
      if (await retrieveMuxAsset(assetId)) {
        await closeFinding(findingId, "resolved", "none", actor);
        return {
          ok: false,
          status: 409,
          error: "The Mux asset exists; row left visible",
        };
      }
      await setRowStatus(
        finding.row_table as RowTable,
        String(finding.row_id),
        assetId,
        "unavailable",
        "visible"
      );
      await closeFinding(findingId, "remediated", action, actor);
      return { ok: true, action };
    }
  }
}

async function closeFinding(
  findingId: string,
  status: "resolved" | "remediated" | "dismissed",
  action: string,
  actor: string
) {
  await sql`
    UPDATE mux_drift_findings
    SET status = ${status},
        remediation_action = ${action},
        remediated_by = ${actor},
        remediated_at = now(),
        resolved_at = CASE WHEN ${status} = 'resolved' THEN now() ELSE resolved_at END
    WHERE id = ${findingId} AND status = 'open'
  `;
}
