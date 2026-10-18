/**
 * Orphaned Mux live-stream sweep (#758).
 *
 * createMuxStream aborts a Mux create call that exceeds its timeout, but Mux
 * may still have processed it. The caller never receives the stream id, so
 * nothing in the database references it and nothing else can find it. Every
 * stream the app creates carries a `passthrough` tag (MUX_CREATE_PASSTHROUGH_PREFIX);
 * this sweep lists Mux's live streams, and deletes the tagged ones that no
 * users.mux_stream_id points at.
 *
 * Safety rules:
 *  - only streams carrying our tag are ever considered;
 *  - a stream younger than ORPHAN_GRACE_MS is left alone: the create route
 *    saves the id right after Mux answers, so a fresh stream is normally just
 *    in flight, not orphaned;
 *  - nothing is deleted unless the full listing succeeded, and a stream that
 *    is currently `active` (someone is broadcasting to it) is reported, never
 *    deleted;
 *  - a failed or unknown check is never treated as "orphan".
 */
import { sql } from "@vercel/postgres";
import {
  MUX_CREATE_PASSTHROUGH_PREFIX,
  deleteMuxLiveStreamIfExists,
  listMuxLiveStreamsPage,
  type MuxLiveStreamSummary,
} from "@/lib/mux/server";
import type { JobMetrics, JobOutcome } from "@/lib/jobs/scheduled-job";

export interface OrphanSweepContext {
  deadlineExpired: () => boolean;
}

/** Longer than any create request plus the save that follows it. */
export const ORPHAN_GRACE_MS = 30 * 60 * 1000;

const PAGE_SIZE = 100;
const MAX_PAGES = 100;
const MAX_DELETES = 100;
const MAX_REPORTED_IDS = 20;

export interface OrphanSweepDetail {
  listing_error: string | null;
  orphan_ids: string[];
  delete_failed_ids: string[];
}

async function listTaggedStreams(ctx: OrphanSweepContext): Promise<{
  streams: MuxLiveStreamSummary[];
  scanned: number;
  complete: boolean;
  error: string | null;
}> {
  const streams: MuxLiveStreamSummary[] = [];
  let scanned = 0;
  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      if (ctx.deadlineExpired()) {
        return { streams, scanned, complete: false, error: null };
      }
      const items = await listMuxLiveStreamsPage(page, PAGE_SIZE);
      scanned += items.length;
      for (const item of items) {
        if (item.passthrough?.startsWith(MUX_CREATE_PASSTHROUGH_PREFIX)) {
          streams.push(item);
        }
      }
      if (items.length < PAGE_SIZE) {
        return { streams, scanned, complete: true, error: null };
      }
    }
    return { streams, scanned, complete: false, error: null };
  } catch (err) {
    return {
      streams,
      scanned,
      complete: false,
      error: err instanceof Error ? err.message.slice(0, 500) : String(err),
    };
  }
}

async function referencedIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) {
    return new Set();
  }
  const { rows } = await sql`
    SELECT mux_stream_id FROM users
    WHERE mux_stream_id IN (
      SELECT jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb)
    )
  `;
  return new Set(rows.map(r => r.mux_stream_id as string));
}

export async function runMuxOrphanSweep(
  ctx: OrphanSweepContext,
  now: () => number = Date.now
): Promise<JobOutcome<OrphanSweepDetail>> {
  const listing = await listTaggedStreams(ctx);
  const detail: OrphanSweepDetail = {
    listing_error: listing.error,
    orphan_ids: [],
    delete_failed_ids: [],
  };
  const metrics = {
    streams_scanned: listing.scanned,
    tagged_streams: listing.streams.length,
    listing_complete: Number(listing.complete),
    referenced: 0,
    too_recent: 0,
    orphans_found: 0,
    orphans_deleted: 0,
    skipped_active: 0,
    delete_failed: 0,
  };

  if (listing.complete) {
    const referenced = await referencedIds(listing.streams.map(s => s.id));
    const cutoff = now() - ORPHAN_GRACE_MS;

    for (const stream of listing.streams) {
      if (referenced.has(stream.id)) {
        metrics.referenced++;
        continue;
      }
      if (stream.createdAt.getTime() > cutoff) {
        metrics.too_recent++;
        continue;
      }
      metrics.orphans_found++;
      if (detail.orphan_ids.length < MAX_REPORTED_IDS) {
        detail.orphan_ids.push(stream.id);
      }
      if (stream.status === "active") {
        metrics.skipped_active++;
        continue;
      }
      if (metrics.orphans_deleted + metrics.delete_failed >= MAX_DELETES) {
        continue;
      }
      try {
        await deleteMuxLiveStreamIfExists(stream.id);
        metrics.orphans_deleted++;
      } catch {
        metrics.delete_failed++;
        if (detail.delete_failed_ids.length < MAX_REPORTED_IDS) {
          detail.delete_failed_ids.push(stream.id);
        }
      }
    }
  }

  const alerts: string[] = [];
  if (metrics.orphans_deleted > 0) {
    alerts.push(
      `${metrics.orphans_deleted} orphaned Mux live stream(s) deleted`
    );
  }
  if (metrics.skipped_active > 0) {
    alerts.push(
      `${metrics.skipped_active} orphaned Mux live stream(s) are active and were not deleted`
    );
  }
  const partial =
    !listing.complete ||
    metrics.delete_failed > 0 ||
    metrics.orphans_found >
      metrics.orphans_deleted + metrics.skipped_active + metrics.delete_failed;

  return {
    status: partial ? "partial" : "succeeded",
    metrics: metrics as JobMetrics,
    alerts,
    detail,
  };
}
