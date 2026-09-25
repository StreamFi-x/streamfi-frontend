import type { ViewerVisitRecord, ReturningViewersResponse } from "./types";

const TOP_RETURNING_LIMIT = 5;

export function computeReturningStats(
  records: ViewerVisitRecord[]
): ReturningViewersResponse {
  const returning = records.filter(r => r.prior_visits > 0);

  const returning_count = returning.length;
  const avg_prior_visits =
    returning_count === 0
      ? 0
      : roundToTwo(
          returning.reduce((sum, r) => sum + r.prior_visits, 0) /
            returning_count
        );

  const top_returning = [...returning]
    .sort((a, b) => b.prior_visits - a.prior_visits)
    .slice(0, TOP_RETURNING_LIMIT)
    .map(({ viewer, prior_visits }) => ({ viewer, prior_visits }));

  return { returning_count, avg_prior_visits, top_returning };
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}
