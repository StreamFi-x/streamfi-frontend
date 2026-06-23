/**
 * @jest-environment jsdom
 */

import { PATCH, GET } from '../stream/title/route';
import { NextRequest } from 'next/server';

import { titleHistoryStore } from '../stream/title/utils';

describe('/api/routes-f/stream/title', () => {
  beforeEach(() => {
    // Clear the in-memory store before each test
    titleHistoryStore.clear();
  });

  describe('PATCH', () => {
    it('should update stream title and return timestamp', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/stream/title', {
        method: 'PATCH',
        body: JSON.stringify({
          stream_id: 'stream-123',
          title: 'My Awesome Stream'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.title).toBe('My Awesome Stream');
      expect(data.updated_at).toBeDefined();
      expect(typeof data.updated_at).toBe('string');
    });

    it('should validate title length (min 1 char)', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/stream/title', {
        method: 'PATCH',
        body: JSON.stringify({
          stream_id: 'stream-123',
          title: ''
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Title must be at least 1 character');
    });

    it('should validate title length (max 100 chars)', async () => {
      const longTitle = 'a'.repeat(101);
      const request = new NextRequest('http://localhost:3000/api/routes-f/stream/title', {
        method: 'PATCH',
        body: JSON.stringify({
          stream_id: 'stream-123',
          title: longTitle
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Title must be at most 100 characters');
    });

    it('should accept title exactly at 100 characters', async () => {
      const title = 'a'.repeat(100);
      const request = new NextRequest('http://localhost:3000/api/routes-f/stream/title', {
        method: 'PATCH',
        body: JSON.stringify({
          stream_id: 'stream-123',
          title: title
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.title).toBe(title);
    });

    it('should return 400 for missing stream_id', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/stream/title', {
        method: 'PATCH',
        body: JSON.stringify({
          title: 'My Stream'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await PATCH(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/stream/title', {
        method: 'PATCH',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await PATCH(request);

      expect(response.status).toBe(400);
    });
  });

  describe('GET', () => {
    it('should return last 10 title changes for a stream', async () => {
      // Add 12 title changes
      for (let i = 1; i <= 12; i++) {
        const request = new NextRequest('http://localhost:3000/api/routes-f/stream/title', {
          method: 'PATCH',
          body: JSON.stringify({
            stream_id: 'stream-123',
            title: `Title ${i}`
          }),
          headers: {
            'Content-Type': 'application/json'
          }
        });
        await PATCH(request);
      }

      // Get history
      const getRequest = new NextRequest('http://localhost:3000/api/routes-f/stream/title?stream_id=stream-123');
      const response = await GET(getRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.history).toHaveLength(10);
      expect(data.history[0].title).toBe('Title 12'); // Most recent first
      expect(data.history[9].title).toBe('Title 3'); // Oldest of the 10
    });

    it('should return empty array for stream with no history', async () => {
      const getRequest = new NextRequest('http://localhost:3000/api/routes-f/stream/title?stream_id=stream-456');
      const response = await GET(getRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.history).toEqual([]);
    });

    it('should maintain chronological order (newest first)', async () => {
      const request1 = new NextRequest('http://localhost:3000/api/routes-f/stream/title', {
        method: 'PATCH',
        body: JSON.stringify({
          stream_id: 'stream-123',
          title: 'First Title'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      await PATCH(request1);

      const request2 = new NextRequest('http://localhost:3000/api/routes-f/stream/title', {
        method: 'PATCH',
        body: JSON.stringify({
          stream_id: 'stream-123',
          title: 'Second Title'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      await PATCH(request2);

      const getRequest = new NextRequest('http://localhost:3000/api/routes-f/stream/title?stream_id=stream-123');
      const response = await GET(getRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.history[0].title).toBe('Second Title');
      expect(data.history[1].title).toBe('First Title');
    });

    it('should return 400 for missing stream_id', async () => {
      const getRequest = new NextRequest('http://localhost:3000/api/routes-f/stream/title');
      const response = await GET(getRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('stream_id is required');
    });
  });
});
