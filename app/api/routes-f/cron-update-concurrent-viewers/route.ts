import { NextRequest, NextResponse } from 'next/server';
import { updateConcurrentViewerCache } from '@/lib/analytics/concurrent-viewers';
import { logger } from '@/lib/tracing/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/routes-f/cron-update-concurrent-viewers (#1382)
 *
 * Vercel Cron endpoint. Refreshes the platform-wide concurrent viewer count cache.
 * This job runs on a schedule (typically every 10-30 seconds) to keep the cached
 * value fresh without requiring expensive aggregation queries on every homepage load.
 *
 * Authorized via CRON_SECRET header (set by Vercel, not user-provided).
 */

function isAuthorizedCronRequest(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return false;
  }

  const authHeader = req.headers.get('authorization');
  return authHeader === `Bearer ${cronSecret}`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedCronRequest(req)) {
    logger.warn('[cron-update-concurrent-viewers] Unauthorized request', {
      operation: 'cron-update-concurrent-viewers.POST',
      authHeader: req.headers.get('authorization'),
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await updateConcurrentViewerCache();

    logger.info('[cron-update-concurrent-viewers] Cache update completed', {
      operation: 'cron-update-concurrent-viewers.POST',
    });

    return NextResponse.json(
      {
        status: 'success',
        message: 'Concurrent viewer cache refreshed',
        refreshed_at: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('[cron-update-concurrent-viewers] Update failed', {
      operation: 'cron-update-concurrent-viewers.POST',
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to update concurrent viewer cache',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
