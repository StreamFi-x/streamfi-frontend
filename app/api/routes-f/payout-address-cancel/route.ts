/**
 * POST /api/routes-f/payout-address-cancel
 * 
 * Cancel a pending payout address change
 * Can be called with just a request ID (via email link) without authentication
 * or with authentication for additional security
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifySession } from '@/lib/auth/verify-session';
import { logger } from '@/lib/tracing/logger';
import { withTracing } from '@/lib/tracing/api-route-wrapper';
import { PayoutAddressVerifier, DEFAULT_VERIFICATION_CONFIG } from '@/lib/payouts/payout-address-verifier';

const bodySchema = z.object({
  requestId: z.string(),
});

// Global instance
const verifier = new PayoutAddressVerifier(DEFAULT_VERIFICATION_CONFIG);

const handler = async (req: NextRequest): Promise<NextResponse> => {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const validation = bodySchema.safeParse(body);
  if (!validation.success) {
    logger.warn('Payout address cancel validation failed', {
      errors: validation.error.issues.map(i => i.message),
    });
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { requestId } = validation.data;

  // Attempt to verify session (optional, but provides additional security)
  let userId: string | undefined;
  const sessionCheck = await verifySession(req).catch(() => ({ ok: false }));
  if (sessionCheck.ok) {
    userId = (sessionCheck as any).userId;
  }

  logger.info('Payout address cancel request received', {
    operation: 'payout-address-cancel',
    requestId,
    userId: userId || 'unauthenticated',
  });

  // Cancel the request
  const result = verifier.cancelChangeRequest(
    requestId,
    userId || '', // Will fail if not authenticated and user mismatch
    'Cancelled by user'
  );

  if (!result.success) {
    logger.warn('Failed to cancel payout address change', {
      requestId,
      error: result.error,
    });

    // Don't reveal whether the request exists if not authenticated
    return NextResponse.json(
      { error: 'Invalid or expired cancellation link. Please log in to your account.' },
      { status: 400 }
    );
  }

  logger.info('Payout address change cancelled', {
    requestId,
    userId,
  });

  return NextResponse.json(
    {
      success: true,
      message: 'Payout address change has been cancelled. Your current address remains in effect.',
    },
    { status: 200 }
  );
};

export const POST = withTracing(handler);
