import { GET } from './route';
import { NextRequest } from 'next/server';

describe('/api/routesF/twin-primes', () => {
  it('returns twin primes up to 100', async () => {
    const req = new NextRequest('http://localhost/api/routesF/twin-primes?limit=100');
    const res = await GET(req);
    const json = await res.json();
    
    expect(res.status).toBe(200);
    expect(json.count).toBe(8);
    expect(json.pairs).toContainEqual([3, 5]);
    expect(json.pairs).toContainEqual([5, 7]);
    expect(json.pairs).toContainEqual([11, 13]);
  });

  it('rejects missing limit', async () => {
    const req = new NextRequest('http://localhost/api/routesF/twin-primes');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('rejects limit out of bounds (too low)', async () => {
    const req = new NextRequest('http://localhost/api/routesF/twin-primes?limit=2');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('rejects limit out of bounds (too high)', async () => {
    const req = new NextRequest('http://localhost/api/routesF/twin-primes?limit=1000001');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('rejects invalid limit format', async () => {
    const req = new NextRequest('http://localhost/api/routesF/twin-primes?limit=abc');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});
