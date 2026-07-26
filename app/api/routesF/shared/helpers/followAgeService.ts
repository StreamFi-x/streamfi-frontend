import { calculateAverage, daysBetween } from './dateUtilities';
import type { FollowAgeSummary } from '../types';

/**
 * Calculate follow age summary for a viewer
 */
export function calculateFollowAgeSummary(
  followDates: Date[]
): FollowAgeSummary {
  if (followDates.length === 0) {
    return {
      follows_count: 0,
      avg_follow_age_days: 0,
      oldest_follow_at: null,
    };
  }

  // Calculate follow ages in days
  const now = new Date();
  const followAgesInDays = followDates.map(date => daysBetween(date, now));

  // Find oldest follow date
  const oldestFollowDate = followDates.reduce((oldest, current) => 
    current < oldest ? current : oldest
  );

  // Calculate average follow age
  const avgFollowAgeDays = calculateAverage(followAgesInDays);

  return {
    follows_count: followDates.length,
    avg_follow_age_days: avgFollowAgeDays,
    oldest_follow_at: oldestFollowDate.toISOString(),
  };
}

/**
 * Get follow summary for a viewer
 */
export function getFollowSummaryForViewer(viewerId: string): FollowAgeSummary {
  // Import repository dynamically to avoid circular dependencies
  const { followRepository } = require('../repositories');
  
  const followDates = followRepository.getFollowDates(viewerId);
  return calculateFollowAgeSummary(followDates);
}