import type { StreamSession, StreamAnalyticsSummary } from "./types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Compute an analytics summary for a single stream session.
 *
 * For completed streams the duration is `ended_at - started_at`; for live
 * streams it is `now - started_at`, so an in-progress stream's duration grows
 * over time.
 */
export function summarizeSession(
  session: StreamSession,
  now: number = Date.now()
): StreamAnalyticsSummary {
  const start = new Date(session.started_at).getTime();
  const end =
    session.status === "completed" && session.ended_at
      ? new Date(session.ended_at).getTime()
      : now;

  const durationMinutes = Math.max(0, Math.round((end - start) / 60000));

  const peak =
    session.viewer_samples.length > 0
      ? Math.max(...session.viewer_samples)
      : 0;

  const average =
    session.viewer_samples.length > 0
      ? Math.round(
          session.viewer_samples.reduce((sum, v) => sum + v, 0) /
            session.viewer_samples.length
        )
      : 0;

  const totalTips = session.tips_usdc.reduce((sum, t) => sum + t, 0);

  return {
    duration_minutes: durationMinutes,
    peak_viewers: peak,
    average_viewers: average,
    unique_viewers: new Set(session.unique_viewer_ids).size,
    total_messages: session.messages,
    total_tips_usdc: round2(totalTips),
  };
}
