import { NextRequest } from 'next/server';
import { 
  validateLogModerationRequest, 
  validateGetModerationLogsRequest 
} from '../../helpers/validators';
import { moderationLogsRepository } from '../../helpers/repositories';
import { createSuccessResponse, createErrorResponse } from '../../helpers/response';
import '../../data/mockDatabase'; // Ensure database is initialized

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    // Parse query parameters
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());

    // Validate request
    const validation = validateGetModerationLogsRequest(params);
    if (!validation.valid) {
      return createErrorResponse('VALIDATION_ERROR', validation.errors[0]?.message || 'Invalid request');
    }

    const { creator_id, mod_id } = validation.data!;

    // Get logs from repository
    const logs = moderationLogsRepository.getByCreatorIdAndModId(creator_id, mod_id);

    return createSuccessResponse({ logs });
  } catch (error) {
    console.error('Get moderation logs API error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred');
  }
}

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
    const validation = validateLogModerationRequest(body);
    if (!validation.valid) {
      return createErrorResponse('VALIDATION_ERROR', validation.errors[0]?.message || 'Invalid request');
    }

    const { creator_id, mod_id, action, target_id, reason } = validation.data!;

    // Add log to repository
    const newLog = moderationLogsRepository.add({
      creator_id,
      mod_id,
      action,
      target_id,
      reason,
    });

    return createSuccessResponse(newLog);
  } catch (error) {
    console.error('Log moderation action API error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred');
  }
}