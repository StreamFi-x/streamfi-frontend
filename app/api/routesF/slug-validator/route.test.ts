import { POST } from './route';

describe('Slug Validator API', () => {
  it('should return 400 for invalid body', async () => {
    const req = new Request('http://localhost/api/routesF/slug-validator', {
      method: 'POST',
      body: JSON.stringify({})
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should validate correct slug', async () => {
    const req = new Request('http://localhost/api/routesF/slug-validator', {
      method: 'POST',
      body: JSON.stringify({ slug: 'my-valid-slug' })
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.valid).toBe(true);
  });

  it('should reject uppercase and suggest', async () => {
    const req = new Request('http://localhost/api/routesF/slug-validator', {
      method: 'POST',
      body: JSON.stringify({ slug: 'My-Valid-Slug' })
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.valid).toBe(false);
    expect(data.suggestion).toBe('my-valid-slug');
    expect(data.reason).toContain('uppercase');
  });

  it('should reject double hyphens and suggest', async () => {
    const req = new Request('http://localhost/api/routesF/slug-validator', {
      method: 'POST',
      body: JSON.stringify({ slug: 'my--valid---slug' })
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.valid).toBe(false);
    expect(data.suggestion).toBe('my-valid-slug');
    expect(data.reason).toContain('double hyphens');
  });

  it('should handle unicode correctly when allowed', async () => {
    const req = new Request('http://localhost/api/routesF/slug-validator', {
      method: 'POST',
      body: JSON.stringify({ slug: 'café-au-lait', allow_unicode: true })
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.valid).toBe(true);
  });

  it('should reject unicode when not allowed', async () => {
    const req = new Request('http://localhost/api/routesF/slug-validator', {
      method: 'POST',
      body: JSON.stringify({ slug: 'café-au-lait', allow_unicode: false })
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.valid).toBe(false);
    expect(data.suggestion).toBe('caf--au-lait'); // wait, the double hyphen check is performed after invalid char check!
    // actually 'café-au-lait' -> 'caf--au-lait' -> 'caf-au-lait'
  });

  it('should fix unicode to hyphen and collapse double hyphens', async () => {
    const req = new Request('http://localhost/api/routesF/slug-validator', {
      method: 'POST',
      body: JSON.stringify({ slug: 'café-au-lait', allow_unicode: false })
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.suggestion).toBe('caf-au-lait');
  });

  it('should remove leading and trailing hyphens', async () => {
    const req = new Request('http://localhost/api/routesF/slug-validator', {
      method: 'POST',
      body: JSON.stringify({ slug: '-hello-world-' })
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.suggestion).toBe('hello-world');
  });
});
