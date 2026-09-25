/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server';

export interface Report {
  report_id: string;
  creator_id: string;
  reporter_id: string;
  reason: string;
  description?: string;
  timestamp: number;
}

// In-memory store for practice
export const reportsStore: Report[] = [];

export function generateReportId() {
  return Math.random().toString(36).substring(2, 9);
}

export function isRateLimited(
  reports: Report[],
  creator_id: string,
  reporter_id: string,
  now: number
): boolean {
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  const recentReports = reports.filter(
    (r) =>
      r.creator_id === creator_id &&
      r.reporter_id === reporter_id &&
      now - r.timestamp < oneWeekMs
  );
  return recentReports.length >= 3;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { creator_id, reporter_id, reason, description } = body;

    if (!creator_id || !reporter_id || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const now = Date.now();
    if (isRateLimited(reportsStore, creator_id, reporter_id, now)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const report_id = generateReportId();
    reportsStore.push({
      report_id,
      creator_id,
      reporter_id,
      reason,
      description,
      timestamp: now,
    });

    return NextResponse.json({ report_id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const creator_id = searchParams.get('creator_id');

  if (!creator_id) {
    return NextResponse.json({ error: 'creator_id is required' }, { status: 400 });
  }

  const creatorReports = reportsStore.filter((r) => r.creator_id === creator_id);
  
  const reasonsCount: Record<string, number> = {};
  for (const r of creatorReports) {
    reasonsCount[r.reason] = (reasonsCount[r.reason] || 0) + 1;
  }

  const topReasons = Object.entries(reasonsCount)
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => ({ reason, count }));

  return NextResponse.json({
    report_count: creatorReports.length,
    top_reasons: topReasons,
  });
}
