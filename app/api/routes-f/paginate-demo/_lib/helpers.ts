import { FakeRecord, CursorInfo } from './types';

// Sample data for generating fake records
const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa', 'James', 'Jennifer'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
const categories = ['Technology', 'Finance', 'Healthcare', 'Education', 'Retail', 'Manufacturing', 'Consulting', 'Media'];
const statuses: Array<'active' | 'inactive' | 'pending'> = ['active', 'inactive', 'pending'];

/**
 * Generate fake records for demonstration
 */
export function generateFakeRecords(count: number = 500): FakeRecord[] {
  const records: FakeRecord[] = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    // Generate random date within the last 2 years
    const daysAgo = Math.floor(Math.random() * 730); // 0-730 days ago
    const created_at = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
    
    // Add some random time within the day
    created_at.setHours(Math.floor(Math.random() * 24));
    created_at.setMinutes(Math.floor(Math.random() * 60));
    created_at.setSeconds(Math.floor(Math.random() * 60));
    created_at.setMilliseconds(Math.floor(Math.random() * 1000));
    
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    
    records.push({
      id: `record_${i + 1}`,
      name: `${firstName} ${lastName}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      created_at: created_at.toISOString(),
      category: categories[Math.floor(Math.random() * categories.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      score: Math.floor(Math.random() * 1000) + 1 // 1-1000
    });
  }
  
  // Sort by created_at DESC, then by id ASC for stable ordering
  return records.sort((a, b) => {
    const dateCompare = b.created_at.localeCompare(a.created_at);
    if (dateCompare !== 0) return dateCompare;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Encode cursor info to base64 string
 */
export function encodeCursor(cursorInfo: CursorInfo): string {
  const json = JSON.stringify(cursorInfo);
  return Buffer.from(json).toString('base64');
}

/**
 * Decode base64 cursor to cursor info
 */
export function decodeCursor(cursor: string): CursorInfo {
  try {
    const json = Buffer.from(cursor, 'base64').toString('utf-8');
    const parsed = JSON.parse(json);
    
    // Validate the structure
    if (!parsed.created_at || !parsed.id) {
      throw new Error('Invalid cursor structure');
    }
    
    return parsed as CursorInfo;
  } catch (error) {
    throw new Error('Invalid cursor format');
  }
}

/**
 * Paginate records using cursor-based pagination
 */
export function paginateRecords(
  records: FakeRecord[],
  cursor?: string,
  limit: number = 20
): { data: FakeRecord[]; nextCursor: string | null; hasMore: boolean } {
  // Validate and normalize limit
  limit = Math.max(1, Math.min(100, limit || 20));
  
  let startIndex = 0;
  
  // If cursor is provided, find the starting position
  if (cursor) {
    const cursorInfo = decodeCursor(cursor);
    
    // Find the index of the record with the cursor position
    startIndex = records.findIndex(record => 
      record.created_at === cursorInfo.created_at && record.id === cursorInfo.id
    );
    
    // If not found, start from beginning (this handles invalid/expired cursors gracefully)
    if (startIndex === -1) {
      startIndex = 0;
    } else {
      // Start after the cursor position
      startIndex += 1;
    }
  }
  
  // Get the slice of records
  const data = records.slice(startIndex, startIndex + limit);
  
  // Determine if there are more records
  const hasMore = startIndex + limit < records.length;
  
  // Generate next cursor if there are more records
  let nextCursor: string | null = null;
  if (hasMore && data.length > 0) {
    const lastRecord = data[data.length - 1];
    nextCursor = encodeCursor({
      created_at: lastRecord.created_at,
      id: lastRecord.id
    });
  }
  
  return {
    data,
    nextCursor,
    hasMore
  };
}

/**
 * Validate limit parameter
 */
export function validateLimit(limit?: number): number {
  if (limit === undefined || limit === null) {
    return 20; // default
  }
  
  if (typeof limit !== 'number' || !Number.isInteger(limit)) {
    throw new Error('Limit must be an integer');
  }
  
  if (limit < 1) {
    throw new Error('Limit must be at least 1');
  }
  
  if (limit > 100) {
    throw new Error('Limit cannot exceed 100');
  }
  
  return limit;
}
