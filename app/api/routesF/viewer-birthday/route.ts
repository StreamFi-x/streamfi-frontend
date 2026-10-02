import { NextRequest } from 'next/server';
import { 
  validateBirthdayRequest,
  validateViewerIdQuery 
} from '../shared/validators';
import { birthdayRepository } from '../shared/repositories';
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
 * GET /api/routesF/viewer-birthday
 * Get birthday configuration for a viewer
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

    // Get birthday configuration from repository
    const config = birthdayRepository.findByViewerId(viewerId!);

    if (!config) {
      return createNotFoundErrorResponse('Birthday configuration');
    }

    // Build response based on configuration
    const responseData = {
      share_with_creators: config.share_with_creators,
      ...(config.birthday_iso && { birthday_iso: config.birthday_iso }),
    };

    return createSuccessResponse(responseData);
  } catch (error) {
    console.error('Viewer birthday GET error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

/**
 * PUT /api/routesF/viewer-birthday
 * Set or update birthday configuration for a viewer
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
    const validation = validateBirthdayRequest(body);
    if (!validation.isValid) {
      return createValidationErrorResponse(validation.errors);
    }

    const { viewer_id, birthday_iso, share_with_creators } = validation.validatedData!;

    // Save configuration to repository
    const savedConfig = birthdayRepository.save({
      viewer_id,
      birthday_iso,
      share_with_creators,
    });

    // Build response
    const responseData = {
      birthday_iso: savedConfig.birthday_iso,
      share_with_creators: savedConfig.share_with_creators,
    };

    return createSuccessResponse(responseData);
  } catch (error) {
    console.error('Viewer birthday PUT error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

/**
 * DELETE /api/routesF/viewer-birthday
 * Remove birthday configuration for a viewer
 */
export async function DELETE(request: NextRequest): Promise<Response> {
  try {
    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse('Invalid JSON body', 400);
    }

    if (!body || typeof body !== 'object') {
      return createErrorResponse('Request body is required', 400);
    }

    const { viewer_id } = body as Record<string, unknown>;

    // Validate viewer_id
    if (!viewer_id || typeof viewer_id !== 'string' || viewer_id.trim().length === 0) {
      return createErrorResponse('viewer_id is required', 400);
    }

    // Delete configuration from repository
    const deleted = birthdayRepository.deleteByViewerId(viewer_id as string);

    if (!deleted) {
      return createNotFoundErrorResponse('Birthday configuration');
    }

    return createSuccessResponse({ success: true });
  } catch (error) {
    console.error('Viewer birthday DELETE error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}