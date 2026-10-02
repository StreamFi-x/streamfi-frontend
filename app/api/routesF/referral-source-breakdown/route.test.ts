import { GET } from './route';

describe('Referral Source Breakdown API', () => {
  it('should return 400 when stream_id is missing', async () => {
    const req = new Request('http://localhost/api/routesF/referral-source-breakdown');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Missing or invalid stream_id parameter');
  });

  it('should return 400 when stream_id is empty', async () => {
    const req = new Request('http://localhost/api/routesF/referral-source-breakdown?stream_id=   ');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('should return empty sources array when stream_id has no viewers', async () => {
    const req = new Request('http://localhost/api/routesF/referral-source-breakdown?stream_id=stream_999');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sources).toEqual([]);
  });

  it('should return source breakdown for valid stream_id', async () => {
    const req = new Request('http://localhost/api/routesF/referral-source-breakdown?stream_id=stream_001');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sources).toBeDefined();
    expect(Array.isArray(data.sources)).toBe(true);
  });

  it('should have correct source types in response', async () => {
    const req = new Request('http://localhost/api/routesF/referral-source-breakdown?stream_id=stream_001');
    const res = await GET(req);
    const data = await res.json();
    const validSources = ['direct', 'social', 'embed', 'search', 'other'];
    data.sources.forEach((source: any) => {
      expect(validSources).toContain(source.source);
      expect(typeof source.count).toBe('number');
      expect(typeof source.percent).toBe('number');
      expect(source.count).toBeGreaterThan(0);
      expect(source.percent).toBeGreaterThan(0);
      expect(source.percent).toBeLessThanOrEqual(100);
    });
  });

  it('should have percentages summing to 100', async () => {
    const req = new Request('http://localhost/api/routesF/referral-source-breakdown?stream_id=stream_001');
    const res = await GET(req);
    const data = await res.json();
    if (data.sources.length > 0) {
      const totalPercent = data.sources.reduce((sum: number, source: any) => sum + source.percent, 0);
      expect(Math.abs(totalPercent - 100)).toBeLessThan(0.01);
    }
  });

  it('should classify referrers correctly', async () => {
    const req = new Request('http://localhost/api/routesF/referral-source-breakdown?stream_id=stream_001');
    const res = await GET(req);
    const data = await res.json();
    expect(data.sources.length).toBeGreaterThan(0);
    const sourceNames = data.sources.map((s: any) => s.source);
    expect(sourceNames).toContain('direct');
    expect(sourceNames).toContain('social');
    expect(sourceNames).toContain('search');
    expect(sourceNames).toContain('embed');
  });

  it('should sort sources by count descending', async () => {
    const req = new Request('http://localhost/api/routesF/referral-source-breakdown?stream_id=stream_001');
    const res = await GET(req);
    const data = await res.json();
    for (let i = 1; i < data.sources.length; i++) {
      expect(data.sources[i - 1].count).toBeGreaterThanOrEqual(data.sources[i].count);
    }
  });
});
