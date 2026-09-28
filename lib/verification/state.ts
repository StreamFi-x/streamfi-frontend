/**
 * Creator verification state machine (#1425). Enforced here and re-checked at
 * every route that mutates status — never trust a client-supplied status or
 * transition.
 */
export type VerificationStatus =
  | "not_verified"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "revoked";

export type EvidenceType = "document" | "social_proof";

const ALLOWED_TRANSITIONS: Record<VerificationStatus, VerificationStatus[]> = {
  not_verified: ["submitted"],
  submitted: ["under_review"],
  under_review: ["approved", "rejected"],
  approved: ["revoked"],
  rejected: ["submitted"], // re-application
  revoked: ["submitted"], // re-application after revocation
};

export function canTransitionVerification(
  from: VerificationStatus,
  to: VerificationStatus
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isVerifiedStatus(status: VerificationStatus): boolean {
  return status === "approved";
}
