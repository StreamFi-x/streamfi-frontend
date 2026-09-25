import { GET, MOODS } from './route';
import { NextRequest } from 'next/server';

const BASE = 'http://localhost/api/routesF/mood-filter';

describe('Mood Filter', () => {
  describe.each(MOODS)('GET /api/routesF/mood-filter?mood=%s', (mood) => {
    it(`returns only streams tagged with mood "${mood}"`, async () => {
      const res = await GET(new NextRequest(`${BASE}?mood=${mood}`));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.streams.length).toBeGreaterThan(0);
      expect(data.streams.every((s: { mood: string }) => s.mood === mood)).toBe(true);
    });
  });

  it('returns multiple streams when more than one matches the mood', async () => {
    const res = await GET(new NextRequest(`${BASE}?mood=chill`));
    const data = await res.json();
    expect(data.streams.map((s: { stream_id: string }) => s.stream_id)).toEqual([
      'mood-1',
      'mood-6',
    ]);
  });

  it('returns 400 when mood is missing', async () => {
    const res = await GET(new NextRequest(BASE));
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown mood', async () => {
    const res = await GET(new NextRequest(`${BASE}?mood=melancholy`));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toContain('Unknown mood');
  });
});
