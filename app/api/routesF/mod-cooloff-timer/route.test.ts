import { POST } from './route';
import * as helpers from './helpers';

describe('/api/routesF/mod-cooloff-timer', () => {
  beforeEach(() => {
    helpers.clearAllRecords();
  });

  describe('POST /check - check cooloff status', () => {
    it('should allow action when no previous action recorded', async () => {
      const request = new Request('http://localhost/api/routesF/mod-cooloff-timer', {
        method: 'POST',
        body: JSON.stringify({
          mod_id: 'mod_123',
          action: 'ban',
          endpoint: 'check',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.allowed).toBe(true);
      expect(data.seconds_remaining).toBeUndefined();
    });

    it('should disallow ban within 30 second cooloff', async () => {
      // Record a ban action
      helpers.recordModAction('mod_123', 'ban');

      const request = new Request('http://localhost/api/routesF/mod-cooloff-timer', {
        method: 'POST',
        body: JSON.stringify({
          mod_id: 'mod_123',
          action: 'ban',
          endpoint: 'check',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.allowed).toBe(false);
      expect(data.seconds_remaining).toBeGreaterThan(0);
      expect(data.seconds_remaining).toBeLessThanOrEqual(30);
    });

    it('should disallow timeout within 5 second cooloff', async () => {
      // Record a timeout action
      helpers.recordModAction('mod_456', 'timeout');

      const request = new Request('http://localhost/api/routesF/mod-cooloff-timer', {
        method: 'POST',
        body: JSON.stringify({
          mod_id: 'mod_456',
          action: 'timeout',
          endpoint: 'check',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.allowed).toBe(false);
      expect(data.seconds_remaining).toBeGreaterThan(0);
      expect(data.seconds_remaining).toBeLessThanOrEqual(5);
    });

    it('should allow warn action (no cooloff)', async () => {
      // Record a warn action
      helpers.recordModAction('mod_789', 'warn');

      const request = new Request('http://localhost/api/routesF/mod-cooloff-timer', {
        method: 'POST',
        body: JSON.stringify({
          mod_id: 'mod_789',
          action: 'warn',
          endpoint: 'check',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.allowed).toBe(true);
      expect(data.seconds_remaining).toBeUndefined();
    });

    it('should return 400 for missing mod_id', async () => {
      const request = new Request('http://localhost/api/routesF/mod-cooloff-timer', {
        method: 'POST',
        body: JSON.stringify({
          action: 'ban',
          endpoint: 'check',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 400 for invalid action', async () => {
      const request = new Request('http://localhost/api/routesF/mod-cooloff-timer', {
        method: 'POST',
        body: JSON.stringify({
          mod_id: 'mod_123',
          action: 'invalid_action',
          endpoint: 'check',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe('POST /record - record mod action', () => {
    it('should record a ban action', async () => {
      const request = new Request('http://localhost/api/routesF/mod-cooloff-timer', {
        method: 'POST',
        body: JSON.stringify({
          mod_id: 'mod_123',
          action: 'ban',
          endpoint: 'record',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.timestamp).toBeDefined();
      expect(typeof data.timestamp).toBe('number');
    });

    it('should record a timeout action', async () => {
      const request = new Request('http://localhost/api/routesF/mod-cooloff-timer', {
        method: 'POST',
        body: JSON.stringify({
          mod_id: 'mod_456',
          action: 'timeout',
          endpoint: 'record',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.timestamp).toBeDefined();
    });

    it('should update record when same mod performs another action', async () => {
      // Record first action
      helpers.recordModAction('mod_123', 'ban');

      // Record second action
      const request = new Request('http://localhost/api/routesF/mod-cooloff-timer', {
        method: 'POST',
        body: JSON.stringify({
          mod_id: 'mod_123',
          action: 'timeout',
          endpoint: 'record',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify new action is recorded
      const record = helpers.getLastActionTimestamp('mod_123');
      expect(record?.last_action).toBe('timeout');
    });

    it('should return 400 for missing mod_id when recording', async () => {
      const request = new Request('http://localhost/api/routesF/mod-cooloff-timer', {
        method: 'POST',
        body: JSON.stringify({
          action: 'ban',
          endpoint: 'record',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe('POST - combined check and record workflow', () => {
    it('should follow check -> record -> check pattern', async () => {
      // Step 1: Check before any action
      let request = new Request('http://localhost/api/routesF/mod-cooloff-timer', {
        method: 'POST',
        body: JSON.stringify({
          mod_id: 'mod_workflow',
          action: 'ban',
          endpoint: 'check',
        }),
      });

      let response = await POST(request);
      let data = await response.json();
      expect(data.allowed).toBe(true);

      // Step 2: Record the action
      request = new Request('http://localhost/api/routesF/mod-cooloff-timer', {
        method: 'POST',
        body: JSON.stringify({
          mod_id: 'mod_workflow',
          action: 'ban',
          endpoint: 'record',
        }),
      });

      response = await POST(request);
      data = await response.json();
      expect(data.success).toBe(true);

      // Step 3: Check again (should be in cooloff)
      request = new Request('http://localhost/api/routesF/mod-cooloff-timer', {
        method: 'POST',
        body: JSON.stringify({
          mod_id: 'mod_workflow',
          action: 'ban',
          endpoint: 'check',
        }),
      });

      response = await POST(request);
      data = await response.json();
      expect(data.allowed).toBe(false);
      expect(data.seconds_remaining).toBeGreaterThan(0);
    });
  });
});
