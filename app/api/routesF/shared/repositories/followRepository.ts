import type { FollowRelationship } from '../../types';
import { generateFollowId } from '../../helpers/idUtilities';

// In-memory mock storage
let followRelationships: FollowRelationship[] = [];

/**
 * Follow Relationship Repository
 */
export const followRepository = {
  /**
   * Find all follows by viewer ID
   */
  findByViewerId(viewerId: string): FollowRelationship[] {
    return followRelationships.filter(follow => follow.viewer_id === viewerId);
  },

  /**
   * Find all follows by creator ID
   */
  findByCreatorId(creatorId: string): FollowRelationship[] {
    return followRelationships.filter(follow => follow.creator_id === creatorId);
  },

  /**
   * Check if viewer follows creator
   */
  viewerFollowsCreator(viewerId: string, creatorId: string): boolean {
    return followRelationships.some(
      follow => follow.viewer_id === viewerId && follow.creator_id === creatorId
    );
  },

  /**
   * Create a new follow relationship
   */
  create(follow: Omit<FollowRelationship, 'id'>): FollowRelationship {
    const newFollow: FollowRelationship = {
      ...follow,
      id: generateFollowId(),
    };
    
    followRelationships.push(newFollow);
    return newFollow;
  },

  /**
   * Get all follow relationships (for debugging/testing)
   */
  getAll(): FollowRelationship[] {
    return [...followRelationships];
  },

  /**
   * Seed with mock data
   */
  seed(data: FollowRelationship[]): void {
    followRelationships = [...data];
  },

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    followRelationships = [];
  },

  /**
   * Get total follow count for a viewer
   */
  getFollowCount(viewerId: string): number {
    return this.findByViewerId(viewerId).length;
  },

  /**
   * Get all follow dates for a viewer
   */
  getFollowDates(viewerId: string): Date[] {
    return this.findByViewerId(viewerId)
      .map(follow => new Date(follow.followed_at))
      .filter(date => !isNaN(date.getTime()));
  },

  /**
   * Get oldest follow date for a viewer
   */
  getOldestFollowDate(viewerId: string): Date | null {
    const dates = this.getFollowDates(viewerId);
    if (dates.length === 0) return null;
    
    return dates.reduce((oldest, current) => 
      current < oldest ? current : oldest
    );
  },
};