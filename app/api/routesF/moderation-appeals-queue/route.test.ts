import { GET } from './route';

describe('Moderation Appeals Queue API', () => {
  it('should return 400 when creator_id is missing', async () => {
    const req = new Request('http://localhost/api/routesF/moderation-appeals-queue');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Missing or invalid creator_id parameter');
  });

  it('should return 400 when creator_id is empty', async () => {
    const req = new Request('http://localhost/api/routesF/moderation-appeals-queue?creator_id=   ');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('should return 400 when status is invalid', async () => {
    const req = new Request('http://localhost/api/routesF/moderation-appeals-queue?creator_id=creator_001&status=invalid');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid status parameter. Must be pending or resolved');
  });

  it('should return appeals for valid creator_id', async () => {
    const req = new Request('http://localhost/api/routesF/moderation-appeals-queue?creator_id=creator_001');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.appeals).toBeDefined();
    expect(Array.isArray(data.appeals)).toBe(true);
  });

  it('should have correct appeal structure', async () => {
    const req = new Request('http://localhost/api/routesF/moderation-appeals-queue?creator_id=creator_001');
    const res = await GET(req);
    const data = await res.json();
    data.appeals.forEach((appeal: any) => {
      expect(appeal.id).toBeDefined();
      expect(appeal.creator_id).toBe('creator_001');
      expect(appeal.viewer_id).toBeDefined();
      expect(['pending', 'resolved']).toContain(appeal.status);
      expect(appeal.created_at).toBeDefined();
      expect(appeal.appeal_reason).toBeDefined();
    });
  });

  it('should filter by status pending', async () => {
    const req = new Request('http://localhost/api/routesF/moderation-appeals-queue?creator_id=creator_001&status=pending');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    data.appeals.forEach((appeal: any) => {
      expect(appeal.status).toBe('pending');
    });
  });

  it('should filter by status resolved', async () => {
    const req = new Request('http://localhost/api/routesF/moderation-appeals-queue?creator_id=creator_001&status=resolved');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    data.appeals.forEach((appeal: any) => {
      expect(appeal.status).toBe('resolved');
    });
  });

  it('should sort appeals by created_at ascending', async () => {
    const req = new Request('http://localhost/api/routesF/moderation-appeals-queue?creator_id=creator_001');
    const res = await GET(req);
    const data = await res.json();
    for (let i = 1; i < data.appeals.length; i++) {
      const prevTime = new Date(data.appeals[i - 1].created_at).getTime();
      const currTime = new Date(data.appeals[i].created_at).getTime();
      expect(prevTime).toBeLessThanOrEqual(currTime);
    }
  });

  it('should return empty array when creator has no appeals', async () => {
    const req = new Request('http://localhost/api/routesF/moderation-appeals-queue?creator_id=creator_999');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.appeals).toEqual([]);
  });

  it('should handle multiple creators independently', async () => {
    const req1 = new Request('http://localhost/api/routesF/moderation-appeals-queue?creator_id=creator_001');
    const res1 = await GET(req1);
    const data1 = await res1.json();

    const req2 = new Request('http://localhost/api/routesF/moderation-appeals-queue?creator_id=creator_002');
    const res2 = await GET(req2);
    const data2 = await res2.json();

    expect(data1.appeals.length).toBeGreaterThan(data2.appeals.length);
    data1.appeals.forEach((a: any) => expect(a.creator_id).toBe('creator_001'));
    data2.appeals.forEach((a: any) => expect(a.creator_id).toBe('creator_002'));
  });

  it('should combine filters correctly', async () => {
    const req = new Request('http://localhost/api/routesF/moderation-appeals-queue?creator_id=creator_001&status=pending');
    const res = await GET(req);
    const data = await res.json();
    data.appeals.forEach((appeal: any) => {
      expect(appeal.creator_id).toBe('creator_001');
      expect(appeal.status).toBe('pending');
    });
    for (let i = 1; i < data.appeals.length; i++) {
      const prevTime = new Date(data.appeals[i - 1].created_at).getTime();
      const currTime = new Date(data.appeals[i].created_at).getTime();
      expect(prevTime).toBeLessThanOrEqual(currTime);
    }
  });
});
