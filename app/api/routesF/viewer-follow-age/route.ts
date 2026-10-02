/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest } from 'next/server';
import { validateViewerIdQuery } from '../shared/validators';
import { getFollowSummaryForViewer } from '../shared/helpers/followAgeService';
import { 
  createSuccessResponse, 
  createErrorResponse,
  createNotFoundErrorResponse 
} from '../shared/helpers/responseBuilders';
import { initializeRepositories } from '../shared/repositories';

// Initialize repositories with mock data
initializeRepositories();

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/routesF/viewer-follow-age
 * Get follow age summary for a viewer
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    // Extract query parameters
    const url = new URL(request.url);
    const viewerId = url.searchParams.get('viewer_id');

    // Validate viewer_id parameter
    const validation = validateViewerIdQuery(viewerId);
    if (!validation.isValid) {
      return createErrorResponse(validation.error!, 400);
    }

    // Get follow summary
    const summary = getFollowSummaryForViewer(viewerId!);

    // Return summary (even if empty follows - that's a valid state)
    return createSuccessResponse(summary);
  } catch (error) {
    console.error('Viewer follow age GET error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}