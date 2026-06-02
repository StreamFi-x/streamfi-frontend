import { POST } from './route';

describe('Whitespace Normalizer API', () => {
  it('should return 400 when text is missing', async () => {
    const req = new Request('http://localhost/api/routesF/whitespace-normalizer', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should collapse multiple spaces by default', async () => {
    const req = new Request('http://localhost/api/routesF/whitespace-normalizer', {
      method: 'POST',
      body: JSON.stringify({ text: 'hello    world  test' }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.result).toBe('hello world test');
  });

  it('should collapse tabs by default', async () => {
    const req = new Request('http://localhost/api/routesF/whitespace-normalizer', {
      method: 'POST',
      body: JSON.stringify({ text: 'hello\t\tworld\ttest' }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.result).toBe('hello world test');
  });

  it('should preserve newlines by default', async () => {
    const req = new Request('http://localhost/api/routesF/whitespace-normalizer', {
      method: 'POST',
      body: JSON.stringify({ text: 'line1\nline2\nline3' }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.result).toBe('line1\nline2\nline3');
  });

  it('should trim lines when trim_lines is true', async () => {
    const req = new Request('http://localhost/api/routesF/whitespace-normalizer', {
      method: 'POST',
      body: JSON.stringify({ text: '  line1  \n  line2  \n  line3  ', trim_lines: true }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.result).toBe('line1\nline2\nline3');
  });

  it('should strip blank lines when strip_blank_lines is true', async () => {
    const req = new Request('http://localhost/api/routesF/whitespace-normalizer', {
      method: 'POST',
      body: JSON.stringify({ text: 'line1\n\nline2\n\n\nline3', strip_blank_lines: true }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.result).toBe('line1\nline2\nline3');
  });

  it('should combine collapse_spaces and trim_lines', async () => {
    const req = new Request('http://localhost/api/routesF/whitespace-normalizer', {
      method: 'POST',
      body: JSON.stringify({
        text: '  hello    world  \n  foo    bar  ',
        collapse_spaces: true,
        trim_lines: true,
      }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.result).toBe('hello world\nfoo bar');
  });

  it('should combine all options', async () => {
    const req = new Request('http://localhost/api/routesF/whitespace-normalizer', {
      method: 'POST',
      body: JSON.stringify({
        text: '  hello    world  \n\n  foo    bar  \n\n  ',
        collapse_spaces: true,
        trim_lines: true,
        strip_blank_lines: true,
      }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.result).toBe('hello world\nfoo bar');
  });

  it('should handle mixed tabs and spaces', async () => {
    const req = new Request('http://localhost/api/routesF/whitespace-normalizer', {
      method: 'POST',
      body: JSON.stringify({ text: 'hello\t  \t world' }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.result).toBe('hello world');
  });
});
