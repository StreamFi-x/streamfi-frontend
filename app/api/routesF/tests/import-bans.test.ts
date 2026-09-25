/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from '../bans/import/route';
import { banRecordsRepository } from '../helpers/repositories';

function createRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/routesF/bans/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Ban Import API', () => {
  beforeEach(() => {
    banRecordsRepository.clear();
  });

  describe('POST /api/routesF/bans/import', () => {
    it('imports valid CSV rows successfully', async () => {
      const csvContent = `viewer_id,reason
viewer_001,Spam
viewer_002,Hate Speech
viewer_003,Bot`;

      const request = createRequest({
        creator_id: 'creator_001',
        csv: csvContent,
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toEqual({
        imported: 3,
        skipped: 0,
        reasons: [],
      });

      // Verify bans were added to repository
      const bans = banRecordsRepository.getByCreatorId('creator_001');
      expect(bans).toHaveLength(3);
      expect(bans[0].viewer_id).toBe('viewer_001');
      expect(bans[0].reason).toBe('Spam');
      expect(bans[0].creator_id).toBe('creator_001');
      expect(bans[0].banned_at).toBeDefined();
    });

    it('skips duplicate viewer_ids', async () => {
      // Seed existing ban
      banRecordsRepository.add('creator_001', 'viewer_001', 'Existing Ban');

      const csvContent = `viewer_id,reason
viewer_001,Spam
viewer_002,Hate Speech
viewer_003,Bot`;

      const request = createRequest({
        creator_id: 'creator_001',
        csv: csvContent,
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toEqual({
        imported: 2,
        skipped: 1,
        reasons: expect.arrayContaining(['1 duplicate viewer_id(s) skipped']),
      });

      // Only 2 new bans should be added (plus the 1 existing)
      const bans = banRecordsRepository.getByCreatorId('creator_001');
      expect(bans).toHaveLength(3);
    });

    it('handles malformed CSV rows', async () => {
      const csvContent = `viewer_id,reason
viewer_001,Spam
invalid_row_missing_comma
viewer_002,Hate Speech
,Missing viewer ID`;

      const request = createRequest({
        creator_id: 'creator_001',
        csv: csvContent,
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.imported).toBe(2);
      expect(data.data.skipped).toBeGreaterThan(0);
      expect(data.data.reasons).toEqual(
        expect.arrayContaining([
          'Row 2: Malformed row - expected 2 columns, got 1',
          'Row 4: Missing viewer_id',
        ])
      );
    });

    it('respects maximum 500 rows limit', async () => {
      // Create CSV with 600 rows
      const rows = [];
      rows.push('viewer_id,reason');
      for (let i = 1; i <= 600; i++) {
        rows.push(`viewer_${i.toString().padStart(3, '0')},Test reason ${i}`);
      }
      const csvContent = rows.join('\n');

      const request = createRequest({
        creator_id: 'creator_001',
        csv: csvContent,
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.imported).toBe(500); // Only first 500 rows
      expect(data.data.skipped).toBeGreaterThan(0);
      expect(data.data.reasons).toContain('Maximum rows exceeded (600 > 500)');
    });

    it('requires valid JSON body', async () => {
      const request = new NextRequest('http://localhost/api/routesF/bans/import', {
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

    it('requires creator_id and csv fields', async () => {
      const request = createRequest({});
      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('handles CSV with quoted fields', async () => {
      const csvContent = `viewer_id,reason
viewer_001,"Spam, multiple times"
viewer_002,"Contains "quotes" in reason"
viewer_003,Bot`;

      const request = createRequest({
        creator_id: 'creator_001',
        csv: csvContent,
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.imported).toBe(3);
      
      const bans = banRecordsRepository.getByCreatorId('creator_001');
      expect(bans[0].reason).toBe('Spam, multiple times');
      expect(bans[1].reason).toBe('Contains "quotes" in reason');
    });

    it('adds timestamp to imported bans', async () => {
      const csvContent = `viewer_id,reason
viewer_001,Spam`;

      const request = createRequest({
        creator_id: 'creator_001',
        csv: csvContent,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      
      const bans = banRecordsRepository.getByCreatorId('creator_001');
      expect(bans[0].banned_at).toBeDefined();
      expect(new Date(bans[0].banned_at)).toBeInstanceOf(Date);
      expect(new Date(bans[0].banned_at).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });
});