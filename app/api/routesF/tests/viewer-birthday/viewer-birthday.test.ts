/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET, PUT, DELETE } from '../../viewer-birthday/route';
import { birthdayRepository } from '../../shared/repositories';

function createGetRequest(viewerId: string): NextRequest {
  return new NextRequest(`http://localhost/api/routesF/viewer-birthday?viewer_id=${viewerId}`);
}

function createPutRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/routesF/viewer-birthday', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function createDeleteRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/routesF/viewer-birthday', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Viewer Birthday API', () => {
  beforeEach(() => {
    birthdayRepository.clear();
  });

  describe('GET /api/routesF/viewer-birthday', () => {
    it('returns birthday configuration for a viewer', async () => {
      // Seed test data
      birthdayRepository.save({
        viewer_id: 'test_viewer_001',
        birthday_iso: '1995-03-15',
        share_with_creators: true,
      });

      const request = createGetRequest('test_viewer_001');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toEqual({
        birthday_iso: '1995-03-15',
        share_with_creators: true,
      });
    });

    it('returns configuration without birthday_iso when not set', async () => {
      birthdayRepository.save({
        viewer_id: 'test_viewer_002',
        birthday_iso: null,
        share_with_creators: false,
      });

      const request = createGetRequest('test_viewer_002');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toEqual({
        share_with_creators: false,
      });
      expect(data.data.birthday_iso).toBeUndefined();
    });

    it('returns 404 when configuration not found', async () => {
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
  });

  describe('PUT /api/routesF/viewer-birthday', () => {
    it('creates new birthday configuration', async () => {
      const request = createPutRequest({
        viewer_id: 'test_viewer_001',
        birthday_iso: '1995-03-15',
        share_with_creators: true,
      });

      const response = await PUT(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toEqual({
        birthday_iso: '1995-03-15',
        share_with_creators: true,
      });

      // Verify repository was updated
      const config = birthdayRepository.findByViewerId('test_viewer_001');
      expect(config).toBeTruthy();
      expect(config?.birthday_iso).toBe('1995-03-15');
      expect(config?.share_with_creators).toBe(true);
    });

    it('updates existing birthday configuration', async () => {
      // Create initial configuration
      birthdayRepository.save({
        viewer_id: 'test_viewer_001',
        birthday_iso: '1995-03-15',
        share_with_creators: true,
      });

      // Update configuration
      const request = createPutRequest({
        viewer_id: 'test_viewer_001',
        birthday_iso: '1998-07-22',
        share_with_creators: false,
      });

      const response = await PUT(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toEqual({
        birthday_iso: '1998-07-22',
        share_with_creators: false,
      });

      // Verify repository was updated
      const config = birthdayRepository.findByViewerId('test_viewer_001');
      expect(config?.birthday_iso).toBe('1998-07-22');
      expect(config?.share_with_creators).toBe(false);
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

    it('validates date format', async () => {
      const request = createPutRequest({
        viewer_id: 'test_viewer_001',
        birthday_iso: 'invalid-date',
        share_with_creators: true,
      });

      const response = await PUT(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('rejects future dates', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      const request = createPutRequest({
        viewer_id: 'test_viewer_001',
        birthday_iso: futureDateStr,
        share_with_creators: true,
      });

      const response = await PUT(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('future');
    });

    it('validates share_with_creators as boolean', async () => {
      const request = createPutRequest({
        viewer_id: 'test_viewer_001',
        birthday_iso: '1995-03-15',
        share_with_creators: 'not-a-boolean',
      });

      const response = await PUT(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });

  describe('DELETE /api/routesF/viewer-birthday', () => {
    it('deletes birthday configuration', async () => {
      // Create configuration first
      birthdayRepository.save({
        viewer_id: 'test_viewer_001',
        birthday_iso: '1995-03-15',
        share_with_creators: true,
      });

      const request = createDeleteRequest({
        viewer_id: 'test_viewer_001',
      });

      const response = await DELETE(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.success).toBe(true);

      // Verify repository was updated
      const config = birthdayRepository.findByViewerId('test_viewer_001');
      expect(config).toBeNull();
    });

    it('returns 404 when configuration not found', async () => {
      const request = createDeleteRequest({
        viewer_id: 'nonexistent_viewer',
      });

      const response = await DELETE(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('requires viewer_id field', async () => {
      const request = createDeleteRequest({
        // Missing viewer_id
      });

      const response = await DELETE(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('requires valid JSON body', async () => {
      const request = new NextRequest('http://localhost/api/routesF/viewer-birthday', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const response = await DELETE(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });

  describe('Birthday validation', () => {
    it('rejects dates that are too old', async () => {
      const request = createPutRequest({
        viewer_id: 'test_viewer_001',
        birthday_iso: '1800-01-01',
        share_with_creators: true,
      });

      const response = await PUT(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('rejects dates that are too young', async () => {
      const currentYear = new Date().getFullYear();
      const request = createPutRequest({
        viewer_id: 'test_viewer_001',
        birthday_iso: `${currentYear - 10}-01-01`,
        share_with_creators: true,
      });

      const response = await PUT(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('at least');
    });
  });
});