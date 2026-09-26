/**
 * Report-brigading resistance (#1447).
 *
 * A "report a stream" feature is a two-sided trust problem: too permissive
 * and it's weaponizable (a coordinated group brigades a legitimate
 * creator's stream to trigger a takedown); too restrictive and real harm
 * goes unreported. Per-account rate limiting alone does not solve this: a
 * brigade is many distinct accounts, each individually under any reasonable
 * per-account limit.
 *
 * This module never auto-actions anything. Every signal below only ever
 * raises `priority` to `expedited` (routing a report to the front of the
 * admin review queue) or attaches an audit trail row explaining why; a
 * human always makes the actual moderation decision. Volume alone can never
 * single-handedly take a stream down.
 *
 * Signals, in the order they're checked:
 *
 * 1. Duplicate-of-recent: many genuine viewers reporting the exact same
 *    real incident (same stream, same reason, within a short window)
 *    should not each inflate severity as if they were N independent
 *    signals; the *first* report of a cluster is escalated (so a human
 *    still sees it promptly) and later ones in the same cluster are tagged
 *    but not separately escalated on volume alone.
 * 2. Volume spike: this stream's report rate in a short window compared to
 *    its own historical baseline (not a global constant — a small
 *    channel's normal report rate is not a large channel's).
 * 3. Coordinated / low-legitimacy accounts: for the *authenticated*
 *    reporters in the current window (anonymous reports carry no identity
 *    to correlate and are excluded from this check entirely), how many are
 *    newly created, have no other platform activity, or are connected to
 *    each other (mutual follow, shared recent chat) — reused, not
 *    reintroduced. A brigade recruiting sockpuppets or coordinating over
 *    chat/DMs leaves exactly this kind of graph signal even though each
 *    account is individually unremarkable.
 */
import { defaultExecutor, SqlExecutor } from "@/lib/db/executor";

export type ReportPriority = "normal" | "expedited";

export type ReportFlagSignal =
  | "volume_spike"
  | "new_account"
  | "no_platform_activity"
  | "coordinated_accounts"
  | "duplicate_of_recent";

export interface ReportFlag {
  signal: ReportFlagSignal;
  detail: Record<string, unknown>;
}

export interface AssessReportAbuseOptions {
  streamId: string;
  reason: string;
  /** Authenticated reporter's user id; null for an anonymous report. */
  reporterUserId: string | null;
  executor?: SqlExecutor;
  now?: () => Date;
  /** Reports on the same stream within this window feed the spike/duplicate checks. */
  recentWindowMinutes?: number;
  /** A stream's own trailing baseline, for the volume-spike comparison. */
  baselineWindowHours?: number;
  /** At least this many recent reports before a spike can even fire (a lightly-reported stream's ratio is too noisy to trust). */
  spikeMinRecentReports?: number;
  /** Recent rate must be at least this multiple of the baseline rate to flag. */
  spikeRatioThreshold?: number;
  /** An account created within this window counts as "newly created". */
  newAccountWindowHours?: number;
  /** Same (stream, reason) from a different reporter within this window counts as a duplicate cluster. */
  duplicateWindowMinutes?: number;
}

export interface AssessReportAbuseResult {
  priority: ReportPriority;
  flags: ReportFlag[];
}

interface AccountSignalRow {
  id: string;
  created_at: string;
  has_activity: boolean;
}

async function coordinationSignals(
  executor: SqlExecutor,
  reporterUserId: string,
  recentReporterIds: string[],
  newAccountWindowHours: number
): Promise<ReportFlag[]> {
  const flags: ReportFlag[] = [];

  const { rows } = await executor(
    `SELECT
       u.id,
       u.created_at::text AS created_at,
       EXISTS(
         SELECT 1 FROM chat_messages cm WHERE cm.user_id = u.id
         UNION ALL
         SELECT 1 FROM stream_viewers sv WHERE sv.user_id = u.id
         UNION ALL
         SELECT 1 FROM user_follows uf WHERE uf.follower_id = u.id
       ) AS has_activity
     FROM users u
     WHERE u.id = $1`,
    [reporterUserId]
  );
  const account = rows[0] as AccountSignalRow | undefined;
  if (!account) {
    return flags;
  }

  const ageHours =
    (Date.now() - new Date(account.created_at).getTime()) / 3_600_000;
  if (ageHours < newAccountWindowHours) {
    flags.push({
      signal: "new_account",
      detail: { accountAgeHours: Math.round(ageHours) },
    });
  }
  if (!account.has_activity) {
    flags.push({ signal: "no_platform_activity", detail: {} });
  }

  // Coordination: does this reporter share a mutual follow or recent chat
  // co-presence with another reporter already in this window? Checked
  // against the other authenticated reporters seen so far for this stream
  // in the current window, not the whole user base — this is specifically
  // "did these particular reporters coordinate," not a general popularity
  // signal (a well-followed account reporting is not itself suspicious).
  const others = recentReporterIds.filter(id => id !== reporterUserId);
  if (others.length > 0) {
    const { rows: overlapRows } = await executor(
      `SELECT
         EXISTS(
           SELECT 1 FROM user_follows uf
            WHERE (uf.follower_id = $1 AND uf.followee_id = ANY($2::uuid[]))
               OR (uf.followee_id = $1 AND uf.follower_id = ANY($2::uuid[]))
         ) AS mutual_follow,
         EXISTS(
           SELECT 1
             FROM chat_messages cm1
             JOIN chat_messages cm2
               ON cm1.stream_session_id = cm2.stream_session_id
              AND cm2.user_id = ANY($2::uuid[])
              AND cm2.user_id <> $1
              AND ABS(EXTRACT(EPOCH FROM (cm1.created_at - cm2.created_at))) < 300
            WHERE cm1.user_id = $1
         ) AS shared_chat_presence`,
      [reporterUserId, others]
    );
    const overlap = overlapRows[0];
    if (overlap?.mutual_follow || overlap?.shared_chat_presence) {
      flags.push({
        signal: "coordinated_accounts",
        detail: {
          mutualFollow: !!overlap.mutual_follow,
          sharedChatPresence: !!overlap.shared_chat_presence,
          comparedAgainst: others.length,
        },
      });
    }
  }

  return flags;
}

export async function assessReportAbuse(
  options: AssessReportAbuseOptions
): Promise<AssessReportAbuseResult> {
  const executor = options.executor ?? defaultExecutor;
  const recentWindowMinutes = options.recentWindowMinutes ?? 30;
  const baselineWindowHours = options.baselineWindowHours ?? 24 * 7;
  const spikeMinRecentReports = options.spikeMinRecentReports ?? 5;
  const spikeRatioThreshold = options.spikeRatioThreshold ?? 5;
  const newAccountWindowHours = options.newAccountWindowHours ?? 24;
  const duplicateWindowMinutes = options.duplicateWindowMinutes ?? 15;

  const flags: ReportFlag[] = [];

  // ── Duplicate-of-recent ────────────────────────────────────────────────
  // Is there already a report for this exact (stream, reason) in the last
  // duplicateWindowMinutes, AND has one of them already been escalated? If
  // so, this report is part of an already-surfaced cluster: a human is
  // already looking at it, so this one is tagged for audit but does not
  // itself need to re-trigger expedited review. This is deliberately
  // narrower than "any duplicate exists" — the report that actually crosses
  // the volume-spike threshold must still escalate even though, by
  // definition, identical-reason reports already precede it in the window.
  const { rows: duplicateRows } = await executor(
    `SELECT
       COUNT(*)::int AS count,
       COUNT(*) FILTER (WHERE priority = 'expedited')::int AS already_escalated
       FROM stream_reports
      WHERE stream_id = $1
        AND reason = $2
        AND created_at > NOW() - make_interval(mins => $3::int)`,
    [options.streamId, options.reason, duplicateWindowMinutes]
  );
  const isDuplicateOfRecent = (duplicateRows[0]?.count ?? 0) > 0;
  const clusterAlreadyEscalated =
    (duplicateRows[0]?.already_escalated ?? 0) > 0;
  if (isDuplicateOfRecent) {
    flags.push({
      signal: "duplicate_of_recent",
      detail: {
        windowMinutes: duplicateWindowMinutes,
        clusterAlreadyEscalated,
      },
    });
  }

  // ── Volume spike ─────────────────────────────────────────────────────────
  const { rows: volumeRows } = await executor(
    `SELECT
       COUNT(*) FILTER (
         WHERE created_at > NOW() - make_interval(mins => $2::int)
       )::int AS recent_count,
       COUNT(*) FILTER (
         WHERE created_at <= NOW() - make_interval(mins => $2::int)
           AND created_at > NOW() - make_interval(hours => $3::int)
       )::int AS baseline_count
     FROM stream_reports
     WHERE stream_id = $1`,
    [options.streamId, recentWindowMinutes, baselineWindowHours]
  );
  const recentCount = volumeRows[0]?.recent_count ?? 0;
  const baselineCount = volumeRows[0]?.baseline_count ?? 0;
  const baselineHours = Math.max(
    baselineWindowHours - recentWindowMinutes / 60,
    1
  );
  const recentRatePerHour = recentCount / (recentWindowMinutes / 60);
  const baselineRatePerHour = baselineCount / baselineHours;
  // A stream with (almost) no reporting history has no meaningful baseline
  // to compare against; only judge a genuinely elevated absolute count as a
  // spike in that case (never zero-vs-zero, which is trivially "infinite").
  const isSpike =
    recentCount >= spikeMinRecentReports &&
    (baselineRatePerHour === 0
      ? true
      : recentRatePerHour / baselineRatePerHour >= spikeRatioThreshold);
  if (isSpike) {
    flags.push({
      signal: "volume_spike",
      detail: {
        recentCount,
        recentWindowMinutes,
        baselineCount,
        baselineWindowHours,
      },
    });
  }

  // ── Coordinated / low-legitimacy accounts ───────────────────────────────
  // Anonymous reports carry no identity to correlate; excluded entirely.
  if (options.reporterUserId) {
    const { rows: recentReporterRows } = await executor(
      `SELECT DISTINCT reporter_user_id
         FROM stream_reports
        WHERE stream_id = $1
          AND reporter_user_id IS NOT NULL
          AND created_at > NOW() - make_interval(mins => $2::int)`,
      [options.streamId, recentWindowMinutes]
    );
    const recentReporterIds: string[] = recentReporterRows.map(
      r => r.reporter_user_id as string
    );
    if (!recentReporterIds.includes(options.reporterUserId)) {
      recentReporterIds.push(options.reporterUserId);
    }

    flags.push(
      ...(await coordinationSignals(
        executor,
        options.reporterUserId,
        recentReporterIds,
        newAccountWindowHours
      ))
    );
  }

  // ── Graduated response ──────────────────────────────────────────────────
  // Expedited review, never an automatic consequence: a spike or a
  // coordination signal on an otherwise-unremarkable report is exactly the
  // "hold for human review" case the issue calls for. Once this stream's
  // current duplicate cluster has already been escalated, a later report in
  // the same cluster does not escalate again on the strength of the same
  // ongoing spike (that would just be re-flagging the identical situation
  // report after report); a genuinely new signal (e.g. coordination found on
  // this specific reporter) still escalates regardless.
  const hasEscalatingSignal = flags.some(
    f => f.signal === "volume_spike" || f.signal === "coordinated_accounts"
  );
  const priority: ReportPriority =
    hasEscalatingSignal && !clusterAlreadyEscalated ? "expedited" : "normal";

  return { priority, flags };
}
