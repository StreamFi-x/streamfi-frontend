import { POST } from './check/route';
import { AWARDED_BADGES } from './store';
import { NextRequest } from 'next/server';

const BASE = 'http://localhost/api/routesF/peak-viewer-badges';

function checkReq(body: unknown) {
  return new NextRequest(`${BASE}/check`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

async function check(creator_id: string, peak_viewers: number): Promise<string[]> {
  const res = await POST(checkReq({ creator_id, peak_viewers }));
  const data = await res.json();
  return data.newly_awarded;
}

describe('Peak Viewer Count Badges', () => {
  beforeEach(() => {
    for (const key in AWARDED_BADGES) {
      delete AWARDED_BADGES[key];
    }
  });

  describe('POST /api/routesF/peak-viewer-badges/check', () => {
    it('should award no badges below the first threshold', async () => {
      expect(await check('creator-1', 9)).toEqual([]);
    });

    it('should award the first badge at exactly the threshold', async () => {
      expect(await check('creator-1', 10)).toEqual(['first-ten']);
    });

    it('should award all skipped rungs when a peak jumps the ladder', async () => {
      expect(await check('creator-1', 750)).toEqual([
        'first-ten',
        'crowd-pleaser',
        'rising-star',
      ]);
    });

    it('should be idempotent for the same peak', async () => {
      await check('creator-1', 750);
      expect(await check('creator-1', 750)).toEqual([]);
    });

    it('should only award new rungs as the peak progresses', async () => {
      expect(await check('creator-1', 10)).toEqual(['first-ten']);
      expect(await check('creator-1', 150)).toEqual(['crowd-pleaser']);
      expect(await check('creator-1', 6000)).toEqual([
        'rising-star',
        'thousand-club',
        'headliner',
      ]);
      expect(await check('creator-1', 6000)).toEqual([]);
    });

    it('should not award again when a later peak is lower', async () => {
      await check('creator-1', 1200);
      expect(await check('creator-1', 50)).toEqual([]);
    });

    it('should track creators independently', async () => {
      await check('creator-1', 5000);
      expect(await check('creator-2', 10)).toEqual(['first-ten']);
    });

    it('should return 400 for missing or invalid input', async () => {
      expect((await POST(checkReq({ peak_viewers: 10 }))).status).toBe(400);
      expect((await POST(checkReq({ creator_id: 'creator-1' }))).status).toBe(400);
      expect(
        (await POST(checkReq({ creator_id: 'creator-1', peak_viewers: -5 }))).status
      ).toBe(400);
      expect(
        (await POST(checkReq({ creator_id: 'creator-1', peak_viewers: 2.5 }))).status
      ).toBe(400);
    });

    it('should return 400 for invalid JSON', async () => {
      const req = new NextRequest(`${BASE}/check`, { method: 'POST', body: 'not-json' });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });
});
