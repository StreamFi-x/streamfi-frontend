/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET, POST } from '../moderation/log/route';
import { moderationLogsRepository } from '../helpers/repositories';

function createGetRequest(params: Record<string, string>): NextRequest {
  const searchParams = new URLSearchParams(params);
  const url = `http://localhost/api/routesF/moderation/log?${searchParams.toString()}`;
  return new NextRequest(url);
}

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/routesF/moderation/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Moderation Log API', () => {
  beforeEach(() => {
    moderationLogsRepository.clear();
  });

  describe('GET /api/routesF/moderation/log', () => {
    it('returns moderation logs for a creator', async () => {
      // Seed test data
      moderationLogsRepository.seed([
        {
          id: 'log_1',
          creator_id: 'creator_001',
          mod_id: 'mod_001',
          action: 'BAN',
          target_id: 'viewer_001',
          reason: 'Spam',
          timestamp: '2024-01-15T10:30:00Z',
        },
        {
          id: 'log_2',
          creator_id: 'creator_001',
          mod_id: 'mod_002',
          action: 'WARNING',
          target_id: 'viewer_002',
          reason: 'Mild profanity',
          timestamp: '2024-01-16T14:20:00Z',
        },
        {
          id: 'log_other',
          creator_id: 'creator_002',
          mod_id: 'mod_003',
          action: 'TIMEOUT',
          target_id: 'viewer_003',
          reason: 'Bot',
          timestamp: '2024-01-17T09:15:00Z',
        },
      ]);

      const request = createGetRequest({ creator_id: 'creator_001' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.logs).toHaveLength(2);
      
      // Should be sorted newest first
      expect(data.data.logs[0].id).toBe('log_2');
      expect(data.data.logs[1].id).toBe('log_1');
    });

    it('filters by moderator ID', async () => {
      moderationLogsRepository.seed([
        {
          id: 'log_1',
          creator_id: 'creator_001',
          mod_id: 'mod_001',
          action: 'BAN',
          target_id: 'viewer_001',
          reason: 'Spam',
          timestamp: '2024-01-15T10:30:00Z',
        },
        {
          id: 'log_2',
          creator_id: 'creator_001',
          mod_id: 'mod_002',
          action: 'WARNING',
          target_id: 'viewer_002',
          reason: 'Mild profanity',
          timestamp: '2024-01-16T14:20:00Z',
        },
      ]);

      const request = createGetRequest({ 
        creator_id: 'creator_001',
        mod_id: 'mod_001',
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.logs).toHaveLength(1);
      expect(data.data.logs[0].mod_id).toBe('mod_001');
    });

    it('returns empty array for non-existent creator', async () => {
      const request = createGetRequest({ creator_id: 'creator_999' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.logs).toEqual([]);
    });

    it('requires creator_id parameter', async () => {
      const request = createGetRequest({});
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/routesF/moderation/log', () => {
    it('creates a new moderation log entry', async () => {
      const request = createPostRequest({
        creator_id: 'creator_001',
        mod_id: 'mod_001',
        action: 'BAN',
        target_id: 'viewer_001',
        reason: 'Spamming chat',
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      
      const log = data.data;
      expect(log.creator_id).toBe('creator_001');
      expect(log.mod_id).toBe('mod_001');
      expect(log.action).toBe('BAN');
      expect(log.target_id).toBe('viewer_001');
      expect(log.reason).toBe('Spamming chat');
      expect(log.id).toBeDefined();
      expect(log.timestamp).toBeDefined();

      // Verify it was added to repository
      const logs = moderationLogsRepository.getByCreatorId('creator_001');
      expect(logs).toHaveLength(1);
      expect(logs[0].id).toBe(log.id);
    });

    it('enforces FIFO cap of 5000 logs per creator', async () => {
      // Create 5001 logs for a creator
      for (let i = 1; i <= 5001; i++) {
        moderationLogsRepository.add({
          creator_id: 'creator_001',
          mod_id: 'mod_001',
          action: 'WARNING',
          target_id: `viewer_${i}`,
          reason: `Test ${i}`,
        });
      }

      // Should still only have 5000 logs
      const logs = moderationLogsRepository.getByCreatorId('creator_001');
      expect(logs).toHaveLength(5000);

      // The oldest log should have been removed
      // (First log was viewer_1, so it should be gone)
      const viewerIds = logs.map(log => log.target_id);
      expect(viewerIds).not.toContain('viewer_1');
      expect(viewerIds).toContain('viewer_5001'); // Newest should be present
    });

    it('requires all required fields', async () => {
      const request = createPostRequest({
        // Missing required fields
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('validates action enum values', async () => {
      const request = createPostRequest({
        creator_id: 'creator_001',
        mod_id: 'mod_001',
        action: 'INVALID_ACTION',
        target_id: 'viewer_001',
        reason: 'Test',
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('accepts optional reason field', async () => {
      const request = createPostRequest({
        creator_id: 'creator_001',
        mod_id: 'mod_001',
        action: 'DELETE_MESSAGE',
        target_id: 'viewer_001',
        // No reason provided
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.reason).toBeUndefined();
    });

    it('handles different moderation actions', async () => {
      const actions = ['BAN', 'UNBAN', 'TIMEOUT', 'WARNING', 'DELETE_MESSAGE'];
      
      for (const action of actions) {
        const request = createPostRequest({
          creator_id: 'creator_001',
          mod_id: 'mod_001',
          action,
          target_id: 'viewer_001',
          reason: `Test ${action}`,
        });

        const response = await POST(request);
        expect(response.status).toBe(200);
        
        const data = await response.json();
        expect(data.data.action).toBe(action);
      }

      const logs = moderationLogsRepository.getByCreatorId('creator_001');
      expect(logs).toHaveLength(actions.length);
    });

    it('requires valid JSON body', async () => {
      const request = new NextRequest('http://localhost/api/routesF/moderation/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Log ordering and timestamp', () => {
    it('returns logs sorted by timestamp descending (newest first)', async () => {
      // Add logs with different timestamps
      moderationLogsRepository.seed([
        {
          id: 'log_old',
          creator_id: 'creator_001',
          mod_id: 'mod_001',
          action: 'BAN',
          target_id: 'viewer_001',
          reason: 'Old',
          timestamp: '2024-01-01T10:00:00Z',
        },
        {
          id: 'log_new',
          creator_id: 'creator_001',
          mod_id: 'mod_001',
          action: 'WARNING',
          target_id: 'viewer_002',
          reason: 'New',
          timestamp: '2024-01-02T14:00:00Z',
        },
      ]);

      const request = createGetRequest({ creator_id: 'creator_001' });
      const response = await GET(request);
      
      const data = await response.json();
      expect(data.data.logs[0].id).toBe('log_new'); // Newest first
      expect(data.data.logs[1].id).toBe('log_old'); // Oldest last
    });

    it('generates timestamp for new logs', async () => {
      const request = createPostRequest({
        creator_id: 'creator_001',
        mod_id: 'mod_001',
        action: 'BAN',
        target_id: 'viewer_001',
        reason: 'Test',
      });

      const response = await POST(request);
      const data = await response.json();
      
      const timestamp = new Date(data.data.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });
});