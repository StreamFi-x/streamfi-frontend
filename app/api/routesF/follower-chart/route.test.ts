import { GET } from './route';

describe('Follower Chart Route', () => {
  it('returns zero-filled series for given days', async () => {
    const req = new Request('http://localhost:3000/api/routesF/follower-chart?creator_id=creator_1&days=7');
    const res = await GET(req);
    const data = await res.json();
    
    expect(res.status).toBe(200);
    expect(data.series).toBeDefined();
    expect(data.series.length).toBe(7); // 7 days of data
    
    // Verify zero fill on today (no seed events for exactly today if today's date doesn't match)
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    
    const todayEntry = data.series.find((s: any) => s.date === todayStr);
    expect(todayEntry).toBeDefined();
    expect(todayEntry.gained).toBe(0);
    expect(todayEntry.lost).toBe(0);
    expect(todayEntry.net).toBe(0);
  });

  it('aggregates events correctly', async () => {
    const req = new Request('http://localhost:3000/api/routesF/follower-chart?creator_id=creator_1&days=7');
    const res = await GET(req);
    const data = await res.json();
    
    // Find a day that has seed data (e.g. 2 days ago)
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    twoDaysAgo.setHours(12, 0, 0, 0);
    const dateStr = twoDaysAgo.toISOString().split('T')[0];
    
    const entry = data.series.find((s: any) => s.date === dateStr);
    expect(entry).toBeDefined();
    expect(entry.gained).toBe(3); // 3 follow events in seed data
    expect(entry.lost).toBe(0);
    expect(entry.net).toBe(3);
  });
});
