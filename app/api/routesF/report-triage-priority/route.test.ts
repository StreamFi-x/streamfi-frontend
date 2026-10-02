import { POST } from './route';

describe('/api/routesF/report-triage-priority', () => {
  describe('POST - report triage priority', () => {
    it('should return critical priority for verified mod reporting hate speech', async () => {
      const request = new Request('http://localhost/api/routesF/report-triage-priority', {
        method: 'POST',
        body: JSON.stringify({
          report: {
            reporterId: 'verified_mod',
            reason: 'hate_speech',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.priority).toBe('critical');
      expect(data.score).toBeGreaterThanOrEqual(80);
    });

    it('should return high priority for trusted user reporting harassment', async () => {
      const request = new Request('http://localhost/api/routesF/report-triage-priority', {
        method: 'POST',
        body: JSON.stringify({
          report: {
            reporterId: 'trusted_user',
            reason: 'harassment',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.priority).toBe('high');
      expect(data.score).toBeGreaterThanOrEqual(60);
      expect(data.score).toBeLessThan(80);
    });

    it('should return med priority for regular viewer reporting spam', async () => {
      const request = new Request('http://localhost/api/routesF/report-triage-priority', {
        method: 'POST',
        body: JSON.stringify({
          report: {
            reporterId: 'regular_viewer',
            reason: 'spam',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.priority).toBe('med');
      expect(data.score).toBeGreaterThanOrEqual(40);
      expect(data.score).toBeLessThan(60);
    });

    it('should return low priority for new user reporting off-topic', async () => {
      const request = new Request('http://localhost/api/routesF/report-triage-priority', {
        method: 'POST',
        body: JSON.stringify({
          report: {
            reporterId: 'new_user',
            reason: 'off_topic',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.priority).toBe('low');
      expect(data.score).toBeLessThan(40);
    });

    it('should handle critical priority for threats regardless of reporter trust', async () => {
      const request = new Request('http://localhost/api/routesF/report-triage-priority', {
        method: 'POST',
        body: JSON.stringify({
          report: {
            reporterId: 'anonymous',
            reason: 'threats',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.priority).toBe('critical');
      expect(data.score).toBeGreaterThanOrEqual(80);
    });

    it('should handle unknown reasons with medium severity', async () => {
      const request = new Request('http://localhost/api/routesF/report-triage-priority', {
        method: 'POST',
        body: JSON.stringify({
          report: {
            reporterId: 'regular_viewer',
            reason: 'unknown_reason',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.priority).toBe('med');
      expect(data.score).toBeGreaterThanOrEqual(40);
    });

    it('should return 400 for missing reporterId', async () => {
      const request = new Request('http://localhost/api/routesF/report-triage-priority', {
        method: 'POST',
        body: JSON.stringify({
          report: {
            reason: 'spam',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 400 for missing reason', async () => {
      const request = new Request('http://localhost/api/routesF/report-triage-priority', {
        method: 'POST',
        body: JSON.stringify({
          report: {
            reporterId: 'regular_viewer',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 400 for missing report object', async () => {
      const request = new Request('http://localhost/api/routesF/report-triage-priority', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 400 for invalid JSON', async () => {
      const request = new Request('http://localhost/api/routesF/report-triage-priority', {
        method: 'POST',
        body: 'invalid json',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });
});
