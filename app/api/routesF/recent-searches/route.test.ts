import { GET, POST, DELETE } from './route';
import { clearHistory } from './store';

describe('Recent Searches Route', () => {
  afterEach(() => {
    clearHistory('viewer_1');
  });

  it('records and returns recent searches, deduping correctly', async () => {
    // Record 'crypto'
    let req = new Request('http://localhost:3000/api/routesF/recent-searches', {
      method: 'POST',
      body: JSON.stringify({ viewer_id: 'viewer_1', query: 'crypto' })
    });
    await POST(req);

    // Record 'gaming'
    req = new Request('http://localhost:3000/api/routesF/recent-searches', {
      method: 'POST',
      body: JSON.stringify({ viewer_id: 'viewer_1', query: 'gaming' })
    });
    await POST(req);

    // Record 'crypto' again (should dedup and move to front)
    req = new Request('http://localhost:3000/api/routesF/recent-searches', {
      method: 'POST',
      body: JSON.stringify({ viewer_id: 'viewer_1', query: 'crypto' })
    });
    await POST(req);

    // Get recent searches
    req = new Request('http://localhost:3000/api/routesF/recent-searches?viewer_id=viewer_1&limit=10');
    const res = await GET(req);
    const data = await res.json();
    
    expect(res.status).toBe(200);
    expect(data.searches.length).toBe(2);
    expect(data.searches[0].query).toBe('crypto'); // Most recent
    expect(data.searches[1].query).toBe('gaming');
  });

  it('clears history', async () => {
    let req = new Request('http://localhost:3000/api/routesF/recent-searches', {
      method: 'POST',
      body: JSON.stringify({ viewer_id: 'viewer_1', query: 'crypto' })
    });
    await POST(req);

    req = new Request('http://localhost:3000/api/routesF/recent-searches?viewer_id=viewer_1', {
      method: 'DELETE'
    });
    const deleteRes = await DELETE(req);
    expect(deleteRes.status).toBe(200);

    req = new Request('http://localhost:3000/api/routesF/recent-searches?viewer_id=viewer_1');
    const getRes = await GET(req);
    const data = await getRes.json();
    expect(data.searches.length).toBe(0);
  });
});
