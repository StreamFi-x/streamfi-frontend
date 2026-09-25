import { NextRequest } from 'next/server';
import { validateCSVImportRequest } from '../../helpers/validators';
import { parseCSV } from '../../helpers/csvParser';
import { banRecordsRepository } from '../../helpers/repositories';
import { createSuccessResponse, createErrorResponse } from '../../helpers/response';
import '../../data/mockDatabase'; // Ensure database is initialized

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid JSON body');
    }

    // Validate request
    const validation = validateCSVImportRequest(body);
    if (!validation.valid) {
      return createErrorResponse('VALIDATION_ERROR', validation.errors[0]?.message || 'Invalid request');
    }

    const { creator_id, csv } = validation.data!;

    // Parse CSV
    const { rows: parsedRows, errors } = parseCSV(csv);
    
    // Check for existing bans to prevent duplicates
    const existingBans = banRecordsRepository.getByCreatorId(creator_id);
    const existingViewerIds = new Set(existingBans.map(ban => ban.viewer_id));
    
    const bansToImport = parsedRows.filter(row => !existingViewerIds.has(row.viewer_id));
    const duplicateCount = parsedRows.length - bansToImport.length;
    
    if (duplicateCount > 0) {
      errors.push(`Duplicate viewer_ids found: ${duplicateCount} rows skipped`);
    }

    // Import bans
    const importedBans = banRecordsRepository.addMany(
      bansToImport.map(row => ({
        creator_id,
        viewer_id: row.viewer_id,
        reason: row.reason,
      }))
    );

    // Prepare response
    const skipped = errors.length + duplicateCount;
    const reasons = errors;

    if (duplicateCount > 0) {
      reasons.unshift(`${duplicateCount} duplicate viewer_id(s) skipped`);
    }

    const result = {
      imported: importedBans.length,
      skipped,
      reasons,
    };

    return createSuccessResponse(result);
  } catch (error) {
    console.error('Ban import API error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred');
  }
}