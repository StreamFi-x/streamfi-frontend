export type TrustTier = 'New Creator' | 'Established Streamer' | 'Community Verified' | 'Under Review';

export interface CreatorTrustProfile {
  creatorId: string;
  accountAgeDays: number;
  totalTipsCompleted: number;
  totalTipsVolumeXlm: number;
  moderationStrikes: number;
  disputedTipsCount: number;
  isKycVerified: boolean;
}

export interface TrustScoreResult {
  score: number; // 0 to 100
  tier: TrustTier;
  warningNotice?: string;
}

/**
 * Computes platform trust score and reputation tier before tipping confirmation.
 */
export function evaluateCreatorTrust(profile: CreatorTrustProfile): TrustScoreResult {
  // Flagged or banned accounts
  if (profile.moderationStrikes >= 3 || profile.disputedTipsCount > 5) {
    return {
      score: 15,
      tier: 'Under Review',
      warningNotice: 'Warning: This account has multiple unresolved moderation or transaction flags.',
    };
  }

  let score = 50; // Base score

  // Account Age (up to +20)
  score += Math.min(20, Math.floor(profile.accountAgeDays / 15));

  // Successful Tip History (up to +15)
  score += Math.min(15, Math.floor(profile.totalTipsCompleted / 5));

  // KYC Verification (+15)
  if (profile.isKycVerified) {
    score += 15;
  }

  // Deductions
  score -= profile.moderationStrikes * 15;
  score -= profile.disputedTipsCount * 10;

  // Clamp 0..100
  score = Math.max(0, Math.min(100, score));

  let tier: TrustTier = 'New Creator';
  let warningNotice: string | undefined;

  if (score >= 80) {
    tier = 'Community Verified';
  } else if (score >= 60) {
    tier = 'Established Streamer';
  } else if (score < 40) {
    tier = 'Under Review';
    warningNotice = 'Caution: This creator has limited history or active reports.';
  } else {
    tier = 'New Creator';
    warningNotice = 'New creator account. Verify channel identity before sending large tips.';
  }

  return {
    score,
    tier,
    warningNotice,
  };
}
