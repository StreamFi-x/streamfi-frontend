import { NextRequest } from 'next/server';
import { validateGoalRateRequest } from '../helpers/validators';
import { getGoalStats } from '../helpers/goalCalculator';
import { goalHistoryRepository } from '../helpers/repositories';
import { createSuccessResponse, createErrorResponse } from '../helpers/response';
import '../data/mockDatabase'; // Ensure database is initialized

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    // Parse query parameters
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());

    // Validate request
    const validation = validateGoalRateRequest(params);
    if (!validation.valid) {
      return createErrorResponse('VALIDATION_ERROR', validation.errors[0]?.message || 'Invalid request');
    }

    // Get data from repository
    const allGoals = goalHistoryRepository.getAll();
    
    // Calculate goal attainment rate
    const stats = getGoalStats(
      allGoals,
      validation.data!.creator_id,
      validation.data!.last_n_goals
    );

    return createSuccessResponse(stats);
  } catch (error) {
    console.error('Goal attainment API error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred');
  }
}