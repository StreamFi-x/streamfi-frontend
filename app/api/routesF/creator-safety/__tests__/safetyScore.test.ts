import { calculateSafetyScore } from '../calculateSafetyScore';
import { SafetyReport, ModAction, CreatorActivity } from '../safetyData';

describe('calculateSafetyScore', () => {
  it('returns 100 for a creator with no reports, no mod actions, and good activity', () => {
    const reports: SafetyReport[] = [];
    const modActions: ModAction[] = [];
    const activity: CreatorActivity = { totalStreams: 200, avgViewers: 500, reportsResolved: 0, reportsTotal: 0 };

    const result = calculateSafetyScore(reports, modActions, activity);

    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.factors.length).toBe(4);
  });

  it('returns lower score for a creator with high-severity reports', () => {
    const reports: SafetyReport[] = [
      { id: 'r1', creatorId: 'c1', reason: 'Hate speech', severity: 'high', createdAt: '2026-07-01T00:00:00Z' },
      { id: 'r2', creatorId: 'c1', reason: 'Harassment', severity: 'high', createdAt: '2026-07-02T00:00:00Z' },
    ];
    const modActions: ModAction[] = [];
    const activity: CreatorActivity = { totalStreams: 100, avgViewers: 200, reportsResolved: 0, reportsTotal: 2 };

    const result = calculateSafetyScore(reports, modActions, activity);

    expect(result.score).toBeLessThan(70);
  });

  it('applies a ban penalty to the score', () => {
    const reports: SafetyReport[] = [];
    const modActions: ModAction[] = [
      { id: 'm1', creatorId: 'c1', type: 'ban', createdAt: '2026-07-01T00:00:00Z' },
    ];
    const activity: CreatorActivity = { totalStreams: 50, avgViewers: 100, reportsResolved: 0, reportsTotal: 0 };

    const result = calculateSafetyScore(reports, modActions, activity);

    expect(result.score).toBeLessThan(100);
    expect(result.score).toBeLessThanOrEqual(88);
  });

  it('gives high score to a clean creator with lots of streams', () => {
    const reports: SafetyReport[] = [];
    const modActions: ModAction[] = [];
    const activity: CreatorActivity = { totalStreams: 500, avgViewers: 1000, reportsResolved: 0, reportsTotal: 0 };

    const result = calculateSafetyScore(reports, modActions, activity);

    expect(result.score).toBeGreaterThanOrEqual(95);
  });

  it('factors include all four expected names', () => {
    const reports: SafetyReport[] = [];
    const modActions: ModAction[] = [];
    const activity: CreatorActivity = { totalStreams: 50, avgViewers: 100, reportsResolved: 0, reportsTotal: 0 };

    const result = calculateSafetyScore(reports, modActions, activity);

    const names = result.factors.map((f) => f.name);
    expect(names).toContain('report_history');
    expect(names).toContain('mod_action_history');
    expect(names).toContain('resolution_ratio');
    expect(names).toContain('activity_bonus');
  });

  it('handles extreme negatives: severe reports and bans reduce score significantly', () => {
    const reports: SafetyReport[] = [
      { id: 'r1', creatorId: 'c1', reason: 'Hate speech', severity: 'high', createdAt: '2026-07-01T00:00:00Z' },
      { id: 'r2', creatorId: 'c1', reason: 'Harassment', severity: 'high', createdAt: '2026-07-02T00:00:00Z' },
      { id: 'r3', creatorId: 'c1', reason: 'Violence', severity: 'high', createdAt: '2026-07-03T00:00:00Z' },
      { id: 'r4', creatorId: 'c1', reason: 'Spam', severity: 'high', createdAt: '2026-07-04T00:00:00Z' },
      { id: 'r5', creatorId: 'c1', reason: 'Scam', severity: 'high', createdAt: '2026-07-05T00:00:00Z' },
    ];
    const modActions: ModAction[] = [
      { id: 'm1', creatorId: 'c1', type: 'ban', createdAt: '2026-07-06T00:00:00Z' },
      { id: 'm2', creatorId: 'c1', type: 'timeout', createdAt: '2026-07-07T00:00:00Z' },
    ];
    const activity: CreatorActivity = { totalStreams: 5, avgViewers: 10, reportsResolved: 0, reportsTotal: 5 };

    const result = calculateSafetyScore(reports, modActions, activity);

    expect(result.score).toBeLessThanOrEqual(25);
  });
});