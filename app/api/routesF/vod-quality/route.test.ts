import { GET } from './route';
import { POST as SELECT } from './select/route';
import { QUALITY_SELECTIONS } from './store';
import { NextRequest } from 'next/server';

const BASE = 'http://localhost/api/routesF/vod-quality';

function selectReq(body: unknown) {
  return new NextRequest(`${BASE}/select`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('VOD Quality Selection', () => {
  beforeEach(() => {
    for (const key in QUALITY_SELECTIONS) {
      delete QUALITY_SELECTIONS[key];
    }
  });

  describe('GET /api/routesF/vod-quality', () => {
    it('should list available qualities for a VOD', async () => {
      const res = await GET(new NextRequest(`${BASE}?playback_id=vod-raid-recap`));

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.qualities).toHaveLength(4);
      expect(data.qualities[0]).toEqual({
        label: '1080p',
        resolution: '1920x1080',
        bitrate_kbps: 5000,
      });
      for (const q of data.qualities) {
        expect(typeof q.label).toBe('string');
        expect(typeof q.resolution).toBe('string');
        expect(typeof q.bitrate_kbps).toBe('number');
      }
    });

    it('should return 404 for an unknown VOD', async () => {
      const res = await GET(new NextRequest(`${BASE}?playback_id=vod-missing`));
      expect(res.status).toBe(404);
    });

    it('should return 400 when playback_id is missing', async () => {
      const res = await GET(new NextRequest(BASE));
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/routesF/vod-quality/select', () => {
    it('should save a viewer quality choice', async () => {
      const res = await SELECT(
        selectReq({ viewer_id: 'viewer-1', playback_id: 'vod-raid-recap', label: '720p' })
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        viewer_id: 'viewer-1',
        playback_id: 'vod-raid-recap',
        label: '720p',
      });
      expect(QUALITY_SELECTIONS['viewer-1']['vod-raid-recap']).toBe('720p');
    });

    it('should overwrite a previous choice for the same VOD', async () => {
      await SELECT(
        selectReq({ viewer_id: 'viewer-1', playback_id: 'vod-raid-recap', label: '1080p' })
      );
      await SELECT(
        selectReq({ viewer_id: 'viewer-1', playback_id: 'vod-raid-recap', label: '360p' })
      );

      expect(QUALITY_SELECTIONS['viewer-1']['vod-raid-recap']).toBe('360p');
    });

    it('should reject a label the VOD does not offer', async () => {
      const res = await SELECT(
        selectReq({ viewer_id: 'viewer-1', playback_id: 'vod-speedrun-finals', label: '1080p' })
      );

      expect(res.status).toBe(400);
      expect(QUALITY_SELECTIONS['viewer-1']).toBeUndefined();
    });

    it('should return 404 for an unknown VOD', async () => {
      const res = await SELECT(
        selectReq({ viewer_id: 'viewer-1', playback_id: 'vod-missing', label: '720p' })
      );
      expect(res.status).toBe(404);
    });

    it('should return 400 when required fields are missing', async () => {
      expect(
        (await SELECT(selectReq({ playback_id: 'vod-raid-recap', label: '720p' }))).status
      ).toBe(400);
      expect(
        (await SELECT(selectReq({ viewer_id: 'viewer-1', label: '720p' }))).status
      ).toBe(400);
      expect(
        (await SELECT(selectReq({ viewer_id: 'viewer-1', playback_id: 'vod-raid-recap' }))).status
      ).toBe(400);
    });

    it('should return 400 for invalid JSON', async () => {
      const req = new NextRequest(`${BASE}/select`, { method: 'POST', body: 'not-json' });
      const res = await SELECT(req);
      expect(res.status).toBe(400);
    });
  });
});
