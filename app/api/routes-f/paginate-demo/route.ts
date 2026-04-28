import { NextRequest, NextResponse } from 'next/server';
import { PaginateRequest, PaginateResponse, PaginateError } from './_lib/types';
import { generateFakeRecords, paginateRecords, validateLimit } from './_lib/helpers';

// Generate the dataset once (in production, this would come from a database)
const fakeRecords = generateFakeRecords(500);

export async function GET(req: NextRequest) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor') || undefined;
    const limitParam = searchParams.get('limit');
    
    // Validate limit parameter
    let limit: number;
    try {
      limit = limitParam ? parseInt(limitParam, 10) : undefined;
      limit = validateLimit(limit);
    } catch (error) {
      return NextResponse.json<PaginateError>(
        { error: error instanceof Error ? error.message : 'Invalid limit parameter' },
        { status: 400 }
      );
    }
    
    // Validate cursor if provided
    if (cursor) {
      try {
        // Basic validation - check if it looks like base64
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cursor)) {
          throw new Error('Invalid cursor format');
        }
        
        // Attempt to decode to verify structure
        const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
        JSON.parse(decoded); // Will throw if invalid JSON
      } catch (error) {
        return NextResponse.json<PaginateError>(
          { error: 'Invalid cursor format' },
          { status: 400 }
        );
      }
    }
    
    // Paginate the records
    const result = paginateRecords(fakeRecords, cursor, limit);
    
    const response: PaginateResponse = {
      data: result.data,
      next_cursor: result.nextCursor,
      has_more: result.hasMore
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Pagination error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json<PaginateError>(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
