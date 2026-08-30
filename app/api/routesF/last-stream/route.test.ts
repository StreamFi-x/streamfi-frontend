/* eslint-disable @typescript-eslint/no-unused-vars */
import { getSeedStreams, isResumable, GET } from './route';

describe('Last Stream State', () => {
  it('identifies resumable streams correctly', () => {
    const now = Date.now();
    const tenMinsAgo = now - 10 * 60 * 1000;
    expect(isResumable(tenMinsAgo, now)).toBe(true);
  });

  it('identifies not-resumable streams correctly', () => {
    const now = Date.now();
    const twentyMinsAgo = now - 20 * 60 * 1000;
    expect(isResumable(twentyMinsAgo, now)).toBe(false);
  });

  it('handles GET request for resumable stream', async () => {
    const request = new Request('http://localhost/api/routesF/last-stream?creator_id=c1');
    const response = await GET(request);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.last_stream.title).toBe('Just chatting');
    expect(data.resumable).toBe(true);
  });

  it('handles GET request for not-resumable stream', async () => {
    const request = new Request('http://localhost/api/routesF/last-stream?creator_id=c2');
    const response = await GET(request);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.last_stream.title).toBe('Speedrun practice');
    expect(data.resumable).toBe(false);
  });

  it('returns 404 if no previous streams found', async () => {
    const request = new Request('http://localhost/api/routesF/last-stream?creator_id=unknown');
    const response = await GET(request);
    expect(response.status).toBe(404);
  });
});
