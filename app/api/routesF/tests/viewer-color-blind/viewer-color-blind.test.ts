/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET, PUT } from '../../viewer-color-blind/route';
import { colorBlindRepository } from '../../shared/repositories';

function createGetRequest(viewerId: string): NextRequest {
  return new NextRequest(`http://localhost/api/routesF/viewer-color-blind?viewer_id=${viewerId}`);
}

function createPutRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/routesF/viewer-color-blind', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Viewer Color Blind API', () => {
  beforeEach(() => {
    colorBlindRepository.clear();
  });

  describe('GET /api/routesF/viewer-color-blind', () => {
    it('returns color blind preference for a viewer', async () => {
      // Seed test data
      colorBlindRepository.save({
        viewer_id: 'test_viewer_001',
        mode: 'protanopia',
      });

      const request = createGetRequest('test_viewer_001');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toEqual({
        mode: 'protanopia',
      });
    });

    it('returns 404 when preference not found', async () => {
      const request = createGetRequest('nonexistent_viewer');
      const response = await GET(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('not found');
    });

    it('requires viewer_id parameter', async () => {
      const request = createGetRequest('');
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('viewer_id');
    });

    it('returns all valid color blind modes', async () => {
      const modes = ['none', 'protanopia', 'deuteranopia', 'tritanopia'];
      
      for (const mode of modes) {
        colorBlindRepository.save({
          viewer_id: `test_viewer_${mode}`,
          mode: mode as any,
        });

        const request = createGetRequest(`test_viewer_${mode}`);
        const response = await GET(request);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.mode).toBe(mode);
      }
    });
  });

  describe('PUT /api/routesF/viewer-color-blind', () => {
    it('creates new color blind preference', async () => {
      const request = createPutRequest({
        viewer_id: 'test_viewer_001',
        mode: 'deuteranopia',
      });

      const response = await PUT(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toEqual({
        mode: 'deuteranopia',
      });

      // Verify repository was updated
      const preference = colorBlindRepository.findByViewerId('test_viewer_001');
      expect(preference).toBeTruthy();
      expect(preference?.mode).toBe('deuteranopia');
      expect(preference?.updated_at).toBeDefined();
    });

    it('updates existing color blind preference', async () => {
      // Create initial preference
      colorBlindRepository.save({
        viewer_id: 'test_viewer_001',
        mode: 'none',
      });

      // Update preference
      const request = createPutRequest({
        viewer_id: 'test_viewer_001',
        mode: 'tritanopia',
      });

      const response = await PUT(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toEqual({
        mode: 'tritanopia',
      });

      // Verify repository was updated
      const preference = colorBlindRepository.findByViewerId('test_viewer_001');
      expect(preference?.mode).toBe('tritanopia');
    });

    it('validates required fields', async () => {
      const request = createPutRequest({
        // Missing required fields
      });

      const response = await PUT(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.errors).toBeDefined();
    });

    it('validates mode enum', async () => {
      const request = createPutRequest({
        viewer_id: 'test_viewer_001',
        mode: 'invalid_mode',
      });

      const response = await PUT(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.errors).toContainEqual(
        expect.objectContaining({
          field: 'mode',
          message: expect.stringContaining('must be one of'),
        })
      );
    });

    it('accepts all valid color blind modes', async () => {
      const validModes = ['none', 'protanopia', 'deuteranopia', 'tritanopia'];
      
      for (const mode of validModes) {
        const request = createPutRequest({
          viewer_id: `test_viewer_${mode}`,
          mode: mode as any,
        });

        const response = await PUT(request);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.mode).toBe(mode);

        // Verify repository was updated
        const preference = colorBlindRepository.findByViewerId(`test_viewer_${mode}`);
        expect(preference?.mode).toBe(mode);
      }
    });

    it('trims whitespace from viewer_id', async () => {
      const request = createPutRequest({
        viewer_id: '  test_viewer_001  ',
        mode: 'protanopia',
      });

      const response = await PUT(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      // Verify trimmed viewer_id was saved
      const preference = colorBlindRepository.findByViewerId('test_viewer_001');
      expect(preference).toBeTruthy();
      expect(preference?.viewer_id).toBe('test_viewer_001');
    });

    it('requires valid JSON body', async () => {
      const request = new NextRequest('http://localhost/api/routesF/viewer-color-blind', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const response = await PUT(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });

  describe('Mode validation edge cases', () => {
    it('rejects empty mode string', async () => {
      const request = createPutRequest({
        viewer_id: 'test_viewer_001',
        mode: '',
      });

      const response = await PUT(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('rejects null mode', async () => {
      const request = createPutRequest({
        viewer_id: 'test_viewer_001',
        mode: null,
      });

      const response = await PUT(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('rejects undefined mode', async () => {
      const request = createPutRequest({
        viewer_id: 'test_viewer_001',
        // mode is undefined
      });

      const response = await PUT(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });

  describe('Repository persistence', () => {
    it('maintains separate preferences for different viewers', async () => {
      // Set different modes for different viewers
      await PUT(createPutRequest({
        viewer_id: 'viewer_001',
        mode: 'protanopia',
      }));

      await PUT(createPutRequest({
        viewer_id: 'viewer_002',
        mode: 'deuteranopia',
      }));

      await PUT(createPutRequest({
        viewer_id: 'viewer_003',
        mode: 'tritanopia',
      }));

      // Verify each viewer has their own preference
      const response1 = await GET(createGetRequest('viewer_001'));
      const response2 = await GET(createGetRequest('viewer_002'));
      const response3 = await GET(createGetRequest('viewer_003'));

      const data1 = await response1.json();
      const data2 = await response2.json();
      const data3 = await response3.json();

      expect(data1.data.mode).toBe('protanopia');
      expect(data2.data.mode).toBe('deuteranopia');
      expect(data3.data.mode).toBe('tritanopia');
    });

    it('updates timestamp on each update', async () => {
      const request1 = createPutRequest({
        viewer_id: 'test_viewer_001',
        mode: 'none',
      });

      const response1 = await PUT(request1);
      const data1 = await response1.json();
      expect(data1.success).toBe(true);

      // Get initial timestamp
      const preference1 = colorBlindRepository.findByViewerId('test_viewer_001');
      const initialTimestamp = preference1?.updated_at;

      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      // Update mode
      const request2 = createPutRequest({
        viewer_id: 'test_viewer_001',
        mode: 'protanopia',
      });

      const response2 = await PUT(request2);
      const data2 = await response2.json();
      expect(data2.success).toBe(true);

      // Verify timestamp was updated
      const preference2 = colorBlindRepository.findByViewerId('test_viewer_001');
      expect(preference2?.updated_at).not.toBe(initialTimestamp);
      expect(preference2?.mode).toBe('protanopia');
    });
  });
});