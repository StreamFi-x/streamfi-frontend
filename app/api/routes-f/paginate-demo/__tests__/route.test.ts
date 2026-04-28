import { NextRequest } from 'next/server';
import { GET } from '../route';
import { 
  generateFakeRecords, 
  encodeCursor, 
  decodeCursor, 
  paginateRecords, 
  validateLimit 
} from '../_lib/helpers';
import { FakeRecord, CursorInfo } from '../_lib/types';

// Mock the NextRequest
global.NextRequest = class MockNextRequest extends Request {
  constructor(input: string | Request, init?: RequestInit) {
    super(input, init);
  }
} as any;

describe('Cursor Pagination API', () => {
  let testRecords: FakeRecord[];
  
  beforeEach(() => {
    // Generate consistent test data
    testRecords = generateFakeRecords(50); // Smaller dataset for testing
  });

  describe('generateFakeRecords', () => {
    test('should generate the requested number of records', () => {
      const records = generateFakeRecords(10);
      expect(records).toHaveLength(10);
    });

    test('should generate records with required fields', () => {
      const records = generateFakeRecords(1);
      const record = records[0];
      
      expect(record).toHaveProperty('id');
      expect(record).toHaveProperty('name');
      expect(record).toHaveProperty('email');
      expect(record).toHaveProperty('created_at');
      expect(record).toHaveProperty('category');
      expect(record).toHaveProperty('status');
      expect(record).toHaveProperty('score');
      
      expect(typeof record.id).toBe('string');
      expect(typeof record.name).toBe('string');
      expect(typeof record.email).toBe('string');
      expect(typeof record.created_at).toBe('string');
      expect(typeof record.category).toBe('string');
      expect(['active', 'inactive', 'pending']).toContain(record.status);
      expect(typeof record.score).toBe('number');
    });

    test('should sort records by created_at DESC, then id ASC', () => {
      const records = generateFakeRecords(10);
      
      for (let i = 1; i < records.length; i++) {
        const prev = records[i - 1];
        const curr = records[i];
        
        const dateCompare = curr.created_at.localeCompare(prev.created_at);
        if (dateCompare === 0) {
          // Same date, check id ordering
          expect(prev.id.localeCompare(curr.id)).toBeLessThanOrEqual(0);
        } else {
          // Different dates, should be descending
          expect(dateCompare).toBeLessThan(0);
        }
      }
    });
  });

  describe('encodeCursor/decodeCursor', () => {
    test('should round-trip cursor correctly', () => {
      const original: CursorInfo = {
        created_at: '2024-01-15T10:30:00.000Z',
        id: 'record_123'
      };
      
      const encoded = encodeCursor(original);
      const decoded = decodeCursor(encoded);
      
      expect(decoded).toEqual(original);
    });

    test('should produce valid base64', () => {
      const cursorInfo: CursorInfo = {
        created_at: '2024-01-15T10:30:00.000Z',
        id: 'record_123'
      };
      
      const encoded = encodeCursor(cursorInfo);
      expect(/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)).toBe(true);
    });

    test('should throw error for invalid cursor format', () => {
      expect(() => decodeCursor('invalid-base64!')).toThrow('Invalid cursor format');
      expect(() => decodeCursor('dmFsaWQ=')) // "valid" but missing fields
        .toThrow('Invalid cursor structure');
    });

    test('should throw error for malformed JSON', () => {
      const malformedBase64 = Buffer.from('invalid-json').toString('base64');
      expect(() => decodeCursor(malformedBase64)).toThrow('Invalid cursor format');
    });
  });

  describe('validateLimit', () => {
    test('should return default limit for undefined', () => {
      expect(validateLimit(undefined)).toBe(20);
    });

    test('should return valid limit within bounds', () => {
      expect(validateLimit(10)).toBe(10);
      expect(validateLimit(1)).toBe(1);
      expect(validateLimit(100)).toBe(100);
    });

    test('should throw error for non-integer', () => {
      expect(() => validateLimit(10.5)).toThrow('Limit must be an integer');
      expect(() => validateLimit(NaN)).toThrow('Limit must be an integer');
    });

    test('should throw error for out of bounds', () => {
      expect(() => validateLimit(0)).toThrow('Limit must be at least 1');
      expect(() => validateLimit(-1)).toThrow('Limit must be at least 1');
      expect(() => validateLimit(101)).toThrow('Limit cannot exceed 100');
    });
  });

  describe('paginateRecords', () => {
    test('should return first page without cursor', () => {
      const result = paginateRecords(testRecords, undefined, 10);
      
      expect(result.data).toHaveLength(10);
      expect(result.nextCursor).toBeTruthy();
      expect(result.hasMore).toBe(true);
    });

    test('should return all records if limit exceeds dataset', () => {
      const result = paginateRecords(testRecords, undefined, 100);
      
      expect(result.data).toHaveLength(testRecords.length);
      expect(result.nextCursor).toBeNull();
      expect(result.hasMore).toBe(false);
    });

    test('should paginate correctly with cursor', () => {
      const page1 = paginateRecords(testRecords, undefined, 5);
      expect(page1.data).toHaveLength(5);
      expect(page1.hasMore).toBe(true);
      
      const page2 = paginateRecords(testRecords, page1.nextCursor!, 5);
      expect(page2.data).toHaveLength(5);
      expect(page2.data[0]).not.toEqual(page1.data[4]); // No overlap
      
      // Verify ordering is maintained
      const allRecords = [...page1.data, ...page2.data];
      for (let i = 1; i < allRecords.length; i++) {
        const prev = allRecords[i - 1];
        const curr = allRecords[i];
        const dateCompare = curr.created_at.localeCompare(prev.created_at);
        if (dateCompare === 0) {
          expect(prev.id.localeCompare(curr.id)).toBeLessThanOrEqual(0);
        } else {
          expect(dateCompare).toBeLessThan(0);
        }
      }
    });

    test('should handle last page correctly', () => {
      const pageSize = Math.ceil(testRecords.length / 2);
      const page1 = paginateRecords(testRecords, undefined, pageSize);
      const page2 = paginateRecords(testRecords, page1.nextCursor!, pageSize);
      
      expect(page2.data).toHaveLength(testRecords.length - pageSize);
      expect(page2.nextCursor).toBeNull();
      expect(page2.hasMore).toBe(false);
    });

    test('should handle invalid cursor gracefully', () => {
      const result = paginateRecords(testRecords, 'invalid-cursor', 10);
      
      // Should start from beginning
      expect(result.data).toHaveLength(10);
      expect(result.data[0]).toEqual(testRecords[0]);
    });

    test('should handle cursor pointing to non-existent record', () => {
      const fakeCursor = encodeCursor({
        created_at: '9999-12-31T23:59:59.999Z',
        id: 'non-existent'
      });
      
      const result = paginateRecords(testRecords, fakeCursor, 10);
      
      // Should start from beginning
      expect(result.data).toHaveLength(10);
      expect(result.data[0]).toEqual(testRecords[0]);
    });
  });

  describe('GET /api/routes-f/paginate-demo', () => {
    test('should return first page without parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/paginate-demo');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(20); // default limit
      expect(data.next_cursor).toBeTruthy();
      expect(data.has_more).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    test('should respect limit parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/paginate-demo?limit=5');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(5);
      expect(data.next_cursor).toBeTruthy();
      expect(data.has_more).toBe(true);
    });

    test('should handle cursor parameter', async () => {
      // First request to get a cursor
      const request1 = new NextRequest('http://localhost:3000/api/routes-f/paginate-demo?limit=5');
      const response1 = await GET(request1);
      const data1 = await response1.json();
      
      // Second request with cursor
      const request2 = new NextRequest(`http://localhost:3000/api/routes-f/paginate-demo?limit=5&cursor=${data1.next_cursor}`);
      const response2 = await GET(request2);
      const data2 = await response2.json();
      
      expect(response2.status).toBe(200);
      expect(data2.data).toHaveLength(5);
      expect(data2.data[0]).not.toEqual(data1.data[4]); // No duplicates
      
      // Verify all records have required fields
      data2.data.forEach((record: FakeRecord) => {
        expect(record).toHaveProperty('id');
        expect(record).toHaveProperty('name');
        expect(record).toHaveProperty('email');
        expect(record).toHaveProperty('created_at');
        expect(record).toHaveProperty('category');
        expect(record).toHaveProperty('status');
        expect(record).toHaveProperty('score');
      });
    });

    test('should reject invalid limit', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/paginate-demo?limit=0');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain('at least 1');
    });

    test('should reject limit exceeding maximum', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/paginate-demo?limit=101');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain('cannot exceed 100');
    });

    test('should reject non-integer limit', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/paginate-demo?limit=abc');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain('integer');
    });

    test('should reject invalid cursor format', async () => {
      const request = new NextRequest('http://localhost:3000/api/routes-f/paginate-demo?cursor=invalid-base64!');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid cursor format');
    });

    test('should reject malformed cursor', async () => {
      const malformedBase64 = Buffer.from('invalid-json').toString('base64');
      const request = new NextRequest(`http://localhost:3000/api/routes-f/paginate-demo?cursor=${malformedBase64}`);
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid cursor format');
    });
  });

  describe('Full Dataset Traversal', () => {
    test('should traverse entire dataset without duplicates or skips', async () => {
      const allSeenIds = new Set<string>();
      let cursor: string | undefined = undefined;
      let pageCount = 0;
      
      while (true) {
        const url = cursor 
          ? `http://localhost:3000/api/routes-f/paginate-demo?limit=10&cursor=${cursor}`
          : 'http://localhost:3000/api/routes-f/paginate-demo?limit=10';
        
        const request = new NextRequest(url);
        const response = await GET(request);
        const data = await response.json();
        
        expect(response.status).toBe(200);
        expect(Array.isArray(data.data)).toBe(true);
        
        // Check for duplicates
        data.data.forEach((record: FakeRecord) => {
          expect(allSeenIds.has(record.id)).toBe(false);
          allSeenIds.add(record.id);
        });
        
        pageCount++;
        
        if (!data.has_more) {
          expect(data.next_cursor).toBeNull();
          break;
        }
        
        expect(data.next_cursor).toBeTruthy();
        cursor = data.next_cursor;
      }
      
      // Should have seen all records
      expect(allSeenIds.size).toBe(500); // Default dataset size
      expect(pageCount).toBeGreaterThan(1);
    });

    test('should maintain consistent ordering across pages', async () => {
      const allRecords: FakeRecord[] = [];
      let cursor: string | undefined = undefined;
      
      // Collect all records
      while (true) {
        const url = cursor 
          ? `http://localhost:3000/api/routes-f/paginate-demo?limit=20&cursor=${cursor}`
          : 'http://localhost:3000/api/routes-f/paginate-demo?limit=20';
        
        const request = new NextRequest(url);
        const response = await GET(request);
        const data = await response.json();
        
        allRecords.push(...data.data);
        
        if (!data.has_more) break;
        cursor = data.next_cursor;
      }
      
      // Verify ordering
      for (let i = 1; i < allRecords.length; i++) {
        const prev = allRecords[i - 1];
        const curr = allRecords[i];
        const dateCompare = curr.created_at.localeCompare(prev.created_at);
        if (dateCompare === 0) {
          expect(prev.id.localeCompare(curr.id)).toBeLessThanOrEqual(0);
        } else {
          expect(dateCompare).toBeLessThan(0);
        }
      }
    });
  });
});
