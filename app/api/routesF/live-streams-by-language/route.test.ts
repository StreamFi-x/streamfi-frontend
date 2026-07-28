import { GET } from './route';
import { NextRequest } from 'next/server';

const BASE = 'http://localhost/api/routesF/live-streams-by-language';

describe('Live Streams by Language', () => {
  describe('GET /api/routesF/live-streams-by-language', () => {
    it('returns only streams matching the requested language, sorted by viewer count desc', async () => {
      const res = await GET(new NextRequest(`${BASE}?language=en`));

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.streams.map((s: { stream_id: string }) => s.stream_id)).toEqual([
        'lang-1', // 1200 viewers
        'lang-4', // 890 viewers
      ]);
    });

    it('sorts a different language filter by viewer count desc too', async () => {
      const res = await GET(new NextRequest(`${BASE}?language=es`));
      const data = await res.json();
      expect(data.streams.map((s: { stream_id: string }) => s.stream_id)).toEqual([
        'lang-2', // 640 viewers
        'lang-5', // 75 viewers
      ]);
    });

    it('returns a single stream for a language with only one match', async () => {
      const res = await GET(new NextRequest(`${BASE}?language=fr`));
      const data = await res.json();
      expect(data.streams.map((s: { stream_id: string }) => s.stream_id)).toEqual(['lang-3']);
    });

    it('returns every stream sorted by viewer count desc when no language filter is given', async () => {
      const res = await GET(new NextRequest(BASE));
      const data = await res.json();
      expect(data.streams.map((s: { stream_id: string }) => s.stream_id)).toEqual([
        'lang-1',
        'lang-4',
        'lang-2',
        'lang-3',
        'lang-5',
      ]);
    });

    it('returns 400 for an unsupported language', async () => {
      const res = await GET(new NextRequest(`${BASE}?language=de`));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Unknown language');
    });
  });
});
