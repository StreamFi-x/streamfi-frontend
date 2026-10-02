import { POST } from './route';

describe('QR Payload Builder API', () => {
  it('should return 400 when type is missing', async () => {
    const req = new Request('http://localhost/api/routesF/qr-payload-builder', {
      method: 'POST',
      body: JSON.stringify({ data: {} }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid type', async () => {
    const req = new Request('http://localhost/api/routesF/qr-payload-builder', {
      method: 'POST',
      body: JSON.stringify({ type: 'invalid', data: {} }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should build WiFi payload', async () => {
    const req = new Request('http://localhost/api/routesF/qr-payload-builder', {
      method: 'POST',
      body: JSON.stringify({
        type: 'wifi',
        data: { ssid: 'MyNetwork', password: 'secure123' },
      }),
    });
    const res = await POST(req);
    const result = await res.json();
    expect(result.payload).toBe('WIFI:T:WPA;S:MyNetwork;P:secure123;;');
  });

  it('should build WiFi payload with custom security', async () => {
    const req = new Request('http://localhost/api/routesF/qr-payload-builder', {
      method: 'POST',
      body: JSON.stringify({
        type: 'wifi',
        data: { ssid: 'OpenWifi', password: 'pass', security: 'NOPASS' },
      }),
    });
    const res = await POST(req);
    const result = await res.json();
    expect(result.payload).toBe('WIFI:T:NOPASS;S:OpenWifi;P:pass;;');
  });

  it('should build vCard payload with full details', async () => {
    const req = new Request('http://localhost/api/routesF/qr-payload-builder', {
      method: 'POST',
      body: JSON.stringify({
        type: 'vcard',
        data: {
          firstName: 'John',
          lastName: 'Doe',
          phone: '1234567890',
          email: 'john@example.com',
          organization: 'Acme Corp',
          url: 'https://example.com',
        },
      }),
    });
    const res = await POST(req);
    const result = await res.json();
    expect(result.payload).toContain('BEGIN:VCARD');
    expect(result.payload).toContain('END:VCARD');
    expect(result.payload).toContain('FN:John Doe');
    expect(result.payload).toContain('TEL:1234567890');
    expect(result.payload).toContain('EMAIL:john@example.com');
    expect(result.payload).toContain('ORG:Acme Corp');
    expect(result.payload).toContain('URL:https://example.com');
  });

  it('should build vCard payload with minimal details', async () => {
    const req = new Request('http://localhost/api/routesF/qr-payload-builder', {
      method: 'POST',
      body: JSON.stringify({
        type: 'vcard',
        data: { firstName: 'Jane', lastName: 'Smith' },
      }),
    });
    const res = await POST(req);
    const result = await res.json();
    expect(result.payload).toContain('FN:Jane Smith');
    expect(result.payload).toContain('BEGIN:VCARD');
  });

  it('should build URL payload', async () => {
    const req = new Request('http://localhost/api/routesF/qr-payload-builder', {
      method: 'POST',
      body: JSON.stringify({
        type: 'url',
        data: { url: 'https://example.com/page' },
      }),
    });
    const res = await POST(req);
    const result = await res.json();
    expect(result.payload).toBe('https://example.com/page');
  });

  it('should build geo payload without altitude', async () => {
    const req = new Request('http://localhost/api/routesF/qr-payload-builder', {
      method: 'POST',
      body: JSON.stringify({
        type: 'geo',
        data: { latitude: 40.7128, longitude: -74.006 },
      }),
    });
    const res = await POST(req);
    const result = await res.json();
    expect(result.payload).toBe('geo:40.7128,-74.006');
  });

  it('should build geo payload with altitude', async () => {
    const req = new Request('http://localhost/api/routesF/qr-payload-builder', {
      method: 'POST',
      body: JSON.stringify({
        type: 'geo',
        data: { latitude: 40.7128, longitude: -74.006, altitude: 10 },
      }),
    });
    const res = await POST(req);
    const result = await res.json();
    expect(result.payload).toBe('geo:40.7128,-74.006,10');
  });

  it('should handle case-insensitive type', async () => {
    const req = new Request('http://localhost/api/routesF/qr-payload-builder', {
      method: 'POST',
      body: JSON.stringify({
        type: 'WIFI',
        data: { ssid: 'Network', password: 'pass123' },
      }),
    });
    const res = await POST(req);
    const result = await res.json();
    expect(result.payload).toContain('WIFI:');
  });
});
