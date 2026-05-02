import { POST } from '../route';
import { NextRequest } from 'next/server';

describe('/api/routes-f/markdown', () => {
  describe('POST', () => {
    it('should convert headers to HTML', async () => {
      const request = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ markdown: '# Header 1\n## Header 2' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.html).toContain('<h1>Header 1</h1>');
      expect(data.html).toContain('<h2>Header 2</h2>');
    });

    it('should convert bold and italic text', async () => {
      const request = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ markdown: '**bold** and *italic* text' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.html).toContain('<strong>bold</strong>');
      expect(data.html).toContain('<em>italic</em>');
    });

    it('should convert inline code', async () => {
      const request = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ markdown: 'Here is `code` inline' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.html).toContain('<code>code</code>');
    });

    it('should convert fenced code blocks', async () => {
      const request = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ markdown: '```javascript\nconsole.log("hello");\n```' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.html).toContain('<pre><code class="language-javascript">');
      expect(data.html).toContain('console.log("hello");');
      expect(data.html).toContain('</code></pre>');
    });

    it('should convert links', async () => {
      const request = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ markdown: '[Google](https://google.com)' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.html).toContain('<a href="https://google.com">Google</a>');
    });

    it('should convert unordered lists', async () => {
      const request = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ markdown: '- Item 1\n- Item 2' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.html).toContain('<ul>');
      expect(data.html).toContain('<li>Item 1</li>');
      expect(data.html).toContain('<li>Item 2</li>');
      expect(data.html).toContain('</ul>');
    });

    it('should convert ordered lists', async () => {
      const request = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ markdown: '1. First\n2. Second' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.html).toContain('<ol>');
      expect(data.html).toContain('<li>First</li>');
      expect(data.html).toContain('<li>Second</li>');
      expect(data.html).toContain('</ol>');
    });

    it('should convert paragraphs', async () => {
      const request = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ markdown: 'This is a paragraph.\n\nThis is another paragraph.' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.html).toContain('<p>This is a paragraph.</p>');
      expect(data.html).toContain('<p>This is another paragraph.</p>');
    });

    it('should escape HTML to prevent XSS', async () => {
      const request = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ markdown: '<script>alert("xss")</script>' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.html).not.toContain('<script>alert("xss")</script>');
      expect(data.html).toContain('&lt;script&gt;alert("xss")&lt;/script&gt;');
    });

    it('should reject markdown larger than 50KB', async () => {
      const largeMarkdown = 'a'.repeat(51 * 1024); // 51KB
      const request = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ markdown: largeMarkdown }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('exceeds 50 KB limit');
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

    it('should reject missing markdown field', async () => {
      const request = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('markdown must be a string.');
    });

    it('should reject non-string markdown', async () => {
      const request = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ markdown: 123 }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('markdown must be a string.');
    });
  });
});
