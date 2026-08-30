/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server';
import {
  calculatePriorityScore,
  getReasonSeverity,
  getReporterTrustScore,
  scoreToPriority,
} from './helpers';
import { ReportTriageRequest, ReportTriageResponse } from './types';

export async function POST(request: Request): Promise<NextResponse<ReportTriageResponse | { error: string }>> {
  try {
    const body: ReportTriageRequest = await request.json();
    const { report } = body;

    if (!report || !report.reporterId || !report.reason) {
      return NextResponse.json(
        { error: 'Missing required fields: report.reporterId and report.reason' },
        { status: 400 }
      );
    }

    // Get reporter's trust score
    const { trustScore } = getReporterTrustScore(report.reporterId);

    // Get severity for the reason
    const reasonSeverity = getReasonSeverity(report.reason);

    // Calculate priority score (0-100)
    const score = calculatePriorityScore(trustScore, reasonSeverity);

    // Map score to priority level
    const priority = scoreToPriority(score);

    const response: ReportTriageResponse = {
      priority,
      score,
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid JSON body or processing error' },
      { status: 400 }
    );
  }
}
