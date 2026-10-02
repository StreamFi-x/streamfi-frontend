/**
 * @jest-environment jsdom
 */

import { POST, DELETE, GET } from '../stream/chat/route';
import { NextRequest } from 'next/server';

import { chatRestrictionStore } from '../stream/chat/utils';

describe('/api/routes-f/stream/chat', () => {
  beforeEach(() => {
    // Clear the in-memory store before each test
    chatRestrictionStore.clear();
  });

  describe('POST', () => {
    it('should enable chat restriction with default 10 minutes', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/stream/chat', {
        method: 'POST',
        body: JSON.stringify({
          stream_id: 'stream-123'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.enabled).toBe(true);
      expect(data.min_follow_minutes).toBe(10);
    });

    it('should enable chat restriction with custom threshold', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/stream/chat', {
        method: 'POST',
        body: JSON.stringify({
          stream_id: 'stream-123',
          min_follow_minutes: 30
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.enabled).toBe(true);
      expect(data.min_follow_minutes).toBe(30);
    });

    it('should validate min_follow_minutes is at least 1', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/stream/chat', {
        method: 'POST',
        body: JSON.stringify({
          stream_id: 'stream-123',
          min_follow_minutes: 0
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('min_follow_minutes must be at least 1 minute');
    });

    it('should validate min_follow_minutes is an integer', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/stream/chat', {
        method: 'POST',
        body: JSON.stringify({
          stream_id: 'stream-123',
          min_follow_minutes: 10.5
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('min_follow_minutes must be an integer');
    });

    it('should validate min_follow_minutes maximum (1 week)', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/stream/chat', {
        method: 'POST',
        body: JSON.stringify({
          stream_id: 'stream-123',
          min_follow_minutes: 10081
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('min_follow_minutes must be at most 10080 minutes (1 week)');
    });

    it('should accept max valid value (10080 minutes)', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/stream/chat', {
        method: 'POST',
        body: JSON.stringify({
          stream_id: 'stream-123',
          min_follow_minutes: 10080
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.min_follow_minutes).toBe(10080);
    });

    it('should return 400 for missing stream_id', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/stream/chat', {
        method: 'POST',
        body: JSON.stringify({
          min_follow_minutes: 10
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/stream/chat', {
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

  describe('DELETE', () => {
    it('should disable chat restriction', async () => {
      // First enable restriction
      const postRequest = new NextRequest('http://localhost:3000/api/routes-f/stream/chat', {
        method: 'POST',
        body: JSON.stringify({
          stream_id: 'stream-123',
          min_follow_minutes: 10
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      await POST(postRequest);

      // Then disable it
      const deleteRequest = new NextRequest('http://localhost:3000/api/routes-f/stream/chat?stream_id=stream-123', {
        method: 'DELETE'
      });
      const response = await DELETE(deleteRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.enabled).toBe(false);
    });

    it('should return 400 for missing stream_id', async () => {
      const deleteRequest = new NextRequest('http://localhost:3000/api/routes-f/stream/chat', {
        method: 'DELETE'
      });
      const response = await DELETE(deleteRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('stream_id is required');
    });
  });

  describe('GET', () => {
    it('should return current restriction state when enabled', async () => {
      // Enable restriction
      const postRequest = new NextRequest('http://localhost:3000/api/routes-f/stream/chat', {
        method: 'POST',
        body: JSON.stringify({
          stream_id: 'stream-123',
          min_follow_minutes: 15
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      await POST(postRequest);

      // Get state
      const getRequest = new NextRequest('http://localhost:3000/api/routes-f/stream/chat?stream_id=stream-123');
      const response = await GET(getRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.enabled).toBe(true);
      expect(data.min_follow_minutes).toBe(15);
    });

    it('should return disabled state when no restriction exists', async () => {
      const getRequest = new NextRequest('http://localhost:3000/api/routes-f/stream/chat?stream_id=stream-456');
      const response = await GET(getRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.enabled).toBe(false);
      expect(data.min_follow_minutes).toBeUndefined();
    });

    it('should return 400 for missing stream_id', async () => {
      const getRequest = new NextRequest('http://localhost:3000/api/routes-f/stream/chat');
      const response = await GET(getRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('stream_id is required');
    });

    it('should handle toggle lifecycle (enable -> get -> disable -> get)', async () => {
      const streamId = 'stream-123';

      // Enable
      const postRequest = new NextRequest('http://localhost:3000/api/routes-f/stream/chat', {
        method: 'POST',
        body: JSON.stringify({
          stream_id: streamId,
          min_follow_minutes: 20
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      let response = await POST(postRequest);
      expect(response.status).toBe(200);

      // Get - should be enabled
      let getRequest = new NextRequest(`http://localhost:3000/api/routes-f/stream/chat?stream_id=${streamId}`);
      response = await GET(getRequest);
      let data = await response.json();
      expect(data.enabled).toBe(true);
      expect(data.min_follow_minutes).toBe(20);

      // Disable
      const deleteRequest = new NextRequest(`http://localhost:3000/api/routes-f/stream/chat?stream_id=${streamId}`, {
        method: 'DELETE'
      });
      response = await DELETE(deleteRequest);
      expect(response.status).toBe(200);

      // Get - should be disabled
      getRequest = new NextRequest(`http://localhost:3000/api/routes-f/stream/chat?stream_id=${streamId}`);
      response = await GET(getRequest);
      data = await response.json();
      expect(data.enabled).toBe(false);
    });

    it('should update threshold when re-enabling with different value', async () => {
      const streamId = 'stream-123';

      // Enable with 10 minutes
      const postRequest1 = new NextRequest('http://localhost:3000/api/routes-f/stream/chat', {
        method: 'POST',
        body: JSON.stringify({
          stream_id: streamId,
          min_follow_minutes: 10
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      await POST(postRequest1);

      // Re-enable with 30 minutes
      const postRequest2 = new NextRequest('http://localhost:3000/api/routes-f/stream/chat', {
        method: 'POST',
        body: JSON.stringify({
          stream_id: streamId,
          min_follow_minutes: 30
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      await POST(postRequest2);

      // Get state
      const getRequest = new NextRequest(`http://localhost:3000/api/routes-f/stream/chat?stream_id=${streamId}`);
      const response = await GET(getRequest);
      const data = await response.json();

      expect(data.enabled).toBe(true);
      expect(data.min_follow_minutes).toBe(30);
    });
  });
});
