import { canTransitionVerification, isVerifiedStatus, VerificationStatus } from "../state";

const ALL_STATUSES: VerificationStatus[] = [
  "not_verified",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "revoked",
];

describe("canTransitionVerification", () => {
  it("allows the full happy path", () => {
    expect(canTransitionVerification("not_verified", "submitted")).toBe(true);
    expect(canTransitionVerification("submitted", "under_review")).toBe(true);
    expect(canTransitionVerification("under_review", "approved")).toBe(true);
  });

  it("allows rejection from under_review", () => {
    expect(canTransitionVerification("under_review", "rejected")).toBe(true);
  });

  it("allows re-application after rejection or revocation", () => {
    expect(canTransitionVerification("rejected", "submitted")).toBe(true);
    expect(canTransitionVerification("revoked", "submitted")).toBe(true);
  });

  it("allows revocation only from approved", () => {
    expect(canTransitionVerification("approved", "revoked")).toBe(true);
    expect(canTransitionVerification("submitted", "revoked")).toBe(false);
    expect(canTransitionVerification("under_review", "revoked")).toBe(false);
  });

  it("rejects skipping straight from not_verified to approved", () => {
    expect(canTransitionVerification("not_verified", "approved")).toBe(false);
  });

  it("rejects a client claiming approved directly", () => {
    expect(canTransitionVerification("not_verified", "under_review")).toBe(false);
  });

  it("has no transitions defined that aren't explicit allow-list entries", () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        const result = canTransitionVerification(from, to);
        expect(typeof result).toBe("boolean");
      }
    }
  });
});

describe("isVerifiedStatus", () => {
  it("is true only for approved", () => {
    expect(isVerifiedStatus("approved")).toBe(true);
    for (const status of ALL_STATUSES.filter(s => s !== "approved")) {
      expect(isVerifiedStatus(status)).toBe(false);
    }
  });
});
