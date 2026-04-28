export interface AnalyticsEvent {
  id: string;
  name: string;
  timestamp: string;
  properties: Record<string, unknown>;
  received_at: string;
}

const MAX_BUFFER = 10_000;
const buffer: AnalyticsEvent[] = [];
let counter = 0;

function nextId(): string {
  return `evt_${Date.now()}_${(++counter).toString(36)}`;
}

export function ingest(events: AnalyticsEvent[]): void {
  for (const ev of events) {
    if (buffer.length >= MAX_BUFFER) {
      buffer.shift(); // evict oldest
    }
    buffer.push(ev);
  }
}

export function buildEvent(raw: { name: string; timestamp: string; properties?: Record<string, unknown> }): AnalyticsEvent {
  return {
    id: nextId(),
    name: raw.name,
    timestamp: raw.timestamp,
    properties: raw.properties ?? {},
    received_at: new Date().toISOString(),
  };
}

export function getPage(page: number, limit: number): { events: AnalyticsEvent[]; total: number; page: number; limit: number; pages: number } {
  const total = buffer.length;
  const pages = Math.ceil(total / limit) || 1;
  const safePage = Math.max(1, Math.min(page, pages));
  const start = (safePage - 1) * limit;
  return {
    events: buffer.slice(start, start + limit),
    total,
    page: safePage,
    limit,
    pages,
  };
}

export function bufferSize(): number {
  return buffer.length;
}

export function clearBuffer(): void {
  buffer.length = 0;
}
