// In-memory storage for one-time 2FA recovery codes, bundled inside this
// folder per the routesF scope constraint. user_id -> set of unused codes.

export const RECOVERY_CODES: Record<string, Set<string>> = {};

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I lookalikes

function randomSegment(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export function generateCodes(userId: string, count: number): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    codes.add(`${randomSegment(4)}-${randomSegment(4)}`);
  }
  // Regenerating replaces any previous batch: old codes are invalidated
  RECOVERY_CODES[userId] = new Set(codes);
  return [...codes];
}

export function useCode(userId: string, code: string): { valid: boolean; codes_remaining: number } {
  const codes = RECOVERY_CODES[userId];
  if (!codes || !codes.has(code)) {
    return { valid: false, codes_remaining: codes ? codes.size : 0 };
  }
  codes.delete(code);
  return { valid: true, codes_remaining: codes.size };
}
