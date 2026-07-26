import type { GoalHistory, GoalRateResponse } from '../types/goal';

export function calculateGoalRate(
  goals: GoalHistory[],
  lastN?: number
): GoalRateResponse {
  // If no goals, return zeros
  if (goals.length === 0) {
    return {
      attained: 0,
      missed: 0,
      attainment_rate_percent: 0,
    };
  }

  // Sort goals by ended_at (newest first)
  const sortedGoals = [...goals].sort((a, b) => 
    new Date(b.ended_at).getTime() - new Date(a.ended_at).getTime()
  );

  // Take only last N goals if specified
  const goalsToAnalyze = lastN ? sortedGoals.slice(0, lastN) : sortedGoals;

  // Calculate attained and missed
  let attained = 0;
  let missed = 0;

  for (const goal of goalsToAnalyze) {
    if (goal.attained) {
      attained++;
    } else {
      missed++;
    }
  }

  // Calculate attainment rate percentage
  const total = attained + missed;
  const attainmentRatePercent = total > 0 ? Math.round((attained / total) * 100) : 0;

  return {
    attained,
    missed,
    attainment_rate_percent: attainmentRatePercent,
  };
}

export function filterGoalsByCreator(
  goals: GoalHistory[],
  creatorId: string
): GoalHistory[] {
  return goals.filter(goal => goal.creator_id === creatorId);
}

export function getGoalStats(
  allGoals: GoalHistory[],
  creatorId: string,
  lastN?: number
): GoalRateResponse {
  const creatorGoals = filterGoalsByCreator(allGoals, creatorId);
  return calculateGoalRate(creatorGoals, lastN);
}