import {
  publishRealtimeMessage,
  getRecentMessages,
  resetRealtimeForTests,
} from "@/lib/realtime/pubsub";
import {
  mintRealtimeToken,
  verifyRealtimeToken,
  isChannelAllowedForUser,
} from "@/lib/realtime/tokens";
import {
  hashRecoveryToken,
  generateVerificationCode,
} from "@/lib/auth/wallet-recovery";

describe("Issues #1445, #1446, #1449, #1450 Implementation Tests", () => {
  beforeEach(() => {
    resetRealtimeForTests();
  });

  describe("Issue #1449: Realtime Pub/Sub Backbone & Scoped Tokens", () => {
    it("generates monotonic sequence numbers and timestamps", async () => {
      const msg1 = await publishRealtimeMessage("stream:demo:chat", "chat:message", { text: "hi" });
      const msg2 = await publishRealtimeMessage("stream:demo:chat", "chat:message", { text: "there" });

      expect(msg1.seq).toBe(1);
      expect(msg2.seq).toBe(2);
      expect(msg2.timestamp).toBeGreaterThanOrEqual(msg1.timestamp);
    });

    it("verifies and scopes channel access tokens", () => {
      const token = mintRealtimeToken(["stream:demo:chat", "stream:demo:presence"]);
      const result = verifyRealtimeToken(token, ["stream:demo:chat"]);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.payload.channels).toContain("stream:demo:chat");
      }
    });

    it("rejects unauthorized channel requests", () => {
      const token = mintRealtimeToken(["stream:demo:chat"]);
      const result = verifyRealtimeToken(token, ["stream:other:mod"]);

      expect(result.ok).toBe(false);
    });
  });

  describe("Issue #1446: Wallet Account Recovery Helpers", () => {
    it("generates 6-digit numeric verification codes", () => {
      const code = generateVerificationCode();
      expect(code).toMatch(/^\d{6}$/);
    });

    it("produces deterministic SHA-256 token hashes", () => {
      const token = "sample-recovery-token-12345";
      const hash1 = hashRecoveryToken(token);
      const hash2 = hashRecoveryToken(token);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64);
    });
  });

  describe("Issue #1445: Sandboxed Overlay Security Boundary", () => {
    it("validates channel permissions for overlay streams", () => {
      expect(isChannelAllowedForUser("stream:demo:overlay")).toBe(true);
      expect(isChannelAllowedForUser("creator:private:overlay")).toBe(false);
      expect(isChannelAllowedForUser("creator:private:overlay", { userId: "creator-1" })).toBe(true);
    });
  });
});
