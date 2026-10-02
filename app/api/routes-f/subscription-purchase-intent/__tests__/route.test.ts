/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import { POST } from "../route";
import { buildPurchaseIntentTx, isValidWallet } from "../utils";
import { getTierPrice, NETWORK_PASSPHRASE, SUBSCRIPTION_CONTRACT_ID } from "../seedData";

const VALID_WALLET = "GBUOU34ED4N33ATTOR32IH34EYBCFR64XOPK4357PLI6GSCTVM7BA3HU";

function makeReq(body: unknown): NextRequest {
  return new NextRequest(
    "http://localhost/api/routes-f/subscription-purchase-intent",
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }
  );
}

describe("POST /api/routes-f/subscription-purchase-intent", () => {
  describe("Validation", () => {
    it("returns 400 for invalid JSON", async () => {
      const req = new NextRequest(
        "http://localhost/api/routes-f/subscription-purchase-intent",
        { method: "POST", body: "not json" }
      );
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 when tierId is missing", async () => {
      const res = await POST(makeReq({ subscriberWallet: VALID_WALLET }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("tierId");
    });

    it("returns 400 when subscriberWallet is missing", async () => {
      const res = await POST(makeReq({ tierId: "tier_alpha_basic" }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("subscriberWallet");
    });

    it("returns 400 for a malformed subscriberWallet", async () => {
      const res = await POST(
        makeReq({ tierId: "tier_alpha_basic", subscriberWallet: "not-a-wallet" })
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("valid Stellar public key");
    });

    it("returns 404 for an unknown tierId", async () => {
      const res = await POST(
        makeReq({ tierId: "tier_does_not_exist", subscriberWallet: VALID_WALLET })
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe("Unknown tier");
    });
  });

  describe("Successful purchase intent", () => {
    it("returns a 201 with an unsigned transaction envelope", async () => {
      const res = await POST(
        makeReq({ tierId: "tier_alpha_basic", subscriberWallet: VALID_WALLET })
      );
      expect(res.status).toBe(201);
      const body = await res.json();

      expect(body.tier_id).toBe("tier_alpha_basic");
      expect(body.source_account).toBe(VALID_WALLET);
      expect(body.contract_id).toBe(SUBSCRIPTION_CONTRACT_ID);
      expect(body.function_name).toBe("purchase_subscription");
      expect(body.network_passphrase).toBe(NETWORK_PASSPHRASE);
      expect(typeof body.transaction_xdr).toBe("string");
      expect(body.transaction_xdr.length).toBeGreaterThan(0);
    });

    it("produces a transaction_xdr that parses back into a valid transaction", async () => {
      const res = await POST(
        makeReq({ tierId: "tier_alpha_premium", subscriberWallet: VALID_WALLET })
      );
      const body = await res.json();

      const tx = TransactionBuilder.fromXDR(
        body.transaction_xdr,
        NETWORK_PASSPHRASE
      );
      expect(tx.source).toBe(VALID_WALLET);
      expect(tx.operations).toHaveLength(1);
      expect(tx.operations[0].type).toBe("invokeHostFunction");
    });
  });

  describe("utils: isValidWallet", () => {
    it("accepts a valid Ed25519 public key", () => {
      expect(isValidWallet(VALID_WALLET)).toBe(true);
    });

    it("rejects a malformed string", () => {
      expect(isValidWallet("not-a-wallet")).toBe(false);
    });

    it("rejects non-string values", () => {
      expect(isValidWallet(123)).toBe(false);
      expect(isValidWallet(undefined)).toBe(false);
    });
  });

  describe("utils: buildPurchaseIntentTx", () => {
    it("targets the subscription contract and function", () => {
      const intent = buildPurchaseIntentTx("tier_beta_basic", VALID_WALLET);
      expect(intent.contract_id).toBe(SUBSCRIPTION_CONTRACT_ID);
      expect(intent.function_name).toBe("purchase_subscription");
      expect(intent.tier_id).toBe("tier_beta_basic");
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
