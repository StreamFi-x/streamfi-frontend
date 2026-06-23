/**
 * @jest-environment jsdom
 */

import { POST, DELETE, GET } from '../stream/intermission/route';
import { NextRequest } from 'next/server';

import { intermissionStore } from '../stream/intermission/utils';

describe('/api/routes-f/stream/intermission', () => {
  beforeEach(() => {
    // Clear the in-memory store before each test
    intermissionStore.clear();
  });

  describe('POST', () => {
    it('should create an intermission with message', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/stream/intermission', {
        method: 'POST',
        body: JSON.stringify({
          stream_id: 'stream-123',
          message: 'Be right back!'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.active).toBe(true);
    });

    it('should create an intermission with ends_at timer', async () => {
      const endsAt = new Date(Date.now() + 300000).toISOString(); // 5 minutes from now
      const request = new NextRequest('http://localhost:3000/api/routes-f/stream/intermission', {
        method: 'POST',
        body: JSON.stringify({
          stream_id: 'stream-123',
          message: 'Short break',
          ends_at: endsAt
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.active).toBe(true);
    });

    it('should return 400 for invalid ends_at format', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/stream/intermission', {
        method: 'POST',
        body: JSON.stringify({
          stream_id: 'stream-123',
          message: 'Break',
          ends_at: 'invalid-date'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('ends_at must be a valid ISO date');
    });

    it('should return 400 for missing stream_id', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/stream/intermission', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Break'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing message', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/stream/intermission', {
        method: 'POST',
        body: JSON.stringify({
          stream_id: 'stream-123'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/stream/intermission', {
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
    it('should clear an active intermission', async () => {
      // First create an intermission
      const postRequest = new NextRequest('http://localhost:3000/api/routes-f/stream/intermission', {
        method: 'POST',
        body: JSON.stringify({
          stream_id: 'stream-123',
          message: 'Break'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      await POST(postRequest);

      // Then delete it
      const deleteRequest = new NextRequest('http://localhost:3000/api/routes-f/stream/intermission?stream_id=stream-123', {
        method: 'DELETE'
      });
      const response = await DELETE(deleteRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.active).toBe(false);
    });

    it('should return 400 for missing stream_id', async () => {
      const deleteRequest = new NextRequest('http://localhost:3000/api/routes-f/stream/intermission', {
        method: 'DELETE'
      });
      const response = await DELETE(deleteRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('stream_id is required');
    });
  });

  describe('GET', () => {
    it('should return active intermission state', async () => {
      // Create an intermission
      const postRequest = new NextRequest('http://localhost:3000/api/routes-f/stream/intermission', {
        method: 'POST',
        body: JSON.stringify({
          stream_id: 'stream-123',
          message: 'Be right back!'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      await POST(postRequest);

      // Get the state
      const getRequest = new NextRequest('http://localhost:3000/api/routes-f/stream/intermission?stream_id=stream-123');
      const response = await GET(getRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.active).toBe(true);
      expect(data.message).toBe('Be right back!');
      expect(data.ends_at).toBeUndefined();
      expect(data.seconds_remaining).toBeUndefined();
    });

    it('should return intermission with countdown when ends_at is set', async () => {
      const endsAt = new Date(Date.now() + 120000).toISOString(); // 2 minutes from now
      const postRequest = new NextRequest('http://localhost:3000/api/routes-f/stream/intermission', {
        method: 'POST',
        body: JSON.stringify({
          stream_id: 'stream-123',
          message: 'Short break',
          ends_at: endsAt
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      await POST(postRequest);

      const getRequest = new NextRequest('http://localhost:3000/api/routes-f/stream/intermission?stream_id=stream-123');
      const response = await GET(getRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.active).toBe(true);
      expect(data.message).toBe('Short break');
      expect(data.ends_at).toBe(endsAt);
      expect(data.seconds_remaining).toBeGreaterThan(0);
      expect(data.seconds_remaining).toBeLessThanOrEqual(120);
    });

    it('should return inactive state when no intermission exists', async () => {
      const getRequest = new NextRequest('http://localhost:3000/api/routes-f/stream/intermission?stream_id=stream-456');
      const response = await GET(getRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.active).toBe(false);
      expect(data.message).toBeUndefined();
      expect(data.ends_at).toBeUndefined();
      expect(data.seconds_remaining).toBeUndefined();
    });

    it('should return 400 for missing stream_id', async () => {
      const getRequest = new NextRequest('http://localhost:3000/api/routes-f/stream/intermission');
      const response = await GET(getRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('stream_id is required');
    });

    it('should handle intermission lifecycle (create -> get -> delete -> get)', async () => {
      const streamId = 'stream-123';

      // Create
      const postRequest = new NextRequest('http://localhost:3000/api/routes-f/stream/intermission', {
        method: 'POST',
        body: JSON.stringify({
          stream_id: streamId,
          message: 'Lifecycle test'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      let response = await POST(postRequest);
      expect(response.status).toBe(200);

      // Get - should be active
      let getRequest = new NextRequest(`http://localhost:3000/api/routes-f/stream/intermission?stream_id=${streamId}`);
      response = await GET(getRequest);
      let data = await response.json();
      expect(data.active).toBe(true);

      // Delete
      const deleteRequest = new NextRequest(`http://localhost:3000/api/routes-f/stream/intermission?stream_id=${streamId}`, {
        method: 'DELETE'
      });
      response = await DELETE(deleteRequest);
      expect(response.status).toBe(200);

      // Get - should be inactive
      getRequest = new NextRequest(`http://localhost:3000/api/routes-f/stream/intermission?stream_id=${streamId}`);
      response = await GET(getRequest);
      data = await response.json();
      expect(data.active).toBe(false);
    });
  });
});
