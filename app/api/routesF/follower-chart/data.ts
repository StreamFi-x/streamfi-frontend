export type FollowEvent = {
  type: 'follow' | 'unfollow';
  creator_id: string;
  timestamp: number;
};

// Helper to create dates in the past
const daysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(12, 0, 0, 0); // normalize time
  return d.getTime();
};

export const seedEvents: FollowEvent[] = [
  { type: 'follow', creator_id: 'creator_1', timestamp: daysAgo(5) },
  { type: 'follow', creator_id: 'creator_1', timestamp: daysAgo(5) },
  { type: 'unfollow', creator_id: 'creator_1', timestamp: daysAgo(5) },
  
  { type: 'follow', creator_id: 'creator_1', timestamp: daysAgo(2) },
  { type: 'follow', creator_id: 'creator_1', timestamp: daysAgo(2) },
  { type: 'follow', creator_id: 'creator_1', timestamp: daysAgo(2) },
  
  { type: 'unfollow', creator_id: 'creator_1', timestamp: daysAgo(1) },
  { type: 'unfollow', creator_id: 'creator_1', timestamp: daysAgo(1) },
];
