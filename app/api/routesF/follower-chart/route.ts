import { NextResponse } from 'next/server';
import { seedEvents } from './data';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const creator_id = searchParams.get('creator_id');
  const daysParam = searchParams.get('days');
  const days = daysParam ? parseInt(daysParam, 10) : 30;

  if (!creator_id) {
    return NextResponse.json({ error: 'Missing creator_id' }, { status: 400 });
  }

  const seriesMap = new Map<string, { date: string; gained: number; lost: number; net: number }>();
  
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  // Zero-fill the days
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    seriesMap.set(dateStr, { date: dateStr, gained: 0, lost: 0, net: 0 });
  }

  // Aggregate events
  for (const event of seedEvents) {
    if (event.creator_id !== creator_id) {continue;}
    
    const d = new Date(event.timestamp);
    const dateStr = d.toISOString().split('T')[0];
    
    if (seriesMap.has(dateStr)) {
      const entry = seriesMap.get(dateStr)!;
      if (event.type === 'follow') {
        entry.gained += 1;
        entry.net += 1;
      } else {
        entry.lost += 1;
        entry.net -= 1;
      }
    }
  }

  return NextResponse.json({ series: Array.from(seriesMap.values()) });
}
