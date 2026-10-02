import { extractKeywords, POST } from './route';

describe('Keyword Extraction', () => {
  it('extracts keywords correctly', () => {
    const title = 'The BEST and most AMAZING stream for YOU! 123';
    const keywords = extractKeywords(title);
    
    expect(keywords).toContain('best');
    expect(keywords).toContain('most');
    expect(keywords).toContain('amazing');
    expect(keywords).toContain('stream');
    expect(keywords).toContain('123');

    // Should exclude stop words and short words
    expect(keywords).not.toContain('the');
    expect(keywords).not.toContain('and');
    expect(keywords).not.toContain('for');
    expect(keywords).not.toContain('you');
  });

  it('handles POST request', async () => {
    const request = new Request('http://localhost/api/routesF/keywords', {
      method: 'POST',
      body: JSON.stringify({ title: 'Hello world stream' })
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.keywords).toEqual(expect.arrayContaining(['hello', 'world', 'stream']));
  });
});
