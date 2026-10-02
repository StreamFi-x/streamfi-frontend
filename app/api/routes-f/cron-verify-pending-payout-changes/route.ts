/**
 * GET /api/routes-f/cron-verify-pending-payout-changes
 * 
 * Cron job to verify pending payout address changes
 * Marks requests as 'verified' once cooldown has elapsed
 * Called daily or as configured by scheduler
 */
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/tracing/logger';
import { withTracing } from '@/lib/tracing/api-route-wrapper';
import { PayoutAddressVerifier, DEFAULT_VERIFICATION_CONFIG } from '@/lib/payouts/payout-address-verifier';

// Global instance
const verifier = new PayoutAddressVerifier(DEFAULT_VERIFICATION_CONFIG);

const handler = async (req: NextRequest): Promise<NextResponse> => {
  // Security: verify cron secret if configured
  const cronSecret = req.headers.get('x-cron-secret');
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    logger.warn('Cron request rejected: invalid secret', {
      operation: 'cron-verify-pending-payout-changes',
    });
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  logger.info('Payout address change verification cron started', {
    operation: 'cron-verify-pending-payout-changes',
  });

  try {
    // Get all pending requests past their cooldown deadline
    const pendingRequests = verifier.getPendingRequests();

    logger.info('Processing pending payout changes', {
      operation: 'cron-verify-pending-payout-changes',
      requestCount: pendingRequests.length,
    });

    let verified = 0;
    for (const request of pendingRequests) {
      const result = verifier.verifyChangeRequest(request.requestId);

      if (result.success) {
        verified++;
        logger.info('Payout change verified by cron', {
          operation: 'cron-verify-pending-payout-changes',
          requestId: request.requestId,
          userId: request.userId,
          newAddress: request.proposedAddress.substring(0, 8),
        });
      } else {
        logger.warn('Failed to verify payout change', {
          operation: 'cron-verify-pending-payout-changes',
          requestId: request.requestId,
          error: result.error,
        });
      }
    }

    logger.info('Payout address change verification cron completed', {
      operation: 'cron-verify-pending-payout-changes',
      totalProcessed: pendingRequests.length,
      verified,
    });

    return NextResponse.json(
      {
        success: true,
        processed: pendingRequests.length,
        verified,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Cron job failed', {
      operation: 'cron-verify-pending-payout-changes',
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: 'Cron job failed',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
};

export const GET = withTracing(handler);
