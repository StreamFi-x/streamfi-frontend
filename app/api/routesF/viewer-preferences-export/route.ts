import { NextRequest, NextResponse } from 'next/server';

export interface ViewerPreferences {
  viewer_id: string;
  theme: 'dark' | 'light' | 'system';
  notifications: {
    stream_live: boolean;
    new_follower: boolean;
    tips_received: boolean;
    email_digest: 'daily' | 'weekly' | 'off';
  };
  follows: { creator_id: string; followed_at: string; notifications_enabled: boolean }[];
  language: string;
  tip_currency: 'XLM' | 'USDC';
}

// Seed viewer preferences, bundled inside this folder per the routesF scope constraint
export const SEED_PREFERENCES: Record<string, ViewerPreferences> = {
  'viewer-1': {
    viewer_id: 'viewer-1',
    theme: 'dark',
    notifications: {
      stream_live: true,
      new_follower: true,
      tips_received: true,
      email_digest: 'weekly',
    },
    follows: [
      { creator_id: 'creator-1', followed_at: '2025-11-02T10:15:00Z', notifications_enabled: true },
      { creator_id: 'creator-3', followed_at: '2026-01-18T20:40:00Z', notifications_enabled: false },
    ],
    language: 'en',
    tip_currency: 'XLM',
  },
  'viewer-2': {
    viewer_id: 'viewer-2',
    theme: 'system',
    notifications: {
      stream_live: false,
      new_follower: false,
      tips_received: true,
      email_digest: 'off',
    },
    follows: [],
    language: 'es',
    tip_currency: 'USDC',
  },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const viewerId = searchParams.get('viewer_id');

  if (!viewerId) {
    return NextResponse.json({ error: 'viewer_id is required' }, { status: 400 });
  }

  const preferences = SEED_PREFERENCES[viewerId];
  if (!preferences) {
    return NextResponse.json({ error: 'Viewer not found' }, { status: 404 });
  }

  return NextResponse.json({
    ...preferences,
    export_generated_at: new Date().toISOString(),
  });
}
