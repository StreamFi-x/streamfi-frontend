/**
 * POST /api/routes-f/payout-address-change
 * 
 * Initiate a payout address change request
 * Requires authentication; starts time-locked verification process
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifySession } from '@/lib/auth/verify-session';
import { logger } from '@/lib/tracing/logger';
import { withTracing } from '@/lib/tracing/api-route-wrapper';
import { PayoutAddressVerifier, DEFAULT_VERIFICATION_CONFIG } from '@/lib/payouts/payout-address-verifier';

const bodySchema = z.object({
  newPayoutAddress: z.string().regex(/^G[A-Z0-9]{55}$/, 'Invalid Stellar address'),
});

// Global instance (in production, use database-backed verifier)
const verifier = new PayoutAddressVerifier(DEFAULT_VERIFICATION_CONFIG);

const handler = async (req: NextRequest): Promise<NextResponse> => {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  // Verify session
  const session = await verifySession(req);
  if (!session.ok) {
    logger.warn('Payout address change: session verification failed');
    return session.response;
  }

  logger.info('Payout address change request received', {
    operation: 'payout-address-change',
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
    logger.warn('Payout address validation failed', {
      userId: session.userId,
      errors: validation.error.issues.map(i => i.message),
    });
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { newPayoutAddress } = validation.data;

  // TODO: Get current payout address from database
  const currentPayoutAddress = 'G'; // Placeholder

  const result = await verifier.initiateAddressChange(
    session.userId,
    currentPayoutAddress,
    newPayoutAddress
  );

  if (!result.success) {
    logger.warn('Failed to initiate payout address change', {
      userId: session.userId,
      error: result.error,
    });
    return NextResponse.json(
      { error: result.error },
      { status: 400 }
    );
  }

  logger.info('Payout address change request created', {
    userId: session.userId,
    requestId: result.requestId,
    cooldownDays: DEFAULT_VERIFICATION_CONFIG.cooldownDays,
  });

  return NextResponse.json(
    {
      success: true,
      requestId: result.requestId,
      cooldownDays: DEFAULT_VERIFICATION_CONFIG.cooldownDays,
      verificationDeadline: new Date(
        Date.now() + DEFAULT_VERIFICATION_CONFIG.cooldownDays * 24 * 60 * 60 * 1000
      ).toISOString(),
      message: `Your payout address change will take effect in ${DEFAULT_VERIFICATION_CONFIG.cooldownDays} days. Check your email for details and cancel link.`,
    },
    { status: 202 }
  );
};

export const POST = withTracing(handler);
