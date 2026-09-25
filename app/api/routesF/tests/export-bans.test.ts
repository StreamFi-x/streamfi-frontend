/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '../bans/export/route';
import { banRecordsRepository } from '../helpers/repositories';

function createRequest(params: Record<string, string>): NextRequest {
  const searchParams = new URLSearchParams(params);
  const url = `http://localhost/api/routesF/bans/export?${searchParams.toString()}`;
  return new NextRequest(url);
}

describe('Ban Export API', () => {
  beforeEach(() => {
    banRecordsRepository.clear();
  });

  describe('GET /api/routesF/bans/export', () => {
    it('exports bans as CSV with correct content type', async () => {
      // Seed test data
      banRecordsRepository.seed([
        {
          id: 'ban_1',
          creator_id: 'creator_001',
          viewer_id: 'viewer_001',
          reason: 'Spam with commas, and quotes"',
          banned_at: '2024-01-15T10:30:00Z',
        },
        {
          id: 'ban_2',
          creator_id: 'creator_001',
          viewer_id: 'viewer_002',
          reason: 'Hate Speech',
          banned_at: '2024-01-20T14:45:00Z',
        },
        {
          id: 'ban_other',
          creator_id: 'creator_002',
          viewer_id: 'viewer_003',
          reason: 'Bot',
          banned_at: '2024-02-05T09:15:00Z',
        },
      ]);

      const request = createRequest({ creator_id: 'creator_001' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/csv');
      expect(response.headers.get('Content-Disposition')).toBe(
        'attachment; filename="bans_export.csv"'
      );

      const csvText = await response.text();
      const lines = csvText.trim().split('\n');

      // Check header
      expect(lines[0]).toBe('viewer_id,reason,banned_at');

      // Should only export creator_001's bans (2 rows)
      expect(lines).toHaveLength(3); // Header + 2 data rows

      // Check data rows (order might vary, but content should be correct)
      expect(csvText).toContain('viewer_001');
      expect(csvText).toContain('viewer_002');
      expect(csvText).not.toContain('viewer_003'); // Should not include other creator's bans
      
      // Check CSV escaping for special characters
      expect(csvText).toContain('"Spam with commas, and quotes"""'); // Escaped quotes
    });

    it('returns empty CSV for creator with no bans', async () => {
      banRecordsRepository.seed([
        {
          id: 'ban_1',
          creator_id: 'creator_002',
          viewer_id: 'viewer_001',
          reason: 'Spam',
          banned_at: '2024-01-15T10:30:00Z',
        },
      ]);

      const request = createRequest({ creator_id: 'creator_001' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      
      const csvText = await response.text();
      const lines = csvText.trim().split('\n');
      
      expect(lines[0]).toBe('viewer_id,reason,banned_at');
      expect(lines).toHaveLength(1); // Only header
    });

    it('requires creator_id parameter', async () => {
      const request = createRequest({});
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('properly escapes CSV fields', async () => {
      banRecordsRepository.seed([
        {
          id: 'ban_1',
          creator_id: 'creator_001',
          viewer_id: 'viewer_001',
          reason: 'Reason with "quotes" and, commas',
          banned_at: '2024-01-15T10:30:00Z',
        },
      ]);

      const request = createRequest({ creator_id: 'creator_001' });
      const response = await GET(request);
      
      const csvText = await response.text();
      // Should properly escape the reason field
      expect(csvText).toContain('"Reason with ""quotes"" and, commas"');
    });

    it('includes correct banned_at timestamps', async () => {
      const testTimestamp = '2024-01-15T10:30:00Z';
      banRecordsRepository.seed([
        {
          id: 'ban_1',
          creator_id: 'creator_001',
          viewer_id: 'viewer_001',
          reason: 'Spam',
          banned_at: testTimestamp,
        },
      ]);

      const request = createRequest({ creator_id: 'creator_001' });
      const response = await GET(request);
      
      const csvText = await response.text();
      expect(csvText).toContain(testTimestamp);
    });

    it('handles multiple bans correctly', async () => {
      const bans = [];
      for (let i = 1; i <= 5; i++) {
        bans.push({
          id: `ban_${i}`,
          creator_id: 'creator_001',
          viewer_id: `viewer_${i.toString().padStart(3, '0')}`,
          reason: `Test reason ${i}`,
          banned_at: `2024-01-${i.toString().padStart(2, '0')}T10:30:00Z`,
        });
      }
      
      banRecordsRepository.seed(bans);

      const request = createRequest({ creator_id: 'creator_001' });
      const response = await GET(request);
      
      const csvText = await response.text();
      const lines = csvText.trim().split('\n');
      
      expect(lines).toHaveLength(6); // Header + 5 data rows
      
      // Verify all viewer IDs are present
      for (let i = 1; i <= 5; i++) {
        expect(csvText).toContain(`viewer_${i.toString().padStart(3, '0')}`);
      }
    });
  });
});