import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth/verify-session';
import { recordExperimentEvent } from '@/lib/experimentation/experiment-tracker';
import { logger } from '@/lib/tracing/logger';

export const runtime = 'nodejs';

/**
 * POST /api/routes-f/experiment-event
 *
 * Records an experiment outcome event for the authenticated user.
 * Events are persisted and later joined against experiment assignments to
 * compute metrics, conversion rates, and statistical significance.
 *
 * Request Body:
 *   {
 *     experiment_id: string (UUID)
 *     event_type: string (e.g., 'click', 'view', 'conversion', 'signup')
 *     event_data?: Record<string, any> (optional event-specific data)
 *   }
 *
 * Response:
 *   {
 *     success: true
 *     event_id: string
 *     recorded_at: string (ISO timestamp)
 *   }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    const body = await req.json();
    const { experiment_id, event_type, event_data } = body;

    // Validate required fields
    if (!experiment_id || !event_type) {
      return NextResponse.json(
        { error: 'Missing required fields: experiment_id, event_type' },
        { status: 400 }
      );
    }

    // Record the event
    await recordExperimentEvent(
      session.userId,
      experiment_id,
      event_type,
      event_data || {}
    );

    logger.info('[experiment-event] Event recorded', {
      operation: 'experiment-event.POST',
      userId: session.userId,
      experimentId: experiment_id,
      eventType: event_type,
    });

    return NextResponse.json(
      {
        success: true,
        event_id: `${session.userId}-${experiment_id}-${event_type}-${Date.now()}`,
        recorded_at: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    logger.error('[experiment-event] POST error', {
      operation: 'experiment-event.POST',
      userId: session.userId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: 'Failed to record experiment event' },
      { status: 500 }
    );
  }
}
