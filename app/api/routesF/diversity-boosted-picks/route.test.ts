import { GET, selectDiverse, SEED_CREATORS } from './route';
import { NextRequest } from 'next/server';

const BASE = 'http://localhost/api/routesF/diversity-boosted-picks';

function countByCategory(creators: { category: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of creators) {
    counts[c.category] = (counts[c.category] ?? 0) + 1;
  }
  return counts;
}

describe('selectDiverse', () => {
  it('never selects more than 2 per category when the requested count allows spreading out', () => {
    const result = selectDiverse(SEED_CREATORS, 6);
    const counts = countByCategory(result);
    expect(Object.values(counts).every((n) => n <= 2)).toBe(true);
    expect(result).toHaveLength(6);
  });

  it('picks exactly one per category when count equals the number of categories', () => {
    const result = selectDiverse(SEED_CREATORS, 4);
    const counts = countByCategory(result);
    expect(counts).toEqual({ gaming: 1, music: 1, cooking: 1, art: 1 });
  });

  it('backfills beyond the 2-per-category cap once every category has contributed its share', () => {
    const result = selectDiverse(SEED_CREATORS, 12);
    expect(result).toHaveLength(12);
    // All 12 seed creators are used up, so with only 4 categories some
    // category necessarily has 3 — this is exactly the case the backfill
    // pass exists for.
    const counts = countByCategory(result);
    expect(Object.values(counts).some((n) => n === 3)).toBe(true);
  });

  it('never returns more creators than requested even if the pool is larger', () => {
    const result = selectDiverse(SEED_CREATORS, 3);
    expect(result).toHaveLength(3);
  });

  it('returns every creator when count exceeds the pool size', () => {
    const result = selectDiverse(SEED_CREATORS, 100);
    expect(result).toHaveLength(SEED_CREATORS.length);
  });
});

describe('GET /api/routesF/diversity-boosted-picks', () => {
  it('returns a diverse creator set for a valid viewer_id', async () => {
    const res = await GET(new NextRequest(`${BASE}?viewer_id=v1`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.creators).toHaveLength(12);
  });

  it('respects the count parameter', async () => {
    const res = await GET(new NextRequest(`${BASE}?viewer_id=v1&count=6`));
    const data = await res.json();
    expect(data.creators).toHaveLength(6);
    const counts = countByCategory(data.creators);
    expect(Object.values(counts).every((n) => n <= 2)).toBe(true);
  });

  it('returns 400 when viewer_id is missing', async () => {
    const res = await GET(new NextRequest(BASE));
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid count', async () => {
    expect((await GET(new NextRequest(`${BASE}?viewer_id=v1&count=0`))).status).toBe(400);
    expect((await GET(new NextRequest(`${BASE}?viewer_id=v1&count=abc`))).status).toBe(400);
    expect((await GET(new NextRequest(`${BASE}?viewer_id=v1&count=51`))).status).toBe(400);
  });
});
