import { NextResponse } from 'next/server';

export interface TagUsage {
  tag: string;
  timestamp: number;
}

export function getSeedUsages(now: number): TagUsage[] {
  const hour = 60 * 60 * 1000;
  return [
    { tag: 'gaming', timestamp: now - 2 * hour },
    { tag: 'gaming', timestamp: now - 5 * hour },
    { tag: 'gaming', timestamp: now - 25 * hour }, // prior window (assuming 24h)
    { tag: 'crypto', timestamp: now - 1 * hour },
    { tag: 'crypto', timestamp: now - 20 * hour },
    { tag: 'crypto', timestamp: now - 26 * hour },
    { tag: 'crypto', timestamp: now - 27 * hour },
    { tag: 'music', timestamp: now - 48 * hour }, // outside both for 24h
  ];
}

export function calculateTrending(usages: TagUsage[], windowHours: number, limit: number, now: number) {
  const hour = 60 * 60 * 1000;
  const currentWindowStart = now - windowHours * hour;
  const priorWindowStart = currentWindowStart - windowHours * hour;

  const currentCounts: Record<string, number> = {};
  const priorCounts: Record<string, number> = {};

  for (const usage of usages) {
    if (usage.timestamp >= currentWindowStart && usage.timestamp <= now) {
      currentCounts[usage.tag] = (currentCounts[usage.tag] || 0) + 1;
    } else if (usage.timestamp >= priorWindowStart && usage.timestamp < currentWindowStart) {
      priorCounts[usage.tag] = (priorCounts[usage.tag] || 0) + 1;
    }
  }

  const tags = Object.entries(currentCounts).map(([tag, uses]) => {
    const priorUses = priorCounts[tag] || 0;
    let delta_percent = 0;
    if (priorUses === 0) {
      delta_percent = uses > 0 ? 100 : 0;
    } else {
      delta_percent = Math.round(((uses - priorUses) / priorUses) * 100);
    }
    return { tag, uses, delta_percent };
  });

  tags.sort((a, b) => b.uses - a.uses);

  return tags.slice(0, limit);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const windowParam = searchParams.get('window') || '24h';
  const limitParam = searchParams.get('limit') || '20';

  const windowHours = parseInt(windowParam.replace('h', ''), 10);
  const limit = parseInt(limitParam, 10);

  if (isNaN(windowHours) || isNaN(limit)) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  const now = Date.now();
  const trending = calculateTrending(getSeedUsages(now), windowHours, limit, now);

  return NextResponse.json({ tags: trending });
}
