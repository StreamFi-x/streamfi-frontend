import { NextRequest } from 'next/server';
import { GET, PUT } from './route';
import { __resetQuietHoursStore } from './store';

const BASE = 'http://localhost/api/routesF/quiet-hours-notification-config';

function makeGet(params: Record<string, string> = {}) {
  const url = new URL(BASE);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

function makePut(body: unknown) {
  return new NextRequest(BASE, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Quiet Hours Notification Config', () => {
  beforeEach(() => {
    __resetQuietHoursStore();
  });

  describe('GET', () => {
    it('returns the default config for a viewer with nothing saved', async () => {
      const res = await GET(makeGet({ viewer_id: 'v1' }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({
        viewer_id: 'v1',
        start_hour: 22,
        end_hour: 8,
        timezone: 'UTC',
        enabled: false,
      });
    });

    it('returns 400 when viewer_id is missing', async () => {
      expect((await GET(makeGet())).status).toBe(400);
    });
  });

  describe('PUT', () => {
    it('saves and returns the updated config', async () => {
      const res = await PUT(
        makePut({ viewer_id: 'v1', start_hour: 23, end_hour: 7, timezone: 'America/New_York', enabled: true })
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({
        viewer_id: 'v1',
        start_hour: 23,
        end_hour: 7,
        timezone: 'America/New_York',
        enabled: true,
      });

      const getRes = await GET(makeGet({ viewer_id: 'v1' }));
      expect(await getRes.json()).toEqual(data);
    });

    it('rejects a missing viewer_id', async () => {
      const res = await PUT(makePut({ start_hour: 1, end_hour: 2, timezone: 'UTC', enabled: true }));
      expect(res.status).toBe(400);
    });

    it('rejects an out-of-range start_hour', async () => {
      const res = await PUT(
        makePut({ viewer_id: 'v1', start_hour: 24, end_hour: 8, timezone: 'UTC', enabled: true })
      );
      expect(res.status).toBe(400);
    });

    it('rejects a non-integer end_hour', async () => {
      const res = await PUT(
        makePut({ viewer_id: 'v1', start_hour: 22, end_hour: 8.5, timezone: 'UTC', enabled: true })
      );
      expect(res.status).toBe(400);
    });

    it('rejects an invalid timezone', async () => {
      const res = await PUT(
        makePut({ viewer_id: 'v1', start_hour: 22, end_hour: 8, timezone: 'Not/A_Zone', enabled: true })
      );
      expect(res.status).toBe(400);
    });

    it('rejects a non-boolean enabled', async () => {
      const res = await PUT(
        makePut({ viewer_id: 'v1', start_hour: 22, end_hour: 8, timezone: 'UTC', enabled: 'yes' })
      );
      expect(res.status).toBe(400);
    });

    it('rejects malformed JSON with 400', async () => {
      const req = new NextRequest(BASE, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: '{broken',
      });
      expect((await PUT(req)).status).toBe(400);
    });
  });
});
