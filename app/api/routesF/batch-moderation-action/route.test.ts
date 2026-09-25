import { POST } from './route';

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/routesF/batch-moderation-action', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('Batch Moderation Action API', () => {
  it('should return 400 when creator_id is missing', async () => {
    const res = await POST(makeRequest({ action: 'ban', viewer_ids: ['v1'] }));
    expect(res.status).toBe(400);
  });

  it('should return 400 for an invalid action', async () => {
    const res = await POST(makeRequest({ creator_id: 'c1', action: 'mute', viewer_ids: ['v1'] }));
    expect(res.status).toBe(400);
  });

  it('should return 400 when viewer_ids is empty', async () => {
    const res = await POST(makeRequest({ creator_id: 'c1', action: 'ban', viewer_ids: [] }));
    expect(res.status).toBe(400);
  });

  it('should return 400 when viewer_ids exceeds the 100 cap', async () => {
    const viewer_ids = Array.from({ length: 101 }, (_, i) => `v${i}`);
    const res = await POST(makeRequest({ creator_id: 'c1', action: 'ban', viewer_ids }));
    expect(res.status).toBe(400);
  });

  it('should accept exactly 100 viewer_ids', async () => {
    const viewer_ids = Array.from({ length: 100 }, (_, i) => `v${i}`);
    const res = await POST(makeRequest({ creator_id: 'c1', action: 'ban', viewer_ids }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.applied_count).toBe(100);
  });

  it('should apply a ban batch without requiring duration_seconds', async () => {
    const res = await POST(
      makeRequest({ creator_id: 'c1', action: 'ban', viewer_ids: ['v1', 'v2', 'v3'], reason: 'spam' })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.applied_count).toBe(3);
  });

  it('should require duration_seconds for a timeout action', async () => {
    const res = await POST(makeRequest({ creator_id: 'c1', action: 'timeout', viewer_ids: ['v1'] }));
    expect(res.status).toBe(400);
  });

  it('should apply a timeout batch when duration_seconds is provided', async () => {
    const res = await POST(
      makeRequest({ creator_id: 'c1', action: 'timeout', viewer_ids: ['v1', 'v2'], duration_seconds: 600 })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.applied_count).toBe(2);
  });

  it('should dedupe repeated viewer_ids in applied_count', async () => {
    const res = await POST(makeRequest({ creator_id: 'c1', action: 'ban', viewer_ids: ['v1', 'v1', 'v2'] }));
    const data = await res.json();
    expect(data.applied_count).toBe(2);
  });

  it('should reject a non-positive duration_seconds for timeout', async () => {
    const res = await POST(
      makeRequest({ creator_id: 'c1', action: 'timeout', viewer_ids: ['v1'], duration_seconds: 0 })
    );
    expect(res.status).toBe(400);
  });
});
