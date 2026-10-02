import { POST } from './route';

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/routesF/viewer-suspicion-score', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('Viewer Suspicion Score API', () => {
  it('should return 400 when viewer_id is missing', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('should return 400 when viewer_id is empty string', async () => {
    const res = await POST(makeRequest({ viewer_id: '   ' }));
    expect(res.status).toBe(400);
  });

  it('should return 404 for unknown viewer_id', async () => {
    const res = await POST(makeRequest({ viewer_id: 'does_not_exist' }));
    expect(res.status).toBe(404);
  });

  it('should return low score with no factors for a clean long-standing viewer', async () => {
    const res = await POST(makeRequest({ viewer_id: 'viewer_001' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.score).toBe(0);
    expect(data.factors).toEqual([]);
  });

  it('should flag a brand new silent account', async () => {
    const res = await POST(makeRequest({ viewer_id: 'viewer_002' }));
    const data = await res.json();
    expect(data.factors).toContain('new_account');
    expect(data.factors).toContain('silent_new_viewer');
    expect(data.score).toBeGreaterThan(0);
  });

  it('should return a high score for a viewer with many negative signals', async () => {
    const res = await POST(makeRequest({ viewer_id: 'viewer_003' }));
    const data = await res.json();
    expect(data.factors).toEqual(
      expect.arrayContaining([
        'new_account',
        'reported_by_viewers',
        'excessive_caps',
        'link_spam',
        'repetitive_messages',
      ])
    );
    expect(data.score).toBeGreaterThanOrEqual(80);
  });

  it('should cap score at 100', async () => {
    const res = await POST(makeRequest({ viewer_id: 'viewer_003' }));
    const data = await res.json();
    expect(data.score).toBeLessThanOrEqual(100);
  });

  it('should flag prior ban history independently of account age', async () => {
    const res = await POST(makeRequest({ viewer_id: 'viewer_005' }));
    const data = await res.json();
    expect(data.factors).toContain('prior_ban_history');
    expect(data.factors).not.toContain('new_account');
  });

  it('should keep score within 0-100 bounds for all seeded viewers', async () => {
    for (const id of ['viewer_001', 'viewer_002', 'viewer_003', 'viewer_004', 'viewer_005']) {
      const res = await POST(makeRequest({ viewer_id: id }));
      const data = await res.json();
      expect(data.score).toBeGreaterThanOrEqual(0);
      expect(data.score).toBeLessThanOrEqual(100);
    }
  });
});
