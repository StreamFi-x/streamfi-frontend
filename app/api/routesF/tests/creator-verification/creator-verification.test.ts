/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET, POST } from '../../creator-verification/route';
import { verificationRepository } from '../../shared/repositories';

function createGetRequest(requestId: string): NextRequest {
  return new NextRequest(`http://localhost/api/routesF/creator-verification?request_id=${requestId}`);
}

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/routesF/creator-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Creator Verification API', () => {
  beforeEach(() => {
    verificationRepository.clear();
  });

  describe('GET /api/routesF/creator-verification', () => {
    it('returns verification request status by ID', async () => {
      // Seed test data
      verificationRepository.seed([
        {
          request_id: 'ver_test_001',
          creator_id: 'creator_001',
          method: 'social',
          proof_links: ['https://twitter.com/test'],
          status: 'pending',
          submitted_at: '2024-01-01T10:30:00Z',
        },
      ]);

      const request = createGetRequest('ver_test_001');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toEqual({
        request_id: 'ver_test_001',
        creator_id: 'creator_001',
        method: 'social',
        status: 'pending',
        submitted_at: '2024-01-01T10:30:00Z',
        reviewed_at: undefined,
      });
      // proof_links should not be exposed
      expect(data.data.proof_links).toBeUndefined();
    });

    it('returns verification request with reviewed_at when applicable', async () => {
      verificationRepository.seed([
        {
          request_id: 'ver_test_002',
          creator_id: 'creator_002',
          method: 'id',
          proof_links: ['https://drive.google.com/proof'],
          status: 'approved',
          submitted_at: '2024-01-01T10:30:00Z',
          reviewed_at: '2024-01-02T14:45:00Z',
        },
      ]);

      const request = createGetRequest('ver_test_002');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toEqual({
        request_id: 'ver_test_002',
        creator_id: 'creator_002',
        method: 'id',
        status: 'approved',
        submitted_at: '2024-01-01T10:30:00Z',
        reviewed_at: '2024-01-02T14:45:00Z',
      });
    });

    it('returns 404 when request not found', async () => {
      const request = createGetRequest('nonexistent_request');
      const response = await GET(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('not found');
    });

    it('requires request_id parameter', async () => {
      const request = createGetRequest('');
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('request_id');
    });
  });

  describe('POST /api/routesF/creator-verification', () => {
    it('creates new verification request', async () => {
      const request = createPostRequest({
        creator_id: 'creator_001',
        method: 'social',
        proof_links: [
          'https://twitter.com/creator_001',
          'https://instagram.com/creator_001',
        ],
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toEqual({
        request_id: expect.any(String),
        status: 'pending',
      });

      // Verify repository was updated
      const savedRequest = verificationRepository.findById(data.data.request_id);
      expect(savedRequest).toBeTruthy();
      expect(savedRequest?.creator_id).toBe('creator_001');
      expect(savedRequest?.method).toBe('social');
      expect(savedRequest?.proof_links).toEqual([
        'https://twitter.com/creator_001',
        'https://instagram.com/creator_001',
      ]);
      expect(savedRequest?.status).toBe('pending');
      expect(savedRequest?.submitted_at).toBeDefined();
    });

    it('prevents duplicate pending requests for same creator', async () => {
      // Create first pending request
      verificationRepository.seed([
        {
          request_id: 'ver_existing_001',
          creator_id: 'creator_001',
          method: 'social',
          proof_links: ['https://twitter.com/test'],
          status: 'pending',
          submitted_at: '2024-01-01T10:30:00Z',
        },
      ]);

      // Try to create another pending request
      const request = createPostRequest({
        creator_id: 'creator_001',
        method: 'id',
        proof_links: ['https://drive.google.com/proof'],
      });

      const response = await POST(request);

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('already exists');
    });

    it('allows new request if previous request is not pending', async () => {
      // Create completed request
      verificationRepository.seed([
        {
          request_id: 'ver_completed_001',
          creator_id: 'creator_001',
          method: 'social',
          proof_links: ['https://twitter.com/test'],
          status: 'approved',
          submitted_at: '2024-01-01T10:30:00Z',
          reviewed_at: '2024-01-02T14:45:00Z',
        },
      ]);

      // Should allow new request since previous is approved (not pending)
      const request = createPostRequest({
        creator_id: 'creator_001',
        method: 'id',
        proof_links: ['https://drive.google.com/proof'],
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('validates required fields', async () => {
      const request = createPostRequest({
        // Missing required fields
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.errors).toBeDefined();
    });

    it('validates method enum', async () => {
      const request = createPostRequest({
        creator_id: 'creator_001',
        method: 'invalid_method',
        proof_links: ['https://twitter.com/test'],
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.errors).toBeDefined();
    });

    it('validates proof_links array', async () => {
      const request = createPostRequest({
        creator_id: 'creator_001',
        method: 'social',
        proof_links: 'not-an-array', // Invalid type
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('requires at least one proof link', async () => {
      const request = createPostRequest({
        creator_id: 'creator_001',
        method: 'social',
        proof_links: [], // Empty array
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.errors).toContainEqual(
        expect.objectContaining({
          field: 'proof_links',
          message: expect.stringContaining('At least'),
        })
      );
    });

    it('validates maximum proof links', async () => {
      const proofLinks = Array.from({ length: 15 }, (_, i) => `https://example.com/proof${i}`);

      const request = createPostRequest({
        creator_id: 'creator_001',
        method: 'social',
        proof_links: proofLinks, // Too many links
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.errors).toContainEqual(
        expect.objectContaining({
          field: 'proof_links',
          message: expect.stringContaining('Maximum'),
        })
      );
    });

    it('validates proof link URLs', async () => {
      const request = createPostRequest({
        creator_id: 'creator_001',
        method: 'social',
        proof_links: ['invalid-url', 'https://valid.com/proof'],
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.errors).toContainEqual(
        expect.objectContaining({
          field: 'proof_links[0]',
          message: expect.stringContaining('valid URL'),
        })
      );
    });

    it('trims whitespace from proof links', async () => {
      const request = createPostRequest({
        creator_id: 'creator_001',
        method: 'social',
        proof_links: ['  https://twitter.com/test  ', '  https://instagram.com/test  '],
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);

      // Verify trimmed links were saved
      const savedRequest = verificationRepository.findById(data.data.request_id);
      expect(savedRequest?.proof_links).toEqual([
        'https://twitter.com/test',
        'https://instagram.com/test',
      ]);
    });

    it('generates unique request IDs', async () => {
      const request1 = createPostRequest({
        creator_id: 'creator_001',
        method: 'social',
        proof_links: ['https://twitter.com/test1'],
      });

      const request2 = createPostRequest({
        creator_id: 'creator_002',
        method: 'id',
        proof_links: ['https://drive.google.com/proof2'],
      });

      const response1 = await POST(request1);
      const response2 = await POST(request2);

      const data1 = await response1.json();
      const data2 = await response2.json();

      expect(data1.data.request_id).not.toBe(data2.data.request_id);
      expect(data1.data.request_id).toMatch(/^ver_/);
      expect(data2.data.request_id).toMatch(/^ver_/);
    });
  });
});