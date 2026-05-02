import { POST } from './route';

describe('hashtag-extract route', () => {
  it('extracts hashtags, mentions, urls and handles dedup/urls correctly', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        text: 'Hello @world! Check this out https://example.com/#notahashtag #cool #cool'
      })
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.urls).toContain('https://example.com/#notahashtag');
    expect(data.hashtags).toContain('#cool');
    expect(data.hashtags.length).toBe(1); // deduplication
    expect(data.hashtags).not.toContain('#notahashtag'); // excludes hashtag in url
    expect(data.mentions).toContain('@world');
  });

  it('rejects input over 100KB', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        text: 'a'.repeat(100 * 1024 + 1)
      })
    });
    const res = await POST(req);
    expect(res.status).toBe(413);
  });
});
