/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server';
import { getWarningConfig, setWarningConfig } from './helpers';
import {
  ContentWarningGetResponse,
  ContentWarningSetResponse,
  WarningSeverity,
  COMMON_WARNING_IDS,
} from './types';

const VALID_SEVERITIES = new Set<WarningSeverity>(['mild', 'moderate', 'severe']);

export async function GET(request: Request): Promise<
  NextResponse<ContentWarningGetResponse | { error: string }>
> {
  try {
    const url = new URL(request.url);
    const creator_id = url.searchParams.get('creator_id');

    if (!creator_id) {
      return NextResponse.json(
        { error: 'Missing required query parameter: creator_id' },
        { status: 400 }
      );
    }

    const config = getWarningConfig(creator_id);

    if (!config) {
      // Return default empty config
      const response: ContentWarningGetResponse = {
        warnings: [],
        severity: 'mild',
      };
      return NextResponse.json(response);
    }

    const response: ContentWarningGetResponse = {
      warnings: config.warnings,
      severity: config.severity,
    };
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: 'Processing error' }, { status: 400 });
  }
}

export async function PUT(request: Request): Promise<
  NextResponse<ContentWarningSetResponse | { error: string }>
> {
  try {
    const body = await request.json();
    const { creator_id, warnings, severity } = body;

    if (!creator_id || !Array.isArray(warnings) || !severity) {
      return NextResponse.json(
        { error: 'Missing required fields: creator_id, warnings (array), severity' },
        { status: 400 }
      );
    }

    if (!VALID_SEVERITIES.has(severity)) {
      return NextResponse.json(
        { error: 'Invalid severity. Must be: mild, moderate, or severe' },
        { status: 400 }
      );
    }

    // Validate that all warnings are valid
    const invalidWarnings = warnings.filter((w) => !COMMON_WARNING_IDS.includes(w));
    if (invalidWarnings.length > 0) {
      return NextResponse.json(
        { error: `Invalid warning types: ${invalidWarnings.join(', ')}` },
        { status: 400 }
      );
    }

    const result = setWarningConfig(creator_id, warnings, severity);

    const response: ContentWarningSetResponse = {
      success: result.success,
      warnings: result.config.warnings,
      severity: result.config.severity,
      updated_at: result.config.updated_at,
    };
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON body or processing error' }, { status: 400 });
  }
}
