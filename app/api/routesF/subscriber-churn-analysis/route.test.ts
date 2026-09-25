import { GET } from './route';

describe('Subscriber Churn Analysis API', () => {
  it('should return 400 when creator_id is missing', async () => {
    const req = new Request('http://localhost/api/routesF/subscriber-churn-analysis');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Missing or invalid creator_id parameter');
  });

  it('should return 400 when creator_id is empty', async () => {
    const req = new Request('http://localhost/api/routesF/subscriber-churn-analysis?creator_id=   ');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('should return 400 when window_days is invalid', async () => {
    const req = new Request('http://localhost/api/routesF/subscriber-churn-analysis?creator_id=creator_001&window_days=invalid');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid window_days parameter');
  });

  it('should return 400 when window_days is negative', async () => {
    const req = new Request('http://localhost/api/routesF/subscriber-churn-analysis?creator_id=creator_001&window_days=-5');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('should return 400 when window_days is zero', async () => {
    const req = new Request('http://localhost/api/routesF/subscriber-churn-analysis?creator_id=creator_001&window_days=0');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('should use default window_days of 30 when not provided', async () => {
    const req = new Request('http://localhost/api/routesF/subscriber-churn-analysis?creator_id=creator_001');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.churn_rate_percent).toBeDefined();
    expect(data.cancellation_reasons).toBeDefined();
  });

  it('should return churn metrics for valid creator_id', async () => {
    const req = new Request('http://localhost/api/routesF/subscriber-churn-analysis?creator_id=creator_001');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.churn_rate_percent).toBe('number');
    expect(data.churn_rate_percent).toBeGreaterThanOrEqual(0);
    expect(data.churn_rate_percent).toBeLessThanOrEqual(100);
    expect(typeof data.cancellation_reasons).toBe('object');
  });

  it('should include cancellation reason breakdown', async () => {
    const req = new Request('http://localhost/api/routesF/subscriber-churn-analysis?creator_id=creator_001&window_days=30');
    const res = await GET(req);
    const data = await res.json();
    const reasons = data.cancellation_reasons;
    expect(Object.keys(reasons).length).toBeGreaterThan(0);
    Object.values(reasons).forEach((count: any) => {
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThan(0);
    });
  });

  it('should respect window_days parameter', async () => {
    const req7 = new Request('http://localhost/api/routesF/subscriber-churn-analysis?creator_id=creator_001&window_days=7');
    const res7 = await GET(req7);
    const data7 = await res7.json();

    const req30 = new Request('http://localhost/api/routesF/subscriber-churn-analysis?creator_id=creator_001&window_days=30');
    const res30 = await GET(req30);
    const data30 = await res30.json();

    expect(data7.churn_rate_percent).toBeLessThanOrEqual(data30.churn_rate_percent);
  });

  it('should return empty reasons for creator with no cancellations in window', async () => {
    const req = new Request('http://localhost/api/routesF/subscriber-churn-analysis?creator_id=creator_999&window_days=30');
    const res = await GET(req);
    const data = await res.json();
    expect(data.churn_rate_percent).toBe(0);
    expect(Object.keys(data.cancellation_reasons).length).toBe(0);
  });

  it('should verify churn math with known seed data', async () => {
    const req = new Request('http://localhost/api/routesF/subscriber-churn-analysis?creator_id=creator_001&window_days=30');
    const res = await GET(req);
    const data = await res.json();
    const totalReasons = Object.values(data.cancellation_reasons).reduce((sum: number, count: any) => sum + count, 0);
    const calculatedChurn = (totalReasons / 100) * 100;
    expect(Math.abs(calculatedChurn - data.churn_rate_percent)).toBeLessThan(0.01);
  });
});
