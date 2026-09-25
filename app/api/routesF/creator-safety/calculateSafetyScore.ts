import {
  SafetyReport,
  ModAction,
  CreatorActivity,
  SafetyFactor,
  SafetyScoreResult,
} from './safetyData';

const SEVERITY_PENALTIES: Record<string, number> = {
  low: 5,
  medium: 10,
  high: 20,
};

const MOD_ACTION_PENALTIES: Record<string, number> = {
  ban: 25,
  warn: 10,
  timeout: 15,
  appeal: 5, // appealing a ban slightly reduces penalty impact
};

/**
 * Compute a creator's safety score (0–100) and factor breakdown.
 * Higher score = safer.
 */
export function calculateSafetyScore(
  reports: SafetyReport[],
  modActions: ModAction[],
  activity: CreatorActivity,
): SafetyScoreResult {
  // --- Factor 1: Report severity penalty (weight: ~40%) ---
  let reportPenalty = 0;
  for (const r of reports) {
    reportPenalty += SEVERITY_PENALTIES[r.severity] ?? 10;
  }
  const reportScore = Math.max(0, 100 - reportPenalty);

  // --- Factor 2: Mod action penalty (weight: ~30%) ---
  let actionPenalty = 0;
  for (const a of modActions) {
    actionPenalty += MOD_ACTION_PENALTIES[a.type] ?? 10;
  }
  for (const a of modActions) {
    if (a.type === 'appeal') {
      // appeal reduces the ban impact by 30%
      actionPenalty -= MOD_ACTION_PENALTIES.ban * 0.3;
    }
  }
  const actionScore = Math.max(0, 100 - Math.max(0, actionPenalty));

  // --- Factor 3: Resolution ratio (weight: ~20%) ---
  const resolutionRatio =
    activity.reportsTotal > 0
      ? activity.reportsResolved / activity.reportsTotal
      : 1;
  const resolutionScore = Math.round(resolutionRatio * 100);

  // --- Factor 4: Activity bonus (weight: ~10%) ---
  // More streams = more community engagement, small bonus
  const streamBonus = Math.min(10, Math.floor(activity.totalStreams / 20));
  const activityScore = Math.min(100, 50 + streamBonus);

  // --- Aggregate: weighted average ---
  const rawScore =
    reportScore * 0.4 + actionScore * 0.3 + resolutionScore * 0.2 + activityScore * 0.1;

  const finalScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  // Compute each factor's contribution to the final score
  const factors: SafetyFactor[] = [
    { name: 'report_history', contribution: Math.round(reportScore * 0.4) },
    { name: 'mod_action_history', contribution: Math.round(actionScore * 0.3) },
    { name: 'resolution_ratio', contribution: Math.round(resolutionScore * 0.2) },
    { name: 'activity_bonus', contribution: Math.round(activityScore * 0.1) },
  ];

  return { score: finalScore, factors };
}