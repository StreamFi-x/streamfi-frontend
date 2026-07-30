export interface SafetyReport {
  id: string;
  creatorId: string;
  reason: string;
  severity: 'low' | 'medium' | 'high';
  createdAt: string;
}

export interface ModAction {
  id: string;
  creatorId: string;
  type: 'ban' | 'warn' | 'timeout' | 'appeal';
  createdAt: string;
}

export interface CreatorActivity {
  totalStreams: number;
  avgViewers: number;
  reportsResolved: number;
  reportsTotal: number;
}

export interface SafetyFactor {
  name: string;
  contribution: number;
}

export interface SafetyScoreResult {
  score: number;
  factors: SafetyFactor[];
}

const seedReports: SafetyReport[] = [
  { id: 'sr-001', creatorId: 'creator-1', reason: 'Hate speech', severity: 'high', createdAt: '2026-07-01T10:00:00Z' },
  { id: 'sr-002', creatorId: 'creator-1', reason: 'Spam', severity: 'low', createdAt: '2026-07-05T14:30:00Z' },
  { id: 'sr-003', creatorId: 'creator-1', reason: 'Harassment', severity: 'medium', createdAt: '2026-07-10T09:15:00Z' },
  { id: 'sr-004', creatorId: 'creator-2', reason: 'Misleading title', severity: 'low', createdAt: '2026-07-02T11:00:00Z' },
  { id: 'sr-005', creatorId: 'creator-3', reason: 'Copyright violation', severity: 'high', createdAt: '2026-07-08T16:45:00Z' },
  { id: 'sr-006', creatorId: 'creator-3', reason: 'Inappropriate content', severity: 'high', createdAt: '2026-07-12T08:30:00Z' },
];

const seedModActions: ModAction[] = [
  { id: 'ma-001', creatorId: 'creator-2', type: 'warn', createdAt: '2026-06-15T12:00:00Z' },
  { id: 'ma-002', creatorId: 'creator-1', type: 'ban', createdAt: '2026-07-11T10:00:00Z' },
  { id: 'ma-003', creatorId: 'creator-1', type: 'appeal', createdAt: '2026-07-13T10:00:00Z' },
];

const seedActivities: Record<string, CreatorActivity> = {
  'creator-1': { totalStreams: 45, avgViewers: 120, reportsResolved: 1, reportsTotal: 3 },
  'creator-2': { totalStreams: 120, avgViewers: 340, reportsResolved: 1, reportsTotal: 1 },
  'creator-3': { totalStreams: 10, avgViewers: 25, reportsResolved: 0, reportsTotal: 2 },
  'creator-4': { totalStreams: 200, avgViewers: 850, reportsResolved: 0, reportsTotal: 0 },
  'creator-5': { totalStreams: 67, avgViewers: 210, reportsResolved: 2, reportsTotal: 1 },
};

export function getReportsForCreator(creatorId: string): SafetyReport[] {
  return seedReports.filter((r) => r.creatorId === creatorId);
}

export function getModActionsForCreator(creatorId: string): ModAction[] {
  return seedModActions.filter((a) => a.creatorId === creatorId);
}

export function getActivityForCreator(creatorId: string): CreatorActivity {
  return seedActivities[creatorId] ?? { totalStreams: 0, avgViewers: 0, reportsResolved: 0, reportsTotal: 0 };
}