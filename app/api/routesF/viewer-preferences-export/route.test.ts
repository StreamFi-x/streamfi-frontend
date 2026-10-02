import { GET, SEED_PREFERENCES } from './route';
import { NextRequest } from 'next/server';

const BASE = 'http://localhost/api/routesF/viewer-preferences-export';

describe('Viewer Preferences Export', () => {
  describe('GET /api/routesF/viewer-preferences-export', () => {
    it('should export the full preferences shape for a seeded viewer', async () => {
      const res = await GET(new NextRequest(`${BASE}?viewer_id=viewer-1`));

      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.viewer_id).toBe('viewer-1');
      expect(data.theme).toBe('dark');
      expect(data.language).toBe('en');
      expect(data.tip_currency).toBe('XLM');

      expect(data.notifications).toEqual({
        stream_live: true,
        new_follower: true,
        tips_received: true,
        email_digest: 'weekly',
      });

      expect(data.follows).toHaveLength(2);
      for (const follow of data.follows) {
        expect(typeof follow.creator_id).toBe('string');
        expect(typeof follow.followed_at).toBe('string');
        expect(typeof follow.notifications_enabled).toBe('boolean');
      }
    });

    it('should include every top-level preference key plus export_generated_at', async () => {
      const res = await GET(new NextRequest(`${BASE}?viewer_id=viewer-1`));
      const data = await res.json();

      const expectedKeys = [
        ...Object.keys(SEED_PREFERENCES['viewer-1']),
        'export_generated_at',
      ].sort();
      expect(Object.keys(data).sort()).toEqual(expectedKeys);
    });

    it('should include a valid ISO export_generated_at timestamp', async () => {
      const before = Date.now();
      const res = await GET(new NextRequest(`${BASE}?viewer_id=viewer-2`));
      const after = Date.now();
      const data = await res.json();

      const generatedAt = new Date(data.export_generated_at).getTime();
      expect(Number.isNaN(generatedAt)).toBe(false);
      expect(generatedAt).toBeGreaterThanOrEqual(before);
      expect(generatedAt).toBeLessThanOrEqual(after);
    });

    it('should export a viewer with no follows as an empty array', async () => {
      const res = await GET(new NextRequest(`${BASE}?viewer_id=viewer-2`));
      const data = await res.json();
      expect(data.follows).toEqual([]);
      expect(data.notifications.email_digest).toBe('off');
    });

    it('should return 404 for an unknown viewer', async () => {
      const res = await GET(new NextRequest(`${BASE}?viewer_id=viewer-999`));
      expect(res.status).toBe(404);
    });

    it('should return 400 when viewer_id is missing', async () => {
      const res = await GET(new NextRequest(BASE));
      expect(res.status).toBe(400);
    });
  });
});
