import { NextRequest } from 'next/server';
import { 
  validateVerificationRequest,
  validateCreatorIdQuery,
  validateRequestIdQuery 
} from '../shared/validators';
import { verificationRepository } from '../shared/repositories';
import { 
  createSuccessResponse, 
  createErrorResponse,
  createValidationErrorResponse,
  createNotFoundErrorResponse,
  createConflictErrorResponse 
} from '../shared/helpers/responseBuilders';
import { initializeRepositories } from '../shared/repositories';

// Initialize repositories with mock data
initializeRepositories();

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/routesF/creator-verification
 * Get verification request status by request ID
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    // Extract query parameters
    const url = new URL(request.url);
    const requestId = url.searchParams.get('request_id');

    // Validate request_id parameter
    const validation = validateRequestIdQuery(requestId);
    if (!validation.isValid) {
      return createErrorResponse(validation.error!, 400);
    }

    // Get verification request from repository
    const verificationRequest = verificationRepository.findById(requestId!);

    if (!verificationRequest) {
      return createNotFoundErrorResponse('Verification request');
    }

    // Return only public fields (exclude proof_links for security)
    const responseData = {
      request_id: verificationRequest.request_id,
      creator_id: verificationRequest.creator_id,
      method: verificationRequest.method,
      status: verificationRequest.status,
      submitted_at: verificationRequest.submitted_at,
      reviewed_at: verificationRequest.reviewed_at,
    };

    return createSuccessResponse(responseData);
  } catch (error) {
    console.error('Creator verification GET error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

/**
 * POST /api/routesF/creator-verification
 * Submit a new verification request
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse('Invalid JSON body', 400);
    }

    // Validate request
    const validation = validateVerificationRequest(body);
    if (!validation.isValid) {
      return createValidationErrorResponse(validation.errors);
    }

    const { creator_id, method, proof_links } = validation.validatedData!;

    // Check for existing pending request
    if (verificationRepository.hasPendingRequest(creator_id)) {
      return createConflictErrorResponse('A pending verification request already exists for this creator');
    }

    // Create verification request in repository
    const newRequest = verificationRepository.create({
      creator_id,
      method,
      proof_links,
    });

    // Return response with generated request ID
    const responseData = {
      request_id: newRequest.request_id,
      status: newRequest.status,
    };

    return createSuccessResponse(responseData, 201);
  } catch (error) {
    console.error('Creator verification POST error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}