import { NextRequest } from 'next/server';
import { validateBanExportRequest } from '../../helpers/validators';
import { generateCSV, createCSVResponse } from '../../helpers/csvExporter';
import { banRecordsRepository } from '../../helpers/repositories';
import '../../data/mockDatabase'; // Ensure database is initialized

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    // Parse query parameters
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());

    // Validate request
    const validation = validateBanExportRequest(params);
    if (!validation.valid) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.errors[0]?.message || 'Invalid request',
        },
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { creator_id } = validation.data!;

    // Get bans for creator
    const bans = banRecordsRepository.getByCreatorId(creator_id);

    // Generate CSV
    const csvContent = generateCSV(bans);

    // Return CSV response
    return createCSVResponse(csvContent);
  } catch (error) {
    console.error('Ban export API error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}