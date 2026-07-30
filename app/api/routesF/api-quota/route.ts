import { NextRequest, NextResponse } from 'next/server';
import { getUsageByApiKey, buildQuotaResponse } from './quotaData';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('api_key');

  if (!apiKey) {
    return NextResponse.json({ error: 'api_key is required' }, { status: 400 });
  }

  const usage = getUsageByApiKey(apiKey);

  if (!usage) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 404 });
  }

  const response = buildQuotaResponse(usage);

  return NextResponse.json(response);
}