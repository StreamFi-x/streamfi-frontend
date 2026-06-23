/**
 * @jest-environment jsdom
 */

import { POST, GET } from '../stream/tags/route';
import { NextRequest } from 'next/server';

import { streamTagsStore } from '../stream/tags/utils';

describe('/api/routes-f/stream/tags', () => {
  beforeEach(() => {
    // Clear the in-memory store before each test
    streamTagsStore.clear();
  });

  describe('POST', () => {
    it('should add tags to a stream', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/stream/tags', {
        method: 'POST',
        body: JSON.stringify({
          stream_id: 'stream-123',
          add: ['gaming', 'fps']
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tags).toEqual(['gaming', 'fps']);
    });

    it('should normalize tags to lowercase and hyphenated', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/stream/tags', {
        method: 'POST',
        body: JSON.stringify({
          stream_id: 'stream-123',
          add: ['GAMING', 'First Person Shooter', '  RPG  ']
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tags).toEqual(['gaming', 'first-person-shooter', 'rpg']);
    });

    it('should remove tags from a stream', async () => {
      // First add tags
      const addRequest = new NextRequest('http://localhost:3000/api/routes-f/stream/tags', {
        method: 'POST',
        body: JSON.stringify({
          stream_id: 'stream-123',
          add: ['gaming', 'fps', 'rpg']
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      await POST(addRequest);

      // Then remove one
      const removeRequest = new NextRequest('http://localhost:3000/api/routes-f/stream/tags', {
        method: 'POST',
        body: JSON.stringify({
          stream_id: 'stream-123',
          remove: ['fps']
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(removeRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tags).toEqual(['gaming', 'rpg']);
    });

    it('should deduplicate tags', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/stream/tags', {
        method: 'POST',
        body: JSON.stringify({
          stream_id: 'stream-123',
          add: ['gaming', 'GAMING', 'gaming']
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tags).toEqual(['gaming']);
    });

    it('should cap tags at 10', async () => {
      // First add 10 tags
      const addRequest = new NextRequest('http://localhost:3000/api/routes-f/stream/tags', {
        method: 'POST',
        body: JSON.stringify({
          stream_id: 'stream-123',
          add: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6', 'tag7', 'tag8', 'tag9', 'tag10']
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      await POST(addRequest);

      // Try to add one more
      const overflowRequest = new NextRequest('http://localhost:3000/api/routes-f/stream/tags', {
        method: 'POST',
        body: JSON.stringify({
          stream_id: 'stream-123',
          add: ['tag11']
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(overflowRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Maximum 10 tags allowed');
    });

    it('should handle add and remove in same request', async () => {
      // First add tags
      const addRequest = new NextRequest('http://localhost:3000/api/routes-f/stream/tags', {
        method: 'POST',
        body: JSON.stringify({
          stream_id: 'stream-123',
          add: ['gaming', 'fps', 'rpg']
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      await POST(addRequest);

      // Add and remove in same request
      const request = new NextRequest('http://localhost:3000/api/routes-f/stream/tags', {
        method: 'POST',
        body: JSON.stringify({
          stream_id: 'stream-123',
          add: ['action'],
          remove: ['rpg']
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tags).toEqual(['gaming', 'fps', 'action']);
    });

    it('should return 400 for missing stream_id', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/stream/tags', {
        method: 'POST',
        body: JSON.stringify({
          add: ['gaming']
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/stream/tags', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('GET', () => {
    it('should return current tags for a stream', async () => {
      // First add tags
      const addRequest = new NextRequest('http://localhost:3000/api/routes-f/stream/tags', {
        method: 'POST',
        body: JSON.stringify({
          stream_id: 'stream-123',
          add: ['gaming', 'fps']
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      await POST(addRequest);

      // Then get them
      const getRequest = new NextRequest('http://localhost:3000/api/routes-f/stream/tags?stream_id=stream-123');
      const response = await GET(getRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tags).toEqual(['gaming', 'fps']);
    });

    it('should return empty array for stream with no tags', async () => {
      const getRequest = new NextRequest('http://localhost:3000/api/routes-f/stream/tags?stream_id=stream-456');
      const response = await GET(getRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tags).toEqual([]);
    });

    it('should return 400 for missing stream_id', async () => {
      const getRequest = new NextRequest('http://localhost:3000/api/routes-f/stream/tags');
      const response = await GET(getRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('stream_id is required');
    });
  });
});
