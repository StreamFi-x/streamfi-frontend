import { NextRequest } from 'next/server';
import { 
  validateColorBlindRequest,
  validateViewerIdQuery 
} from '../shared/validators';
import { colorBlindRepository } from '../shared/repositories';
import { 
  createSuccessResponse, 
  createErrorResponse,
  createValidationErrorResponse,
  createNotFoundErrorResponse 
} from '../shared/helpers/responseBuilders';
import { initializeRepositories } from '../shared/repositories';

// Initialize repositories with mock data
initializeRepositories();

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/routesF/viewer-color-blind
 * Get color blind preference for a viewer
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

    // Get color blind preference from repository
    const preference = colorBlindRepository.findByViewerId(viewerId!);

    if (!preference) {
      return createNotFoundErrorResponse('Color blind preference');
    }

    // Return preference
    const responseData = {
      mode: preference.mode,
    };

    return createSuccessResponse(responseData);
  } catch (error) {
    console.error('Viewer color blind GET error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

/**
 * PUT /api/routesF/viewer-color-blind
 * Set or update color blind preference for a viewer
 */
export async function PUT(request: NextRequest): Promise<Response> {
  try {
    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse('Invalid JSON body', 400);
    }

    // Validate request
    const validation = validateColorBlindRequest(body);
    if (!validation.isValid) {
      return createValidationErrorResponse(validation.errors);
    }

    const { viewer_id, mode } = validation.validatedData!;

    // Save preference to repository
    const savedPreference = colorBlindRepository.save({
      viewer_id,
      mode,
    });

    // Return updated preference
    const responseData = {
      mode: savedPreference.mode,
    };

    return createSuccessResponse(responseData);
  } catch (error) {
    console.error('Viewer color blind PUT error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}