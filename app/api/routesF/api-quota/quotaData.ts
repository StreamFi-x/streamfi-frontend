export interface ApiKeyUsage {
  apiKey: string;
  owner: string;
  hourlyQuota: number;
  callsLastHour: number;
  lastResetAt: string;
}

const HOURLY_WINDOW_MS = 60 * 60 * 1000;

const seedUsage: Record<string, ApiKeyUsage> = {
  'sk-live-a1b2c3d4': {
    apiKey: 'sk-live-a1b2c3d4',
    owner: 'streamer-1',
    hourlyQuota: 1000,
    callsLastHour: 234,
    lastResetAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 min ago
  },
  'sk-live-e5f6g7h8': {
    apiKey: 'sk-live-e5f6g7h8',
    owner: 'streamer-2',
    hourlyQuota: 500,
    callsLastHour: 498,
    lastResetAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 min ago
  },
  'sk-live-i9j0k1l2': {
    apiKey: 'sk-live-i9j0k1l2',
    owner: 'streamer-3',
    hourlyQuota: 200,
    callsLastHour: 200,
    lastResetAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
  'sk-live-m3n4o5p6': {
    apiKey: 'sk-live-m3n4o5p6',
    owner: 'streamer-4',
    hourlyQuota: 1000,
    callsLastHour: 50,
    lastResetAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
};

export function getUsageByApiKey(apiKey: string): ApiKeyUsage | null {
  return seedUsage[apiKey] ?? null;
}

export interface QuotaResponse {
  calls_last_hour: number;
  hourly_quota: number;
  remaining: number;
  reset_at: string;
}

export function buildQuotaResponse(usage: ApiKeyUsage): QuotaResponse {
  const resetAt = new Date(
    new Date(usage.lastResetAt).getTime() + HOURLY_WINDOW_MS,
  ).toISOString();

  return {
    calls_last_hour: usage.callsLastHour,
    hourly_quota: usage.hourlyQuota,
    remaining: Math.max(0, usage.hourlyQuota - usage.callsLastHour),
    reset_at: resetAt,
  };
}