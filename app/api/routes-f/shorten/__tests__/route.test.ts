/**
 * @jest-environment jsdom
 */

import { POST } from '../route';
import { GET } from '../[code]/route';
import { NextRequest } from 'next/server';
import { UrlStorage } from '../_lib/storage';

// Mock the storage to reset between tests
jest.mock('../_lib/storage', () => {
  const originalModule = jest.requireActual('../_lib/storage');
  return {
    ...originalModule,
    UrlStorage: {
      ...originalModule.UrlStorage,
      clear: jest.fn(originalModule.UrlStorage.clear),
      set: jest.fn(originalModule.UrlStorage.set),
      get: jest.fn(originalModule.UrlStorage.get),
      has: jest.fn(originalModule.UrlStorage.has),
      incrementHits: jest.fn(originalModule.UrlStorage.incrementHits),
    }
  };
});

describe('/api/routes-f/shorten', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    UrlStorage.clear();
  });

  describe('POST /api/routes-f/shorten', () => {
    it('should create a short URL for valid HTTP URL', async () => {
      const requestBody = { url: 'http://example.com' };
      const request = new NextRequest('http://localhost:3000/api/routes-f/shorten', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toHaveProperty('code');
      expect(data).toHaveProperty('short_url');
      expect(typeof data.code).toBe('string');
      expect(data.code.length).toBe(6);
      expect(data.short_url).toContain('http://localhost:3000/api/routes-f/shorten/');
      expect(UrlStorage.set).toHaveBeenCalledWith(data.code, 'http://example.com');
    });

    it('should create a short URL for valid HTTPS URL', async () => {
      const requestBody = { url: 'https://secure.example.com/path?query=value' };
      const request = new NextRequest('http://localhost:3000/api/routes-f/shorten', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toHaveProperty('code');
      expect(data).toHaveProperty('short_url');
      expect(UrlStorage.set).toHaveBeenCalledWith(data.code, 'https://secure.example.com/path?query=value');
    });

    it('should reject empty URL', async () => {
      const requestBody = { url: '' };
      const request = new NextRequest('http://localhost:3000/api/routes-f/shorten', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('URL cannot be empty');
      expect(data.code).toBe('EMPTY_URL');
    });

    it('should reject whitespace-only URL', async () => {
      const requestBody = { url: '   ' };
      const request = new NextRequest('http://localhost:3000/api/routes-f/shorten', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('URL cannot be empty');
      expect(data.code).toBe('EMPTY_URL');
    });

    it('should reject FTP URL', async () => {
      const requestBody = { url: 'ftp://example.com' };
      const request = new NextRequest('http://localhost:3000/api/routes-f/shorten', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Only HTTP and HTTPS URLs are allowed');
      expect(data.code).toBe('UNSAFE_SCHEME');
    });

    it('should reject invalid URL format', async () => {
      const requestBody = { url: 'not-a-valid-url' };
      const request = new NextRequest('http://localhost:3000/api/routes-f/shorten', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Invalid URL format');
      expect(data.code).toBe('INVALID_URL');
    });

    it('should trim whitespace from valid URL', async () => {
      const requestBody = { url: '  https://example.com  ' };
      const request = new NextRequest('http://localhost:3000/api/routes-f/shorten', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(UrlStorage.set).toHaveBeenCalledWith(data.code, 'https://example.com');
    });
  });

  describe('GET /api/routes-f/shorten/[code]', () => {
    beforeEach(() => {
      // Setup test data
      UrlStorage.set('abc123', 'https://example.com');
      const entry = UrlStorage.get('abc123');
      if (entry) {
        entry.hits = 5;
      }
    });

    it('should return URL and hit count for valid code', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/shorten/abc123');
      const params = { code: 'abc123' };

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.url).toBe('https://example.com');
      expect(data.hits).toBe(6); // 5 original + 1 increment
      expect(UrlStorage.incrementHits).toHaveBeenCalledWith('abc123');
    });

    it('should return 404 for non-existent code', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/shorten/nonexistent');
      const params = { code: 'nonexistent' };

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.message).toBe('Code not found');
    });

    it('should return 400 for invalid code format (too short)', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/shorten/abc');
      const params = { code: 'abc' };

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Invalid code format');
    });

    it('should return 400 for invalid code format (too long)', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/shorten/abcdef123');
      const params = { code: 'abcdef123' };

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Invalid code format');
    });

    it('should return 400 for invalid code format (invalid characters)', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/shorten/abc!@#');
      const params = { code: 'abc!@#' };

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Invalid code format');
    });

    it('should handle zero hits correctly', async () => {
      UrlStorage.set('xyz789', 'https://test.com');
      const request = new NextRequest('http://localhost:3000/api/routes-f/shorten/xyz789');
      const params = { code: 'xyz789' };

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.url).toBe('https://test.com');
      expect(data.hits).toBe(1); // 0 original + 1 increment
    });
  });
});
