export type ScreeningDecision = 'allowed' | 'flagged_for_review' | 'blocked_severe';

export interface MetadataScreeningResult {
  decision: ScreeningDecision;
  reasons: string[];
  matchedPatterns: string[];
  normalizedTitle: string;
  normalizedDescription: string;
}

const SEVERE_SLURS_REGEX = /\b(slur_pattern_example|scam_seed_phrase_steal|fake_admin_auth)\b/i;
const SCAM_PATTERNS = [
  { regex: /double\s+your\s+(xlm|crypto|usdc)/i, label: 'crypto-doubling-scheme' },
  { regex: /send\s+\d+\s+get\s+\d+\s+free/i, label: 'airdrop-scam-format' },
  { regex: /(claim-gift|telegram-me|whatsapp-me-at|free-xlm-airdrop)\.xyz/i, label: 'malicious-phishing-url' },
  { regex: /giveaway\s+connect\s+wallet/i, label: 'unverified-wallet-drainer' },
];

/**
 * Normalizes Unicode characters, homoglyphs, and zero-width spaces.
 */
export function normalizeText(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // strip zero-width chars
    .replace(/[\$]/g, 's')
    .replace(/[@]/g, 'a')
    .replace(/[0]/g, 'o')
    .replace(/[1!]/g, 'i')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Screens stream titles and descriptions before public indexing.
 */
export function screenStreamMetadata(
  title: string,
  description: string
): MetadataScreeningResult {
  const normalizedTitle = normalizeText(title);
  const normalizedDesc = normalizeText(description);
  const combined = `${normalizedTitle} ${normalizedDesc}`;

  const reasons: string[] = [];
  const matchedPatterns: string[] = [];

  // 1. Severe Blockers (Deterministic)
  if (SEVERE_SLURS_REGEX.test(combined)) {
    return {
      decision: 'blocked_severe',
      reasons: ['Content violates community safety standards (hate speech/credentials).'],
      matchedPatterns: ['severe_slur_or_credential_theft'],
      normalizedTitle,
      normalizedDescription: normalizedDesc,
    };
  }

  // 2. Scam / Phishing Heuristics
  for (const pattern of SCAM_PATTERNS) {
    if (pattern.regex.test(combined)) {
      reasons.push(`Suspicious scam pattern detected: ${pattern.label}`);
      matchedPatterns.push(pattern.label);
    }
  }

  // 3. Excessive Urgency / Capitalization
  const uppercaseCount = (title.match(/[A-Z]/g) || []).length;
  if (title.length > 15 && uppercaseCount / title.length > 0.7) {
    reasons.push('Excessive capitalization and promotional urgency.');
    matchedPatterns.push('excessive_caps');
  }

  if (matchedPatterns.length > 0) {
    return {
      decision: 'flagged_for_review',
      reasons,
      matchedPatterns,
      normalizedTitle,
      normalizedDescription: normalizedDesc,
    };
  }

  return {
    decision: 'allowed',
    reasons: [],
    matchedPatterns: [],
    normalizedTitle,
    normalizedDescription: normalizedDesc,
  };
}
