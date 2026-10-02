import { GET } from './route';
import { POST as REFRESH } from './refresh/route';
import { BALANCE_CACHE, TTL_SECONDS } from './store';
import { NextRequest } from 'next/server';

const BASE = 'http://localhost/api/routesF/wallet-balance';

function getReq(wallet?: string) {
  return new NextRequest(wallet ? `${BASE}?wallet=${wallet}` : BASE);
}

function refreshReq(body: unknown) {
  return new NextRequest(`${BASE}/refresh`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('Cached Wallet Balance Lookup', () => {
  let nowSpy: jest.SpyInstance<number, []>;
  let now: number;

  beforeEach(() => {
    for (const key in BALANCE_CACHE) {
      delete BALANCE_CACHE[key];
    }
    now = new Date('2026-01-01T12:00:00Z').getTime();
    nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  describe('GET /api/routesF/wallet-balance', () => {
    it('should return the seeded balance with full TTL on first lookup', async () => {
      const res = await GET(getReq('GVIEWERALPHA'));

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.balance_xlm).toBe(150.5);
      expect(data.balance_usdc).toBe(42.1);
      expect(data.cached_at).toBe('2026-01-01T12:00:00.000Z');
      expect(data.ttl_seconds).toBe(TTL_SECONDS);
    });

    it('should serve a cache hit within the TTL (same cached_at, decreasing ttl)', async () => {
      const first = await (await GET(getReq('GVIEWERALPHA'))).json();

      now += 20_000; // 20s later, still inside the 60s TTL
      const second = await (await GET(getReq('GVIEWERALPHA'))).json();

      expect(second.cached_at).toBe(first.cached_at);
      expect(second.ttl_seconds).toBe(TTL_SECONDS - 20);
    });

    it('should recompute after the TTL expires', async () => {
      const first = await (await GET(getReq('GVIEWERALPHA'))).json();

      now += (TTL_SECONDS + 5) * 1000;
      const second = await (await GET(getReq('GVIEWERALPHA'))).json();

      expect(second.cached_at).not.toBe(first.cached_at);
      expect(second.cached_at).toBe(new Date(now).toISOString());
      expect(second.ttl_seconds).toBe(TTL_SECONDS);
    });

    it('should return 404 for an unknown wallet', async () => {
      const res = await GET(getReq('GUNKNOWN'));
      expect(res.status).toBe(404);
    });

    it('should return 400 when wallet is missing', async () => {
      const res = await GET(getReq());
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/routesF/wallet-balance/refresh', () => {
    it('should force recomputation even inside the TTL', async () => {
      const first = await (await GET(getReq('GVIEWERBETA'))).json();

      now += 10_000; // still inside TTL
      const refreshed = await REFRESH(refreshReq({ wallet: 'GVIEWERBETA' }));
      expect(refreshed.status).toBe(200);
      const refreshData = await refreshed.json();

      expect(refreshData.cached_at).not.toBe(first.cached_at);
      expect(refreshData.cached_at).toBe(new Date(now).toISOString());
      expect(refreshData.ttl_seconds).toBe(TTL_SECONDS);

      const after = await (await GET(getReq('GVIEWERBETA'))).json();
      expect(after.cached_at).toBe(refreshData.cached_at);
    });

    it('should return 404 for an unknown wallet', async () => {
      const res = await REFRESH(refreshReq({ wallet: 'GUNKNOWN' }));
      expect(res.status).toBe(404);
    });

    it('should return 400 when wallet is missing', async () => {
      const res = await REFRESH(refreshReq({}));
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid JSON', async () => {
      const req = new NextRequest(`${BASE}/refresh`, { method: 'POST', body: 'not-json' });
      const res = await REFRESH(req);
      expect(res.status).toBe(400);
    });
  });
});
