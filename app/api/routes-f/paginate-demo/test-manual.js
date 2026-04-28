// Simple manual test to verify the pagination logic works
// This can be run with Node.js if available

// Mock the Buffer and JSON functionality for testing
const mockBuffer = {
  from: (str, encoding) => {
    if (encoding === 'base64') {
      // Simple base64 decode for testing
      return { toString: () => atob(str) };
    } else {
      // Simple base64 encode for testing
      return { toString: (enc) => enc === 'base64' ? btoa(str) : str };
    }
  }
};

// Mock the helper functions logic
function generateFakeRecords(count = 500) {
  const records = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(Math.random() * 730);
    const created_at = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
    created_at.setHours(Math.floor(Math.random() * 24));
    created_at.setMinutes(Math.floor(Math.random() * 60));
    created_at.setSeconds(Math.floor(Math.random() * 60));
    
    records.push({
      id: `record_${i + 1}`,
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      created_at: created_at.toISOString(),
      category: 'Test',
      status: 'active',
      score: Math.floor(Math.random() * 1000) + 1
    });
  }
  
  return records.sort((a, b) => {
    const dateCompare = b.created_at.localeCompare(a.created_at);
    if (dateCompare !== 0) return dateCompare;
    return a.id.localeCompare(b.id);
  });
}

function encodeCursor(cursorInfo) {
  const json = JSON.stringify(cursorInfo);
  return mockBuffer.from(json, 'utf8').toString('base64');
}

function decodeCursor(cursor) {
  try {
    const json = mockBuffer.from(cursor, 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    
    if (!parsed.created_at || !parsed.id) {
      throw new Error('Invalid cursor structure');
    }
    
    return parsed;
  } catch (error) {
    throw new Error('Invalid cursor format');
  }
}

function paginateRecords(records, cursor, limit = 20) {
  limit = Math.max(1, Math.min(100, limit || 20));
  
  let startIndex = 0;
  
  if (cursor) {
    const cursorInfo = decodeCursor(cursor);
    startIndex = records.findIndex(record => 
      record.created_at === cursorInfo.created_at && record.id === cursorInfo.id
    );
    
    if (startIndex === -1) {
      startIndex = 0;
    } else {
      startIndex += 1;
    }
  }
  
  const data = records.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < records.length;
  
  let nextCursor = null;
  if (hasMore && data.length > 0) {
    const lastRecord = data[data.length - 1];
    nextCursor = encodeCursor({
      created_at: lastRecord.created_at,
      id: lastRecord.id
    });
  }
  
  return { data, nextCursor, hasMore };
}

// Test the implementation
console.log('Testing cursor pagination implementation...\n');

// Generate test data
const testRecords = generateFakeRecords(50);
console.log(`Generated ${testRecords.length} test records`);

// Test 1: First page
console.log('\n=== Test 1: First page ===');
const page1 = paginateRecords(testRecords, undefined, 10);
console.log(`Page 1: ${page1.data.length} records`);
console.log(`Has more: ${page1.hasMore}`);
console.log(`Next cursor: ${page1.nextCursor ? 'present' : 'null'}`);

// Test 2: Second page
console.log('\n=== Test 2: Second page ===');
const page2 = paginateRecords(testRecords, page1.nextCursor, 10);
console.log(`Page 2: ${page2.data.length} records`);
console.log(`Has more: ${page2.hasMore}`);
console.log(`Next cursor: ${page2.nextCursor ? 'present' : 'null'}`);

// Test 3: No duplicates
console.log('\n=== Test 3: Check for duplicates ===');
const page1Ids = new Set(page1.data.map(r => r.id));
const page2Ids = new Set(page2.data.map(r => r.id));
const overlap = [...page1Ids].filter(id => page2Ids.has(id));
console.log(`Overlap between pages: ${overlap.length} records`);

// Test 4: Cursor round-trip
console.log('\n=== Test 4: Cursor round-trip ===');
const testCursor = encodeCursor({
  created_at: '2024-01-15T10:30:00.000Z',
  id: 'record_123'
});
const decoded = decodeCursor(testCursor);
console.log(`Original cursor: ${testCursor}`);
console.log(`Decoded matches: ${JSON.stringify(decoded) === JSON.stringify({created_at: '2024-01-15T10:30:00.000Z', id: 'record_123'})}`);

// Test 5: Full traversal
console.log('\n=== Test 5: Full traversal ===');
let allRecords = [];
let currentCursor = undefined;
let pageCount = 0;

while (true) {
  const result = paginateRecords(testRecords, currentCursor, 5);
  allRecords.push(...result.data);
  pageCount++;
  
  if (!result.hasMore) break;
  currentCursor = result.nextCursor;
}

console.log(`Total pages: ${pageCount}`);
console.log(`Total records retrieved: ${allRecords.length}`);
console.log(`Expected records: ${testRecords.length}`);
console.log(`Full traversal successful: ${allRecords.length === testRecords.length}`);

console.log('\n=== All tests completed ===');
