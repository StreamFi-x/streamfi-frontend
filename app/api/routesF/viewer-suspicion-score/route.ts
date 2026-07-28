import { NextResponse } from 'next/server';
import { viewerSignals, ViewerSignals } from './seed-data';

interface ScoreFactor {
  factor: string;
  points: number;
}

function computeSuspicionScore(signals: ViewerSignals): { score: number; factors: string[] } {
  const hits: ScoreFactor[] = [];

  if (signals.account_age_days < 3) {
    hits.push({ factor: 'new_account', points: 30 });
  } else if (signals.account_age_days < 7) {
    hits.push({ factor: 'recent_account', points: 15 });
  }

  if (signals.reports_count > 0) {
    hits.push({ factor: 'reported_by_viewers', points: Math.min(signals.reports_count * 8, 40) });
  }

  if (signals.caps_ratio > 0.7) {
    hits.push({ factor: 'excessive_caps', points: 10 });
  }

  if (signals.link_spam_count > 0) {
    hits.push({ factor: 'link_spam', points: 15 });
  }

  if (signals.duplicate_message_ratio > 0.5) {
    hits.push({ factor: 'repetitive_messages', points: 10 });
  }

  if (signals.chat_messages_count === 0 && signals.account_age_days <= 1) {
    hits.push({ factor: 'silent_new_viewer', points: 10 });
  }

  if (signals.prior_ban) {
    hits.push({ factor: 'prior_ban_history', points: 25 });
  }

  const total = hits.reduce((sum, h) => sum + h.points, 0);
  const score = Math.max(0, Math.min(100, total));

  return { score, factors: hits.map((h) => h.factor) };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body.viewer_id !== 'string' || body.viewer_id.trim().length === 0) {
      return NextResponse.json({ error: 'Missing or invalid viewer_id' }, { status: 400 });
    }

    const signals = viewerSignals[body.viewer_id];

    if (!signals) {
      return NextResponse.json({ error: 'Viewer not found' }, { status: 404 });
    }

    const { score, factors } = computeSuspicionScore(signals);

    return NextResponse.json({ score, factors });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
