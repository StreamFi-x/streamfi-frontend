import type { LastSession, HighlightTimestamp } from "./types";

const WINDOW = 30; // seconds
const TIP_WEIGHT = 2; // 1 USDC in a window = TIP_WEIGHT score points
const TOP_N = 5;

interface ScoredWindow {
  start: number;
  chat_count: number;
  tip_total: number;
  score: number;
}

export function scoreWindows(session: LastSession): ScoredWindow[] {
  const step = 5;
  const maxStart = Math.max(0, session.duration_seconds - WINDOW);
  const windows: ScoredWindow[] = [];

  for (let start = 0; start <= maxStart; start += step) {
    const end = start + WINDOW;
    const chat_count = session.chat_events.filter(
      (e) => e.offset_seconds >= start && e.offset_seconds < end
    ).length;
    const tip_total = session.tip_events
      .filter((e) => e.offset_seconds >= start && e.offset_seconds < end)
      .reduce((sum, e) => sum + e.amount_usdc, 0);

    if (chat_count > 0 || tip_total > 0) {
      windows.push({ start, chat_count, tip_total, score: chat_count + tip_total * TIP_WEIGHT });
    }
  }

  return windows;
}

function overlaps(a: { start: number }, b: { start: number }): boolean {
  return Math.abs(a.start - b.start) < WINDOW;
}

function reason(w: ScoredWindow): string {
  if (w.tip_total > 0 && w.chat_count > 5) {return "chat and tip spike";}
  if (w.tip_total > 0) {return "tip spike";}
  return "chat burst";
}

export function detectHighlights(session: LastSession): HighlightTimestamp[] {
  const ranked = scoreWindows(session).sort((a, b) => b.score - a.score);
  const selected: ScoredWindow[] = [];

  for (const w of ranked) {
    if (selected.length >= TOP_N) {break;}
    if (selected.every((s) => !overlaps(s, w))) {
      selected.push(w);
    }
  }

  return selected
    .sort((a, b) => a.start - b.start)
    .map((w) => ({
      start_seconds: w.start,
      end_seconds: w.start + WINDOW,
      score: Math.round(w.score * 10) / 10,
      reason: reason(w),
    }));
}
