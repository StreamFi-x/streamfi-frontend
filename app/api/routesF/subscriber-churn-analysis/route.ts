/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server';
import { getSubscriberMetrics } from './seed-data';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get('creator_id');
    const windowDaysParam = searchParams.get('window_days');

    if (!creatorId || typeof creatorId !== 'string' || creatorId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid creator_id parameter' },
        { status: 400 }
      );
    }

    let windowDays = 30;
    if (windowDaysParam) {
      const parsed = parseInt(windowDaysParam, 10);
      if (isNaN(parsed) || parsed <= 0) {
        return NextResponse.json(
          { error: 'Invalid window_days parameter' },
          { status: 400 }
        );
      }
      windowDays = parsed;
    }

    const metrics = getSubscriberMetrics(creatorId, windowDays);

    return NextResponse.json({
      churn_rate_percent: metrics.churn_rate_percent,
      cancellation_reasons: metrics.cancellation_reasons,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
