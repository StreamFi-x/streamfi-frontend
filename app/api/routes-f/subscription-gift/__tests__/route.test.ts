/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import { POST } from "../route";
import { buildGiftIntentTx, isValidWallet } from "../utils";
import {
  getTierPrice,
  NETWORK_PASSPHRASE,
  SUBSCRIPTION_CONTRACT_ID,
} from "../seedData";

const GIFTER_WALLET =
  "GBUOU34ED4N33ATTOR32IH34EYBCFR64XOPK4357PLI6GSCTVM7BA3HU";
const RECIPIENT = "user_bob";

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/subscription-gift", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/routes-f/subscription-gift", () => {
  describe("Validation", () => {
    it("returns 400 for invalid JSON", async () => {
      const req = new NextRequest(
        "http://localhost/api/routes-f/subscription-gift",
        { method: "POST", body: "not json" }
      );
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 when tierId is missing", async () => {
      const res = await POST(
        makeReq({ recipientUserId: RECIPIENT, gifterWallet: GIFTER_WALLET })
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("tierId");
    });

    it("returns 400 when recipientUserId is missing", async () => {
      const res = await POST(
        makeReq({ tierId: "tier_alpha_basic", gifterWallet: GIFTER_WALLET })
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("recipientUserId");
    });

    it("returns 400 when gifterWallet is missing", async () => {
      const res = await POST(
        makeReq({ tierId: "tier_alpha_basic", recipientUserId: RECIPIENT })
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("gifterWallet");
    });

    it("returns 400 for a malformed gifterWallet", async () => {
      const res = await POST(
        makeReq({
          tierId: "tier_alpha_basic",
          recipientUserId: RECIPIENT,
          gifterWallet: "not-a-wallet",
        })
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("valid Stellar public key");
    });

    it("returns 404 for an unknown tierId", async () => {
      const res = await POST(
        makeReq({
          tierId: "tier_does_not_exist",
          recipientUserId: RECIPIENT,
          gifterWallet: GIFTER_WALLET,
        })
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe("Unknown tier");
    });
  });

  describe("Successful gift intent", () => {
    it("returns a 201 with an unsigned transaction envelope", async () => {
      const res = await POST(
        makeReq({
          tierId: "tier_alpha_basic",
          recipientUserId: RECIPIENT,
          gifterWallet: GIFTER_WALLET,
        })
      );
      expect(res.status).toBe(201);
      const body = await res.json();

      expect(body.tier_id).toBe("tier_alpha_basic");
      expect(body.recipient_user_id).toBe(RECIPIENT);
      expect(body.gifted_by).toBe(GIFTER_WALLET);
      expect(body.source_account).toBe(GIFTER_WALLET);
      expect(body.contract_id).toBe(SUBSCRIPTION_CONTRACT_ID);
      expect(body.function_name).toBe("gift_subscription");
      expect(body.network_passphrase).toBe(NETWORK_PASSPHRASE);
      expect(typeof body.transaction_xdr).toBe("string");
      expect(body.transaction_xdr.length).toBeGreaterThan(0);
    });

    it("produces a transaction_xdr that parses back into a valid transaction", async () => {
      const res = await POST(
        makeReq({
          tierId: "tier_alpha_premium",
          recipientUserId: RECIPIENT,
          gifterWallet: GIFTER_WALLET,
        })
      );
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

  describe("utils: isValidWallet", () => {
    it("accepts a valid Ed25519 public key", () => {
      expect(isValidWallet(GIFTER_WALLET)).toBe(true);
    });

    it("rejects a malformed string", () => {
      expect(isValidWallet("not-a-wallet")).toBe(false);
    });

    it("rejects non-string values", () => {
      expect(isValidWallet(123)).toBe(false);
      expect(isValidWallet(undefined)).toBe(false);
    });
  });

  describe("utils: buildGiftIntentTx", () => {
    it("targets the subscription contract and gift_subscription function", () => {
      const intent = buildGiftIntentTx(
        "tier_beta_basic",
        RECIPIENT,
        GIFTER_WALLET
      );
      expect(intent.contract_id).toBe(SUBSCRIPTION_CONTRACT_ID);
      expect(intent.function_name).toBe("gift_subscription");
      expect(intent.tier_id).toBe("tier_beta_basic");
      expect(intent.recipient_user_id).toBe(RECIPIENT);
    });
  });

  describe("seedData: getTierPrice", () => {
    it("returns undefined for an unknown tier", () => {
      expect(getTierPrice("nope")).toBeUndefined();
    });

    it("returns pricing for a known tier", () => {
      expect(getTierPrice("tier_alpha_basic")).toEqual({
        tier_id: "tier_alpha_basic",
        name: "Basic",
        price_usdc: 5,
      });
    });
  });
});
