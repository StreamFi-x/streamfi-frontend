import { StoredFeedback } from './types';

// Rate Limiter
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimits = new Map<string, RateLimitEntry>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(ip);

  if (!entry) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (now > entry.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count += 1;
  return true;
}

// Strip HTML tags
export function stripHtmlTags(input: string): string {
  if (!input) return '';
  return input.replace(/<\/?[^>]+(>|$)/g, "");
}

// In-memory storage
export const feedbackStorage: StoredFeedback[] = [];

export function storeFeedback(feedback: StoredFeedback) {
  feedbackStorage.push(feedback);
}

// Clear state (useful for tests)
export function resetState() {
  rateLimits.clear();
  feedbackStorage.length = 0;
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
