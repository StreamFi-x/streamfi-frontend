import { POST } from './route';

describe('apikey-gen route', () => {
  it('generates a key with default parameters', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({})
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.keys).toBeDefined();
    expect(data.keys.length).toBe(1);
    expect(data.keys[0].key.length).toBe(32);
    expect(data.keys[0].fingerprint.length).toBe(16);
  });

  it('generates multiple keys and ensures uniqueness', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ count: 50 })
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.keys.length).toBe(50);
    const keys = data.keys.map((k: any) => k.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(50); // Uniqueness check
  });

  it('adds prefix', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ prefix: 'test' })
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.keys[0].key.startsWith('test_')).toBe(true);
  });

  it('adds checksum', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ with_checksum: true })
    });
    const res = await POST(req);
    const data = await res.json();
    const keyParts = data.keys[0].key.split('-');
    expect(keyParts.length).toBeGreaterThan(1);
    const checksum = keyParts.pop();
    expect(checksum?.length).toBe(8); // CRC32 is 8 hex chars
  });
});
