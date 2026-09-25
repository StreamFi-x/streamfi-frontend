/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import { POST } from "../route";
import {
  buildCommunityGiftTx,
  isPositiveInteger,
  isValidWallet,
} from "../utils";
import {
  MAX_GIFT_COUNT,
  NETWORK_PASSPHRASE,
  SUBSCRIPTION_CONTRACT_ID,
  getEligibleChatters,
} from "../seedData";

const GIFTER_WALLET =
  "GBUOU34ED4N33ATTOR32IH34EYBCFR64XOPK4357PLI6GSCTVM7BA3HU";

function makeReq(body: unknown): NextRequest {
  return new NextRequest(
    "http://localhost/api/routes-f/subscription-community-gifting",
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }
  );
}

const validBody = {
  tierId: "tier_alpha_basic",
  count: 3,
  creatorId: "creator_alpha",
  gifterWallet: GIFTER_WALLET,
};

describe("POST /api/routes-f/subscription-community-gifting", () => {
  describe("Validation", () => {
    it("returns 400 for invalid JSON", async () => {
      const req = new NextRequest(
        "http://localhost/api/routes-f/subscription-community-gifting",
        { method: "POST", body: "not json" }
      );
      expect((await POST(req)).status).toBe(400);
    });

    it("returns 400 when tierId is missing", async () => {
      const res = await POST(
        makeReq({
          count: 3,
          creatorId: "creator_alpha",
          gifterWallet: GIFTER_WALLET,
        })
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain("tierId");
    });

    it("returns 400 when creatorId is missing", async () => {
      const res = await POST(
        makeReq({
          tierId: "tier_alpha_basic",
          count: 3,
          gifterWallet: GIFTER_WALLET,
        })
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain("creatorId");
    });

    it.each([0, -2, 1.5, "3", null])(
      "returns 400 when count is not a positive integer: %p",
      async count => {
        const res = await POST(makeReq({ ...validBody, count }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toContain("positive integer");
      }
    );

    it("returns 400 when count exceeds the maximum", async () => {
      const res = await POST(
        makeReq({ ...validBody, count: MAX_GIFT_COUNT + 1 })
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain(String(MAX_GIFT_COUNT));
    });

    it("returns 400 for a malformed gifterWallet", async () => {
      const res = await POST(
        makeReq({ ...validBody, gifterWallet: "not-a-wallet" })
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain("valid Stellar public key");
    });

    it("returns 404 for an unknown tierId", async () => {
      const res = await POST(makeReq({ ...validBody, tierId: "tier_nope" }));
      expect(res.status).toBe(404);
      expect((await res.json()).error).toBe("Unknown tier");
    });

    it("returns 404 for an unknown creator", async () => {
      const res = await POST(
        makeReq({ ...validBody, creatorId: "creator_unknown" })
      );
      expect(res.status).toBe(404);
      expect((await res.json()).error).toContain("not found");
    });
  });

  describe("Recipient selection", () => {
    it("gifts the next N eligible chatters in order and skips existing subscribers", async () => {
      const res = await POST(makeReq({ ...validBody, count: 3 }));
      expect(res.status).toBe(201);
      const body = await res.json();

      // viewer_pixel already has an active sub and is skipped.
      expect(body.recipients).toEqual([
        "viewer_nova",
        "viewer_quill",
        "viewer_rune",
      ]);
      expect(body.recipient_count).toBe(3);
      expect(body.requested_count).toBe(3);
      expect(body.tier_id).toBe("tier_alpha_basic");
      expect(body.creator_id).toBe("creator_alpha");
      expect(body.function_name).toBe("community_gift_subscriptions");
      expect(body.source_account).toBe(GIFTER_WALLET);
    });

    it("returns 409 when count is more than the eligible chatters available", async () => {
      const eligible = getEligibleChatters("creator_alpha")!;
      const res = await POST(
        makeReq({ ...validBody, count: eligible.length + 1 })
      );
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe("Not enough eligible chatters");
      expect(body.available_count).toBe(eligible.length);
      expect(body.requested_count).toBe(eligible.length + 1);
    });

    it("returns 409 for a known creator whose chat is empty", async () => {
      const res = await POST(
        makeReq({ ...validBody, creatorId: "creator_gamma", count: 1 })
      );
      expect(res.status).toBe(409);
      expect((await res.json()).available_count).toBe(0);
    });

    it("can gift every eligible chatter at once", async () => {
      const eligible = getEligibleChatters("creator_alpha")!;
      const res = await POST(makeReq({ ...validBody, count: eligible.length }));
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.recipients).toEqual(eligible);
    });
  });

  describe("Unsigned transaction", () => {
    it("produces a transaction_xdr that parses back into a single invokeHostFunction op", async () => {
      const res = await POST(makeReq(validBody));
      const body = await res.json();

      const tx = TransactionBuilder.fromXDR(
        body.transaction_xdr,
        NETWORK_PASSPHRASE
      );
      expect(tx.source).toBe(GIFTER_WALLET);
      expect(tx.operations).toHaveLength(1);
      expect(tx.operations[0].type).toBe("invokeHostFunction");
    });
  });

  describe("utils", () => {
    it("isPositiveInteger only accepts positive integers", () => {
      expect(isPositiveInteger(1)).toBe(true);
      expect(isPositiveInteger(0)).toBe(false);
      expect(isPositiveInteger(-1)).toBe(false);
      expect(isPositiveInteger(2.5)).toBe(false);
      expect(isPositiveInteger("2")).toBe(false);
    });

    it("isValidWallet validates Stellar public keys", () => {
      expect(isValidWallet(GIFTER_WALLET)).toBe(true);
      expect(isValidWallet("nope")).toBe(false);
    });

    it("buildCommunityGiftTx echoes the recipients and requested count", () => {
      const intent = buildCommunityGiftTx(
        "tier_beta_basic",
        "creator_beta",
        ["viewer_wren", "viewer_yarn"],
        2,
        GIFTER_WALLET
      );
      expect(intent.contract_id).toBe(SUBSCRIPTION_CONTRACT_ID);
      expect(intent.function_name).toBe("community_gift_subscriptions");
      expect(intent.recipients).toEqual(["viewer_wren", "viewer_yarn"]);
      expect(intent.recipient_count).toBe(2);
      expect(intent.requested_count).toBe(2);
    });
  });

  describe("seedData: getEligibleChatters", () => {
    it("excludes existing subscribers", () => {
      expect(getEligibleChatters("creator_alpha")).not.toContain(
        "viewer_pixel"
      );
    });

    it("returns undefined for an unknown creator", () => {
      expect(getEligibleChatters("creator_unknown")).toBeUndefined();
    });

    it("returns an empty array for a creator with no chatters", () => {
      expect(getEligibleChatters("creator_gamma")).toEqual([]);
    });
  });
});
