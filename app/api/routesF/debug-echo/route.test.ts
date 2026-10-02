import { POST, MAX_PAYLOAD_BYTES } from './route';
import { NextRequest } from 'next/server';

const BASE = 'http://localhost/api/routesF/debug-echo';

function echoReq(body: string, headers?: Record<string, string>) {
  return new NextRequest(BASE, { method: 'POST', body, headers });
}

describe('Debug Echo Endpoint', () => {
  describe('POST /api/routesF/debug-echo', () => {
    it('should echo the JSON payload back with a timestamp', async () => {
      const payload = { hello: 'world', nested: { count: 3 }, list: [1, 2, 3] };
      const res = await POST(echoReq(JSON.stringify(payload)));

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.received).toEqual(payload);
      expect(Number.isNaN(new Date(data.timestamp).getTime())).toBe(false);
    });

    it('should include only allow-listed headers', async () => {
      const res = await POST(
        echoReq(JSON.stringify({ ping: true }), {
          'content-type': 'application/json',
          'user-agent': 'streamfi-test/1.0',
          'x-request-id': 'req-42',
          authorization: 'Bearer super-secret',
          cookie: 'session=abc123',
        })
      );

      const data = await res.json();
      expect(data.headers['content-type']).toBe('application/json');
      expect(data.headers['user-agent']).toBe('streamfi-test/1.0');
      expect(data.headers['x-request-id']).toBe('req-42');
      expect(data.headers.authorization).toBeUndefined();
      expect(data.headers.cookie).toBeUndefined();
    });

    it('should omit allow-listed headers that were not sent', async () => {
      const res = await POST(echoReq(JSON.stringify({}), {}));
      const data = await res.json();
      expect(data.headers['x-request-id']).toBeUndefined();
    });

    it('should echo primitive JSON payloads', async () => {
      const res = await POST(echoReq('"just a string"'));
      const data = await res.json();
      expect(data.received).toBe('just a string');
    });

    it('should treat an empty body as null', async () => {
      const res = await POST(echoReq(''));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.received).toBeNull();
    });

    it('should reject a payload over 100KB with 413', async () => {
      const big = JSON.stringify({ blob: 'x'.repeat(MAX_PAYLOAD_BYTES) });
      const res = await POST(echoReq(big));
      expect(res.status).toBe(413);
    });

    it('should accept a payload just under the cap', async () => {
      const padding = MAX_PAYLOAD_BYTES - JSON.stringify({ blob: '' }).length - 100;
      const res = await POST(echoReq(JSON.stringify({ blob: 'x'.repeat(padding) })));
      expect(res.status).toBe(200);
    });

    it('should return 400 for invalid JSON', async () => {
      const res = await POST(echoReq('{not json'));
      expect(res.status).toBe(400);
    });
  });
});
