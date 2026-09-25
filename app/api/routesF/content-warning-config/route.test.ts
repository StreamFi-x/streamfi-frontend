import { GET, PUT } from './route';
import * as helpers from './helpers';

describe('/api/routesF/content-warning-config', () => {
  beforeEach(() => {
    helpers.clearAllConfigs();
  });

  describe('GET - retrieve warning config', () => {
    it('should return default empty config for creator without warnings', async () => {
      const request = new Request(
        'http://localhost/api/routesF/content-warning-config?creator_id=creator_123',
        {
          method: 'GET',
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.warnings).toEqual([]);
      expect(data.severity).toBe('mild');
    });

    it('should return configured warnings for a creator', async () => {
      helpers.setWarningConfig('creator_123', ['loud_audio', 'flashing_lights'], 'severe');

      const request = new Request(
        'http://localhost/api/routesF/content-warning-config?creator_id=creator_123',
        {
          method: 'GET',
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.warnings).toEqual(['loud_audio', 'flashing_lights']);
      expect(data.severity).toBe('severe');
    });

    it('should return 400 for missing creator_id', async () => {
      const request = new Request(
        'http://localhost/api/routesF/content-warning-config',
        {
          method: 'GET',
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe('PUT - set warning config', () => {
    it('should set warning config with valid warnings', async () => {
      const request = new Request('http://localhost/api/routesF/content-warning-config', {
        method: 'PUT',
        body: JSON.stringify({
          creator_id: 'creator_123',
          warnings: ['loud_audio', 'flashing_lights'],
          severity: 'moderate',
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.warnings).toEqual(['loud_audio', 'flashing_lights']);
      expect(data.severity).toBe('moderate');
      expect(data.updated_at).toBeDefined();
    });

    it('should set warning config with all common warnings', async () => {
      const allWarnings = [
        'loud_audio',
        'flashing_lights',
        'violence',
        'mature_content',
        'gore',
        'strong_profanity',
        'jumpscares',
        'sexual_content',
      ];

      const request = new Request('http://localhost/api/routesF/content-warning-config', {
        method: 'PUT',
        body: JSON.stringify({
          creator_id: 'creator_123',
          warnings: allWarnings,
          severity: 'severe',
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.warnings).toHaveLength(8);
    });

    it('should set warning config with empty warnings array', async () => {
      const request = new Request('http://localhost/api/routesF/content-warning-config', {
        method: 'PUT',
        body: JSON.stringify({
          creator_id: 'creator_123',
          warnings: [],
          severity: 'mild',
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.warnings).toEqual([]);
    });

    it('should reject invalid severity', async () => {
      const request = new Request('http://localhost/api/routesF/content-warning-config', {
        method: 'PUT',
        body: JSON.stringify({
          creator_id: 'creator_123',
          warnings: ['loud_audio'],
          severity: 'ultra_severe', // Invalid
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('severity');
    });

    it('should reject invalid warning types', async () => {
      const request = new Request('http://localhost/api/routesF/content-warning-config', {
        method: 'PUT',
        body: JSON.stringify({
          creator_id: 'creator_123',
          warnings: ['loud_audio', 'invalid_warning_type'],
          severity: 'moderate',
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid warning types');
    });

    it('should return 400 for missing creator_id', async () => {
      const request = new Request('http://localhost/api/routesF/content-warning-config', {
        method: 'PUT',
        body: JSON.stringify({
          warnings: ['loud_audio'],
          severity: 'moderate',
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 400 for missing warnings array', async () => {
      const request = new Request('http://localhost/api/routesF/content-warning-config', {
        method: 'PUT',
        body: JSON.stringify({
          creator_id: 'creator_123',
          severity: 'moderate',
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 400 for missing severity', async () => {
      const request = new Request('http://localhost/api/routesF/content-warning-config', {
        method: 'PUT',
        body: JSON.stringify({
          creator_id: 'creator_123',
          warnings: ['loud_audio'],
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should allow updating existing config', async () => {
      // Set initial config
      await PUT(
        new Request('http://localhost/api/routesF/content-warning-config', {
          method: 'PUT',
          body: JSON.stringify({
            creator_id: 'creator_123',
            warnings: ['loud_audio'],
            severity: 'mild',
          }),
        })
      );

      // Update config
      const request = new Request('http://localhost/api/routesF/content-warning-config', {
        method: 'PUT',
        body: JSON.stringify({
          creator_id: 'creator_123',
          warnings: ['loud_audio', 'flashing_lights', 'violence'],
          severity: 'severe',
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.warnings).toEqual(['loud_audio', 'flashing_lights', 'violence']);
      expect(data.severity).toBe('severe');
    });
  });

  describe('GET-PUT workflow', () => {
    it('should handle set then get workflow', async () => {
      // Set config
      let request = new Request('http://localhost/api/routesF/content-warning-config', {
        method: 'PUT',
        body: JSON.stringify({
          creator_id: 'creator_123',
          warnings: ['mature_content', 'gore'],
          severity: 'moderate',
        }),
      });

      let response = await PUT(request);
      expect(response.status).toBe(200);

      // Get config
      request = new Request(
        'http://localhost/api/routesF/content-warning-config?creator_id=creator_123',
        {
          method: 'GET',
        }
      );

      response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.warnings).toEqual(['mature_content', 'gore']);
      expect(data.severity).toBe('moderate');
    });

    it('should handle multiple creators independently', async () => {
      // Set config for creator 1
      let request = new Request('http://localhost/api/routesF/content-warning-config', {
        method: 'PUT',
        body: JSON.stringify({
          creator_id: 'creator_1',
          warnings: ['loud_audio'],
          severity: 'mild',
        }),
      });

      let response = await PUT(request);
      expect(response.status).toBe(200);

      // Set config for creator 2
      request = new Request('http://localhost/api/routesF/content-warning-config', {
        method: 'PUT',
        body: JSON.stringify({
          creator_id: 'creator_2',
          warnings: ['violence', 'gore'],
          severity: 'severe',
        }),
      });

      response = await PUT(request);
      expect(response.status).toBe(200);

      // Verify creator 1's config
      request = new Request(
        'http://localhost/api/routesF/content-warning-config?creator_id=creator_1',
        {
          method: 'GET',
        }
      );

      response = await GET(request);
      let data = await response.json();
      expect(data.warnings).toEqual(['loud_audio']);
      expect(data.severity).toBe('mild');

      // Verify creator 2's config
      request = new Request(
        'http://localhost/api/routesF/content-warning-config?creator_id=creator_2',
        {
          method: 'GET',
        }
      );

      response = await GET(request);
      data = await response.json();
      expect(data.warnings).toEqual(['violence', 'gore']);
      expect(data.severity).toBe('severe');
    });
  });
});
