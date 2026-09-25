import { POST, GET, reportsStore, isRateLimited, Report } from './route';

describe('Reports', () => {
  beforeEach(() => {
    reportsStore.length = 0; // Clear store before each test
  });

  it('submits a report successfully', async () => {
    const request = new Request('http://localhost/api/routesF/reports', {
      method: 'POST',
      body: JSON.stringify({
        creator_id: 'creator-1',
        reporter_id: 'viewer-1',
        reason: 'spam',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.report_id).toBeDefined();
    expect(reportsStore.length).toBe(1);
  });

  it('enforces rate limit of 3 per week', () => {
    const now = Date.now();
    const reports: Report[] = [
      { report_id: '1', creator_id: 'c1', reporter_id: 'v1', reason: 'spam', timestamp: now - 1000 },
      { report_id: '2', creator_id: 'c1', reporter_id: 'v1', reason: 'spam', timestamp: now - 2000 },
      { report_id: '3', creator_id: 'c1', reporter_id: 'v1', reason: 'spam', timestamp: now - 3000 },
    ];
    
    expect(isRateLimited(reports, 'c1', 'v1', now)).toBe(true);

    const reportsOld: Report[] = [
      { report_id: '1', creator_id: 'c1', reporter_id: 'v1', reason: 'spam', timestamp: now - 1000 },
      { report_id: '2', creator_id: 'c1', reporter_id: 'v1', reason: 'spam', timestamp: now - 2000 },
      { report_id: '3', creator_id: 'c1', reporter_id: 'v1', reason: 'spam', timestamp: now - 8 * 24 * 60 * 60 * 1000 }, // Over a week ago
    ];
    expect(isRateLimited(reportsOld, 'c1', 'v1', now)).toBe(false);
  });

  it('aggregates reports for GET', async () => {
    reportsStore.push(
      { report_id: '1', creator_id: 'c1', reporter_id: 'v1', reason: 'spam', timestamp: Date.now() },
      { report_id: '2', creator_id: 'c1', reporter_id: 'v2', reason: 'spam', timestamp: Date.now() },
      { report_id: '3', creator_id: 'c1', reporter_id: 'v3', reason: 'harassment', timestamp: Date.now() }
    );

    const request = new Request('http://localhost/api/routesF/reports?creator_id=c1');
    const response = await GET(request);
    const data = await response.json();
    
    expect(data.report_count).toBe(3);
    expect(data.top_reasons[0].reason).toBe('spam');
    expect(data.top_reasons[0].count).toBe(2);
    expect(data.top_reasons[1].reason).toBe('harassment');
    expect(data.top_reasons[1].count).toBe(1);
  });
});
