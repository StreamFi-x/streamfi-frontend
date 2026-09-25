import { buildQuotaResponse, ApiKeyUsage, getUsageByApiKey } from '../quotaData';

describe('buildQuotaResponse', () => {
  it('returns remaining = quota - calls when under quota', () => {
    const usage: ApiKeyUsage = {
      apiKey: 'sk-test-1',
      owner: 'test',
      hourlyQuota: 1000,
      callsLastHour: 234,
      lastResetAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    };

    const result = buildQuotaResponse(usage);

    expect(result.calls_last_hour).toBe(234);
    expect(result.hourly_quota).toBe(1000);
    expect(result.remaining).toBe(766);
    expect(result.reset_at).toBeDefined();
  });

  it('returns remaining = 0 when at quota', () => {
    const usage: ApiKeyUsage = {
      apiKey: 'sk-test-2',
      owner: 'test',
      hourlyQuota: 200,
      callsLastHour: 200,
      lastResetAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    };

    const result = buildQuotaResponse(usage);

    expect(result.remaining).toBe(0);
  });

  it('returns remaining = 0 when over quota', () => {
    const usage: ApiKeyUsage = {
      apiKey: 'sk-test-3',
      owner: 'test',
      hourlyQuota: 100,
      callsLastHour: 150,
      lastResetAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    };

    const result = buildQuotaResponse(usage);

    expect(result.remaining).toBe(0);
  });

  it('reset_at is 1 hour after lastResetAt', () => {
    const baseTime = new Date('2026-07-26T00:00:00Z');
    const usage: ApiKeyUsage = {
      apiKey: 'sk-test-4',
      owner: 'test',
      hourlyQuota: 500,
      callsLastHour: 50,
      lastResetAt: baseTime.toISOString(),
    };

    const result = buildQuotaResponse(usage);

    const expectedReset = new Date(baseTime.getTime() + 60 * 60 * 1000).toISOString();
    expect(result.reset_at).toBe(expectedReset);
  });
});

describe('getUsageByApiKey', () => {
  it('returns usage for a valid key', () => {
    const result = getUsageByApiKey('sk-live-a1b2c3d4');

    expect(result).not.toBeNull();
    expect(result!.owner).toBe('streamer-1');
    expect(result!.hourlyQuota).toBe(1000);
  });

  it('returns null for an invalid key', () => {
    const result = getUsageByApiKey('sk-invalid-key');

    expect(result).toBeNull();
  });
});