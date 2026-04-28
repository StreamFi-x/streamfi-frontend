import { GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS } from '../route';
import { NextRequest } from 'next/server';

function createMockRequest(
  method: string,
  url: string,
  options?: {
    headers?: Record<string, string>;
    body?: string;
    contentType?: string;
  }
): NextRequest {
  return new NextRequest(url, {
    method,
    headers: {
      'Content-Type': options?.contentType || 'application/json',
      ...options?.headers,
    },
    body: options?.body,
  });
}

describe('Echo endpoint', () => {
  describe('HTTP methods', () => {
    it('handles GET requests', async () => {
      const req = createMockRequest('GET', 'http://localhost/api/routes-f/echo?foo=bar');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.method).toBe('GET');
    });

    it('handles POST requests', async () => {
      const req = createMockRequest('POST', 'http://localhost/api/routes-f/echo', {
        body: JSON.stringify({ test: 'data' }),
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.method).toBe('POST');
    });

    it('handles PUT requests', async () => {
      const req = createMockRequest('PUT', 'http://localhost/api/routes-f/echo', {
        body: JSON.stringify({ id: 1 }),
      });
      const res = await PUT(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.method).toBe('PUT');
    });

    it('handles DELETE requests', async () => {
      const req = createMockRequest('DELETE', 'http://localhost/api/routes-f/echo?id=123');
      const res = await DELETE(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.method).toBe('DELETE');
    });

    it('handles PATCH requests', async () => {
      const req = createMockRequest('PATCH', 'http://localhost/api/routes-f/echo', {
        body: JSON.stringify({ patch: true }),
      });
      const res = await PATCH(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.method).toBe('PATCH');
    });

    it('handles HEAD requests', async () => {
      const req = createMockRequest('HEAD', 'http://localhost/api/routes-f/echo');
      const res = await HEAD(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.method).toBe('HEAD');
    });

    it('handles OPTIONS requests', async () => {
      const req = createMockRequest('OPTIONS', 'http://localhost/api/routes-f/echo');
      const res = await OPTIONS(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.method).toBe('OPTIONS');
    });
  });

  describe('Header redaction', () => {
    it('redacts authorization header', async () => {
      const req = createMockRequest('GET', 'http://localhost/api/routes-f/echo', {
        headers: { authorization: 'Bearer secret-token-123' },
      });
      const res = await GET(req);
      const data = await res.json();

      expect(data.headers.authorization).toBe('[REDACTED]');
    });

    it('redacts cookie header', async () => {
      const req = createMockRequest('GET', 'http://localhost/api/routes-f/echo', {
        headers: { cookie: 'session=abc123; user=john' },
      });
      const res = await GET(req);
      const data = await res.json();

      expect(data.headers.cookie).toBe('[REDACTED]');
    });

    it('redacts set-cookie header', async () => {
      const req = createMockRequest('GET', 'http://localhost/api/routes-f/echo', {
        headers: { 'set-cookie': 'session=abc; Path=/' },
      });
      const res = await GET(req);
      const data = await res.json();

      expect(data.headers['set-cookie']).toBe('[REDACTED]');
    });

    it('redacts proxy-authorization header', async () => {
      const req = createMockRequest('GET', 'http://localhost/api/routes-f/echo', {
        headers: { 'proxy-authorization': 'Basic secret' },
      });
      const res = await GET(req);
      const data = await res.json();

      expect(data.headers['proxy-authorization']).toBe('[REDACTED]');
    });

    it('redacts headers starting with x-api-', async () => {
      const req = createMockRequest('GET', 'http://localhost/api/routes-f/echo', {
        headers: {
          'x-api-key': 'super-secret-key',
          'x-api-secret': 'another-secret',
          'x-api-version': 'v1',
        },
      });
      const res = await GET(req);
      const data = await res.json();

      expect(data.headers['x-api-key']).toBe('[REDACTED]');
      expect(data.headers['x-api-secret']).toBe('[REDACTED]');
      expect(data.headers['x-api-version']).toBe('[REDACTED]');
    });

    it('does not redact safe headers', async () => {
      const req = createMockRequest('GET', 'http://localhost/api/routes-f/echo', {
        headers: {
          'content-type': 'application/json',
          'accept': 'application/json',
          'user-agent': 'test-agent',
        },
      });
      const res = await GET(req);
      const data = await res.json();

      expect(data.headers['content-type']).toBe('application/json');
      expect(data.headers['accept']).toBe('application/json');
      expect(data.headers['user-agent']).toBe('test-agent');
    });

    it('handles mixed redacted and non-redacted headers', async () => {
      const req = createMockRequest('GET', 'http://localhost/api/routes-f/echo', {
        headers: {
          'authorization': 'Bearer token',
          'content-type': 'application/json',
          'x-api-key': 'secret',
          'accept': '*/*',
        },
      });
      const res = await GET(req);
      const data = await res.json();

      expect(data.headers.authorization).toBe('[REDACTED]');
      expect(data.headers['content-type']).toBe('application/json');
      expect(data.headers['x-api-key']).toBe('[REDACTED]');
      expect(data.headers.accept).toBe('*/*');
    });
  });

  describe('Query parameters', () => {
    it('echoes single query parameter', async () => {
      const req = createMockRequest('GET', 'http://localhost/api/routes-f/echo?foo=bar');
      const res = await GET(req);
      const data = await res.json();

      expect(data.query.foo).toBe('bar');
    });

    it('echoes multiple query parameters', async () => {
      const req = createMockRequest('GET', 'http://localhost/api/routes-f/echo?a=1&b=2&c=3');
      const res = await GET(req);
      const data = await res.json();

      expect(data.query.a).toBe('1');
      expect(data.query.b).toBe('2');
      expect(data.query.c).toBe('3');
    });

    it('echoes repeated query parameters as array', async () => {
      const req = createMockRequest('GET', 'http://localhost/api/routes-f/echo?tag=foo&tag=bar');
      const res = await GET(req);
      const data = await res.json();

      expect(Array.isArray(data.query.tag)).toBe(true);
      expect(data.query.tag).toEqual(['foo', 'bar']);
    });

    it('returns empty query when no params', async () => {
      const req = createMockRequest('GET', 'http://localhost/api/routes-f/echo');
      const res = await GET(req);
      const data = await res.json();

      expect(data.query).toEqual({});
    });
  });

  describe('Body handling', () => {
    it('parses JSON body', async () => {
      const req = createMockRequest('POST', 'http://localhost/api/routes-f/echo', {
        body: JSON.stringify({ name: 'John', age: 30 }),
        contentType: 'application/json',
      });
      const res = await POST(req);
      const data = await res.json();

      expect(data.body).toEqual({ name: 'John', age: 30 });
    });

    it('returns non-JSON body as string', async () => {
      const req = createMockRequest('POST', 'http://localhost/api/routes-f/echo', {
        body: 'plain text body',
        contentType: 'text/plain',
      });
      const res = await POST(req);
      const data = await res.json();

      expect(data.body).toBe('plain text body');
    });

    it('returns null body for GET requests', async () => {
      const req = createMockRequest('GET', 'http://localhost/api/routes-f/echo');
      const res = await GET(req);
      const data = await res.json();

      expect(data.body).toBeNull();
    });

    it('returns null body for empty POST', async () => {
      const req = createMockRequest('POST', 'http://localhost/api/routes-f/echo', {
        body: '',
        contentType: 'application/json',
      });
      const res = await POST(req);
      const data = await res.json();

      expect(data.body).toBeNull();
    });

    it('handles invalid JSON with JSON content-type', async () => {
      const req = createMockRequest('POST', 'http://localhost/api/routes-f/echo', {
        body: '{"invalid json',
        contentType: 'application/json',
      });
      const res = await POST(req);
      const data = await res.json();

      expect(data.body).toBe('{"invalid json');
    });
  });

  describe('Body size cap (10 KB)', () => {
    it('truncates body exceeding 10 KB', async () => {
      const largeBody = 'x'.repeat(11 * 1024); // 11 KB
      const req = createMockRequest('POST', 'http://localhost/api/routes-f/echo', {
        body: largeBody,
        contentType: 'text/plain',
      });
      const res = await POST(req);
      const data = await res.json();

      expect(data.truncated).toBe(true);
      expect(typeof data.body).toBe('string');
      expect(data.body.length).toBeLessThanOrEqual(10 * 1024 + 15); // cap + marker
      expect(data.body).toContain('...[truncated]');
    });

    it('does not truncate body under 10 KB', async () => {
      const body = 'x'.repeat(5 * 1024); // 5 KB
      const req = createMockRequest('POST', 'http://localhost/api/routes-f/echo', {
        body,
        contentType: 'text/plain',
      });
      const res = await POST(req);
      const data = await res.json();

      expect(data.truncated).toBeUndefined();
      expect(data.body).toBe(body);
    });

    it('truncates body at exactly 10 KB boundary', async () => {
      const body = 'x'.repeat(10 * 1024 + 1); // Just over 10 KB
      const req = createMockRequest('POST', 'http://localhost/api/routes-f/echo', {
        body,
        contentType: 'text/plain',
      });
      const res = await POST(req);
      const data = await res.json();

      expect(data.truncated).toBe(true);
    });
  });

  describe('Response structure', () => {
    it('includes all required fields', async () => {
      const req = createMockRequest('GET', 'http://localhost/api/routes-f/echo?test=1');
      const res = await GET(req);
      const data = await res.json();

      expect(data).toHaveProperty('method');
      expect(data).toHaveProperty('headers');
      expect(data).toHaveProperty('query');
      expect(data).toHaveProperty('body');
      expect(data).toHaveProperty('url');
      expect(data).toHaveProperty('timestamp');
    });

    it('includes full URL', async () => {
      const req = createMockRequest('GET', 'http://localhost/api/routes-f/echo?foo=bar');
      const res = await GET(req);
      const data = await res.json();

      expect(data.url).toBe('http://localhost/api/routes-f/echo?foo=bar');
    });

    it('includes ISO timestamp', async () => {
      const req = createMockRequest('GET', 'http://localhost/api/routes-f/echo');
      const res = await GET(req);
      const data = await res.json();

      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('Nested JSON body', () => {
    it('echoes nested JSON objects', async () => {
      const body = {
        user: {
          name: 'John',
          address: {
            city: 'NYC',
            zip: '10001',
          },
        },
        tags: ['admin', 'user'],
      };
      const req = createMockRequest('POST', 'http://localhost/api/routes-f/echo', {
        body: JSON.stringify(body),
        contentType: 'application/json',
      });
      const res = await POST(req);
      const data = await res.json();

      expect(data.body).toEqual(body);
    });

    it('echoes array body', async () => {
      const req = createMockRequest('POST', 'http://localhost/api/routes-f/echo', {
        body: JSON.stringify([1, 2, 3]),
        contentType: 'application/json',
      });
      const res = await POST(req);
      const data = await res.json();

      expect(data.body).toEqual([1, 2, 3]);
    });
  });
});