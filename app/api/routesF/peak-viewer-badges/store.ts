// Badge ladder and awarded-badge storage, bundled inside this folder per the
// routesF scope constraint.

export const BADGE_LADDER: { threshold: number; badge: string }[] = [
  { threshold: 10, badge: 'first-ten' },
  { threshold: 100, badge: 'crowd-pleaser' },
  { threshold: 500, badge: 'rising-star' },
  { threshold: 1000, badge: 'thousand-club' },
  { threshold: 5000, badge: 'headliner' },
];

// creator_id -> set of already-awarded badges
export const AWARDED_BADGES: Record<string, Set<string>> = {};
