import { GET } from './route';
import { NextRequest } from 'next/server';

const BASE = 'http://localhost/api/routesF/longest-live-streams';

// Seed started_at values are anchored around this "now"
const NOW = new Date('2026-07-22T12:00:00Z').getTime();

describe('Longest Currently-Live Streams', () => {
  let nowSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => NOW);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  describe('GET /api/routesF/longest-live-streams', () => {
    it('should return all live streams sorted by uptime desc', async () => {
      const res = await GET(new NextRequest(BASE));

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.streams.map((s: { stream_id: string }) => s.stream_id)).toEqual([
        'live-1', // started Jul 21 20:00 -> 16h
        'live-2', // started Jul 22 06:00 -> 6h
        'live-4', // started Jul 22 09:00 -> 3h
        'live-3', // started Jul 22 10:30 -> 1.5h
      ]);
    });

    it('should compute hours_live from started_at', async () => {
      const res = await GET(new NextRequest(BASE));
      const data = await res.json();

      const byId = Object.fromEntries(
        data.streams.map((s: { stream_id: string; hours_live: number }) => [
          s.stream_id,
          s.hours_live,
        ])
      );
      expect(byId['live-1']).toBe(16);
      expect(byId['live-2']).toBe(6);
      expect(byId['live-4']).toBe(3);
      expect(byId['live-3']).toBe(1.5);
    });

    it('should respect the limit parameter', async () => {
      const res = await GET(new NextRequest(`${BASE}?limit=2`));
      const data = await res.json();
      expect(data.streams.map((s: { stream_id: string }) => s.stream_id)).toEqual([
        'live-1',
        'live-2',
      ]);
    });

    it('should return 400 for an invalid limit', async () => {
      expect((await GET(new NextRequest(`${BASE}?limit=0`))).status).toBe(400);
      expect((await GET(new NextRequest(`${BASE}?limit=abc`))).status).toBe(400);
      expect((await GET(new NextRequest(`${BASE}?limit=101`))).status).toBe(400);
    });
  });
});
