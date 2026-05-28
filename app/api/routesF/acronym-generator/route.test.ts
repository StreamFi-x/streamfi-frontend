import { POST } from './route';

describe('Acronym Generator API', () => {
  it('should return 400 when phrase is missing', async () => {
    const req = new Request('http://localhost/api/routesF/acronym-generator', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should return 400 when phrase is empty', async () => {
    const req = new Request('http://localhost/api/routesF/acronym-generator', {
      method: 'POST',
      body: JSON.stringify({ phrase: '   ' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should skip stopwords by default', async () => {
    const req = new Request('http://localhost/api/routesF/acronym-generator', {
      method: 'POST',
      body: JSON.stringify({ phrase: 'The Quick Brown Fox' }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.acronym).toBe('QBF');
    expect(data.words_used).toEqual(['quick', 'brown', 'fox']);
  });

  it('should generate acronym with stopwords when include_stopwords is true', async () => {
    const req = new Request('http://localhost/api/routesF/acronym-generator', {
      method: 'POST',
      body: JSON.stringify({ phrase: 'The Quick Brown Fox', include_stopwords: true }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.acronym).toBe('TQBF');
    expect(data.words_used).toEqual(['the', 'quick', 'brown', 'fox']);
  });

  it('should handle multiple stopwords', async () => {
    const req = new Request('http://localhost/api/routesF/acronym-generator', {
      method: 'POST',
      body: JSON.stringify({ phrase: 'as if the world is round' }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.acronym).toBe('WR');
    expect(data.words_used).toEqual(['world', 'round']);
  });

  it('should handle single word phrases', async () => {
    const req = new Request('http://localhost/api/routesF/acronym-generator', {
      method: 'POST',
      body: JSON.stringify({ phrase: 'hello' }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.acronym).toBe('H');
    expect(data.words_used).toEqual(['hello']);
  });

  it('should handle phrases with only stopwords', async () => {
    const req = new Request('http://localhost/api/routesF/acronym-generator', {
      method: 'POST',
      body: JSON.stringify({ phrase: 'the and or' }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.acronym).toBe('');
    expect(data.words_used).toEqual([]);
  });

  it('should handle extra whitespace', async () => {
    const req = new Request('http://localhost/api/routesF/acronym-generator', {
      method: 'POST',
      body: JSON.stringify({ phrase: '  Natural   Language   Processing  ' }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.acronym).toBe('NLP');
    expect(data.words_used).toEqual(['natural', 'language', 'processing']);
  });
});
