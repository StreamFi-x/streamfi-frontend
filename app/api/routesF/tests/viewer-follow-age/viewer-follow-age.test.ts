/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '../../viewer-follow-age/route';
import { followRepository } from '../../shared/repositories';

function createGetRequest(viewerId: string): NextRequest {
  return new NextRequest(`http://localhost/api/routesF/viewer-follow-age?viewer_id=${viewerId}`);
}

describe('Viewer Follow Age API', () => {
  beforeEach(() => {
    followRepository.clear();
  });

  describe('GET /api/routesF/viewer-follow-age', () => {
    it('returns follow age summary for a viewer with follows', async () => {
      // Seed test data with follows at different times
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      followRepository.seed([
        {
          id: 'flw_001',
          viewer_id: 'test_viewer_001',
          creator_id: 'creator_001',
          followed_at: ninetyDaysAgo.toISOString(), // Oldest: 90 days
        },
        {
          id: 'flw_002',
          viewer_id: 'test_viewer_001',
          creator_id: 'creator_002',
          followed_at: thirtyDaysAgo.toISOString(), // 30 days
        },
        {
          id: 'flw_003',
          viewer_id: 'test_viewer_001',
          creator_id: 'creator_003',
          followed_at: sixtyDaysAgo.toISOString(), // 60 days
        },
      ]);

      const request = createGetRequest('test_viewer_001');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toEqual({
        follows_count: 3,
        avg_follow_age_days: expect.any(Number), // Should be around (90+30+60)/3 = 60
        oldest_follow_at: ninetyDaysAgo.toISOString(),
      });

      // Verify calculation is reasonable
      expect(data.data.avg_follow_age_days).toBeGreaterThan(50);
      expect(data.data.avg_follow_age_days).toBeLessThan(70);
    });

    it('returns zero values for viewer with no follows', async () => {
      followRepository.seed([
        {
          id: 'flw_001',
          viewer_id: 'other_viewer',
          creator_id: 'creator_001',
          followed_at: new Date().toISOString(),
        },
      ]);

      const request = createGetRequest('test_viewer_empty');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toEqual({
        follows_count: 0,
        avg_follow_age_days: 0,
        oldest_follow_at: null,
      });
    });

    it('requires viewer_id parameter', async () => {
      const request = createGetRequest('');
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('viewer_id');
    });

    it('handles single follow correctly', async () => {
      const followDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000); // 45 days ago

      followRepository.seed([
        {
          id: 'flw_001',
          viewer_id: 'test_viewer_single',
          creator_id: 'creator_001',
          followed_at: followDate.toISOString(),
        },
      ]);

      const request = createGetRequest('test_viewer_single');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toEqual({
        follows_count: 1,
        avg_follow_age_days: expect.any(Number), // Should be around 45
        oldest_follow_at: followDate.toISOString(),
      });

      // Average should equal the single follow age
      expect(data.data.avg_follow_age_days).toBeGreaterThan(40);
      expect(data.data.avg_follow_age_days).toBeLessThan(50);
    });

    it('correctly calculates average with varied follow dates', async () => {
      const now = new Date();
      const dates = [
        new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days
        new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000), // 20 days
        new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days
        new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000), // 40 days
      ];

      followRepository.seed(dates.map((date, index) => ({
        id: `flw_${index + 1}`,
        viewer_id: 'test_viewer_varied',
        creator_id: `creator_${index + 1}`,
        followed_at: date.toISOString(),
      })));

      const request = createGetRequest('test_viewer_varied');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      
      // (10 + 20 + 30 + 40) / 4 = 25
      expect(data.data.follows_count).toBe(4);
      expect(data.data.avg_follow_age_days).toBeGreaterThan(20);
      expect(data.data.avg_follow_age_days).toBeLessThan(30);
      expect(data.data.oldest_follow_at).toBe(dates[3].toISOString()); // 40 days ago is oldest
    });

    it('handles very old follows correctly', async () => {
      const veryOldDate = new Date('2020-01-01T00:00:00Z');
      const recentDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

      followRepository.seed([
        {
          id: 'flw_old',
          viewer_id: 'test_viewer_old',
          creator_id: 'creator_001',
          followed_at: veryOldDate.toISOString(),
        },
        {
          id: 'flw_recent',
          viewer_id: 'test_viewer_old',
          creator_id: 'creator_002',
          followed_at: recentDate.toISOString(),
        },
      ]);

      const request = createGetRequest('test_viewer_old');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.follows_count).toBe(2);
      expect(data.data.oldest_follow_at).toBe(veryOldDate.toISOString());
      // Average should be heavily weighted by the very old follow
      expect(data.data.avg_follow_age_days).toBeGreaterThan(100);
    });
  });
});