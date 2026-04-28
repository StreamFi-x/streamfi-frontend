import { POST } from '../route';
import { NextRequest } from 'next/server';

describe('/api/routes-f/ascii-art', () => {
  describe('POST', () => {
    it('should generate ASCII art with standard font', async () => {
      const request = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ text: 'HI' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.art).toContain(' _   _ ');
      expect(data.font_used).toBe('standard');
    });

    it('should generate ASCII art with small font', async () => {
      const request = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ text: 'HI', font: 'small' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.art).toContain('_  _');
      expect(data.font_used).toBe('small');
    });

    it('should generate ASCII art with big font', async () => {
      const request = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ text: 'HI', font: 'big' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.art).toContain('   _   _   ');
      expect(data.font_used).toBe('big');
    });

    it('should handle numbers in text', async () => {
      const request = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ text: '123' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.art).toContain(' _ ');
      expect(data.art).toContain('|_|');
    });

    it('should handle spaces in text', async () => {
      const request = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ text: 'A B' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.art).toContain('  ___   ');
      expect(data.art).toContain('       ');
    });

    it('should apply width wrapping when specified', async () => {
      const request = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ text: 'HELLO', width: 20 }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.art).toContain('\n'); // Should contain line breaks due to wrapping
    });

    it('should default to standard font when not specified', async () => {
      const request = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ text: 'HI' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.font_used).toBe('standard');
    });

    it('should reject text longer than 50 characters', async () => {
      const longText = 'A'.repeat(51);
      const request = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ text: longText }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('50 characters or less');
    });

    it('should reject unsupported characters', async () => {
      const request = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ text: 'Hello@World' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('unsupported characters');
    });

    it('should reject unsupported font', async () => {
      const request = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ text: 'HI', font: 'unsupported' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Unsupported font');
    });

    it('should reject missing text field', async () => {
      const request = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Text is required');
    });

    it('should reject empty text', async () => {
      const request = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ text: '' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Text is required');
    });

    it('should reject non-string text', async () => {
      const request = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ text: 123 }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('must be a string');
    });

    it('should reject invalid JSON', async () => {
      const request = new NextRequest('http://localhost', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid JSON body.');
    });

    it('should handle case insensitive input', async () => {
      const request = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ text: 'hello' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.art).toContain('  _____ ');
      expect(data.art).toContain(' |_____|');
    });
  });
});
