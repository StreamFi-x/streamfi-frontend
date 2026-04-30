import { POST } from './route';

describe('reverse-text route', () => {
  it('reverses by char with emojis', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ text: 'abc 🚀', mode: 'char' })
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.result).toBe('🚀 cba');
  });

  it('reverses by word preserving whitespace', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ text: 'hello   world \n test', mode: 'word' })
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.result).toBe('test   world \n hello');
  });

  it('reverses by sentence', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ text: 'Hello. How are you? I am fine.', mode: 'sentence' })
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.result).toBe('I am fine. How are you? Hello.');
  });

  it('reverses by line', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ text: 'line1\nline2\nline3', mode: 'line' })
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.result).toBe('line3\nline2\nline1');
  });
  
  it('rejects input over 1MB', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ text: 'a'.repeat(1024 * 1024 + 1), mode: 'char' })
    });
    const res = await POST(req);
    expect(res.status).toBe(413);
  });
});
