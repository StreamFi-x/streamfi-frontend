/**
 * @jest-environment jsdom
 */

import { POST } from '../html-escape/route';
import { NextRequest } from 'next/server';

// Mock the data module
jest.mock('../html-escape/data', () => ({
  escapeHtml: jest.fn(),
  unescapeHtml: jest.fn(),
}));

const { escapeHtml, unescapeHtml } = require('../html-escape/data');

describe('/api/routes-f/html-escape', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST', () => {
    it('should escape HTML in escape mode', async () => {
      escapeHtml.mockReturnValue('&lt;div&gt;Hello &amp; &quot;world&quot;&#39;&lt;/div&gt;');

      const request = new NextRequest('http://localhost:3000/api/routes-f/html-escape', {
        method: 'POST',
        body: JSON.stringify({
          input: '<div>Hello & "world"</div>',
          mode: 'escape'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.output).toBe('&lt;div&gt;Hello &amp; &quot;world&quot;&#39;&lt;/div&gt;');
      expect(escapeHtml).toHaveBeenCalledWith('<div>Hello & "world"</div>');
    });

    it('should unescape HTML in unescape mode', async () => {
      unescapeHtml.mockReturnValue('<div>Hello & "world"</div>');

      const request = new NextRequest('http://localhost:3000/api/routes-f/html-escape', {
        method: 'POST',
        body: JSON.stringify({
          input: '&lt;div&gt;Hello &amp; &quot;world&quot;&#39;&lt;/div&gt;',
          mode: 'unescape'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.output).toBe('<div>Hello & "world"</div>');
      expect(unescapeHtml).toHaveBeenCalledWith('&lt;div&gt;Hello &amp; &quot;world&quot;&#39;&lt;/div&gt;');
    });

    it('should handle numeric entities in unescape mode', async () => {
      unescapeHtml.mockReturnValue('A');

      const request = new NextRequest('http://localhost:3000/api/routes-f/html-escape', {
        method: 'POST',
        body: JSON.stringify({
          input: '&#65;',
          mode: 'unescape'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.output).toBe('A');
      expect(unescapeHtml).toHaveBeenCalledWith('&#65;');
    });

    it('should handle hexadecimal entities in unescape mode', async () => {
      unescapeHtml.mockReturnValue('A');

      const request = new NextRequest('http://localhost:3000/api/routes-f/html-escape', {
        method: 'POST',
        body: JSON.stringify({
          input: '&#x41;',
          mode: 'unescape'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.output).toBe('A');
      expect(unescapeHtml).toHaveBeenCalledWith('&#x41;');
    });

    it('should handle named entities in unescape mode', async () => {
      unescapeHtml.mockReturnValue('<');

      const request = new NextRequest('http://localhost:3000/api/routes-f/html-escape', {
        method: 'POST',
        body: JSON.stringify({
          input: '&lt;',
          mode: 'unescape'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.output).toBe('<');
      expect(unescapeHtml).toHaveBeenCalledWith('&lt;');
    });

    it('should return 400 for missing request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/html-escape', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid request body');
    });

    it('should return 400 for invalid mode', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/html-escape', {
        method: 'POST',
        body: JSON.stringify({
          input: 'test',
          mode: 'invalid'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid mode');
    });

    it('should return 400 for invalid JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/html-escape', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid JSON');
    });

    it('should return 413 for input too large', async () => {
      // Create a string larger than 1MB
      const largeInput = 'a'.repeat(1024 * 1024 + 1);

      const request = new NextRequest('http://localhost:3000/api/routes-f/html-escape', {
        method: 'POST',
        body: JSON.stringify({
          input: largeInput,
          mode: 'escape'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(413);
      expect(data.error).toContain('Input too large');
    });
  });
});
