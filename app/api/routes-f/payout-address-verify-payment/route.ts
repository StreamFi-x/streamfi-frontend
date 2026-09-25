/**
 * POST /api/routes-f/payout-address-verify-payment
 * 
 * Confirm test payment received at new payout address
 * Verifies wallet ownership by confirming test tx hash
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifySession } from '@/lib/auth/verify-session';
import { logger } from '@/lib/tracing/logger';
import { withTracing } from '@/lib/tracing/api-route-wrapper';
import { PayoutAddressVerifier, DEFAULT_VERIFICATION_CONFIG } from '@/lib/payouts/payout-address-verifier';

const bodySchema = z.object({
  requestId: z.string(),
  testPaymentTxHash: z.string().min(56).max(56), // Stellar tx hash is 64 chars base64, ~56 after encoding
});

// Global instance
const verifier = new PayoutAddressVerifier(DEFAULT_VERIFICATION_CONFIG);

const handler = async (req: NextRequest): Promise<NextResponse> => {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  // Verify session
  const session = await verifySession(req);
  if (!session.ok) {
    logger.warn('Test payment verification: session verification failed');
    return session.response;
  }

  logger.info('Test payment verification request received', {
    operation: 'payout-address-verify-payment',
    userId: session.userId,
  });

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
    logger.warn('Test payment verification validation failed', {
      userId: session.userId,
      errors: validation.error.issues.map(i => i.message),
    });
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { requestId, testPaymentTxHash } = validation.data;

  // Confirm test payment
  const result = verifier.confirmTestPayment(
    requestId,
    session.userId,
    testPaymentTxHash
  );

  if (!result.success) {
    logger.warn('Failed to confirm test payment', {
      userId: session.userId,
      requestId,
      error: result.error,
    });
    return NextResponse.json(
      { error: result.error },
      { status: 400 }
    );
  }

  logger.info('Test payment confirmed', {
    userId: session.userId,
    requestId,
    txHash: testPaymentTxHash.substring(0, 16),
  });

  return NextResponse.json(
    {
      success: true,
      message: 'Test payment confirmed. Your wallet ownership has been verified.',
    },
    { status: 200 }
  );
};

export const POST = withTracing(handler);
