import { GET } from './route';
import { NextRequest } from 'next/server';

const BASE = 'http://localhost/api/routesF/new-creators';

// Seed joined_at dates are anchored around this "now"
const NOW = new Date('2026-07-22T12:00:00Z').getTime();

async function fetchCreators(query: string) {
  const res = await GET(new NextRequest(`${BASE}${query}`));
  return { res, data: await res.json() };
}

describe('New Creators In Category', () => {
  let nowSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => NOW);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  describe('GET /api/routesF/new-creators', () => {
    it('should return recent creators in the category sorted by joined_at desc', async () => {
      const { res, data } = await fetchCreators('?category=gaming');

      expect(res.status).toBe(200);
      // creator-1 (Jul 21, 3 streams) qualifies; creator-3 (0 streams) fails
      // min_streams=1; creator-5 (Jul 10) and creator-6 (Apr) are older than 7 days.
      expect(data.creators.map((c: { creator_id: string }) => c.creator_id)).toEqual([
        'creator-1',
      ]);
    });

    it('should widen the window with days', async () => {
      const { data } = await fetchCreators('?category=gaming&days=14');
      expect(data.creators.map((c: { creator_id: string }) => c.creator_id)).toEqual([
        'creator-1',
        'creator-5',
      ]);
      const joined = data.creators.map((c: { joined_at: string }) =>
        new Date(c.joined_at).getTime()
      );
      expect(joined).toEqual([...joined].sort((a, b) => b - a));
    });

    it('should include zero-stream creators when min_streams=0', async () => {
      const { data } = await fetchCreators('?category=gaming&min_streams=0');
      expect(data.creators.map((c: { creator_id: string }) => c.creator_id)).toEqual([
        'creator-1',
        'creator-3',
      ]);
    });

    it('should raise the bar with a higher min_streams', async () => {
      const { data } = await fetchCreators('?category=gaming&days=14&min_streams=10');
      expect(data.creators.map((c: { creator_id: string }) => c.creator_id)).toEqual([
        'creator-5',
      ]);
    });

    it('should filter by other categories', async () => {
      const { data } = await fetchCreators('?category=music');
      expect(data.creators).toHaveLength(1);
      expect(data.creators[0].display_name).toBe('LoFiLena');
    });

    it('should return an empty list for a category with no recent creators', async () => {
      const { res, data } = await fetchCreators('?category=chess');
      expect(res.status).toBe(200);
      expect(data.creators).toEqual([]);
      expect(data.total).toBe(0);
    });

    it('should return 400 when category is missing', async () => {
      const { res } = await fetchCreators('');
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid days or min_streams', async () => {
      expect((await fetchCreators('?category=gaming&days=0')).res.status).toBe(400);
      expect((await fetchCreators('?category=gaming&days=abc')).res.status).toBe(400);
      expect((await fetchCreators('?category=gaming&min_streams=-1')).res.status).toBe(400);
    });
  });
});
