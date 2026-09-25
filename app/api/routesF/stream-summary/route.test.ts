import { GET } from './route';

describe('Stream Summary Route', () => {
  it('returns stream data for valid stream_id', async () => {
    const req = new Request('http://localhost:3000/api/routesF/stream-summary?stream_id=stream_1');
    const res = await GET(req);
    const data = await res.json();
    
    expect(res.status).toBe(200);
    expect(data).toMatchObject({
      title: 'Late Night Crypto Trading',
      creator: 'CryptoWhale',
      duration_minutes: 125,
      peak_viewers: 4500,
      top_moment_url: 'https://mux.com/v/crypto_moment1',
      cta_url: 'https://streamfi.io/cryptowhale'
    });
  });

  it('returns 400 when stream_id is missing', async () => {
    const req = new Request('http://localhost:3000/api/routesF/stream-summary');
    const res = await GET(req);
    const data = await res.json();
    
    expect(res.status).toBe(400);
    expect(data.error).toBe('Missing stream_id');
  });

  it('returns 404 for unknown stream_id', async () => {
    const req = new Request('http://localhost:3000/api/routesF/stream-summary?stream_id=unknown');
    const res = await GET(req);
    const data = await res.json();
    
    expect(res.status).toBe(404);
    expect(data.error).toBe('Stream not found');
  });
});
