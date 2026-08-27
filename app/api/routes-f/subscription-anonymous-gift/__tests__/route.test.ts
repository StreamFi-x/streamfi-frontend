/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import { POST } from "../route";
import {
  buildAnonymousGiftIntentTx,
  isValidWallet,
  PUBLIC_GIFTED_BY,
} from "../utils";
import {
  getTierPrice,
  NETWORK_PASSPHRASE,
  SUBSCRIPTION_CONTRACT_ID,
} from "../seedData";

const GIFTER_WALLET =
  "GBUOU34ED4N33ATTOR32IH34EYBCFR64XOPK4357PLI6GSCTVM7BA3HU";
const RECIPIENT = "user_bob";

function makeReq(body: unknown): NextRequest {
  return new NextRequest(
    "http://localhost/api/routes-f/subscription-anonymous-gift",
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }
  );
}

describe("POST /api/routes-f/subscription-anonymous-gift", () => {
  describe("Validation", () => {
    it("returns 400 for invalid JSON", async () => {
      const req = new NextRequest(
        "http://localhost/api/routes-f/subscription-anonymous-gift",
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
      expect((await res.json()).error).toContain("tierId");
    });

    it("returns 400 when recipientUserId is missing", async () => {
      const res = await POST(
        makeReq({ tierId: "tier_alpha_basic", gifterWallet: GIFTER_WALLET })
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain("recipientUserId");
    });

    it("returns 400 when gifterWallet is missing", async () => {
      const res = await POST(
        makeReq({ tierId: "tier_alpha_basic", recipientUserId: RECIPIENT })
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain("gifterWallet");
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
      expect((await res.json()).error).toContain("valid Stellar public key");
    });

    it("returns 404 for an unknown tierId", async () => {
      const res = await POST(
        makeReq({
          tierId: "tier_nope",
          recipientUserId: RECIPIENT,
          gifterWallet: GIFTER_WALLET,
        })
      );
      expect(res.status).toBe(404);
      expect((await res.json()).error).toBe("Unknown tier");
    });
  });

  describe("Successful anonymous gift intent", () => {
    it("returns a 201 attributing the gift to Anonymous while keeping the real wallet for signing", async () => {
      const res = await POST(
        makeReq({
          tierId: "tier_alpha_basic",
          recipientUserId: RECIPIENT,
          gifterWallet: GIFTER_WALLET,
        })
      );
      expect(res.status).toBe(201);
      const body = await res.json();

      expect(body.function_name).toBe("gift_subscription_anonymous");
      expect(body.gifted_by).toBe("Anonymous");
      expect(body.public_view).toEqual({ gifted_by: "Anonymous" });
      // The signer still needs the real wallet.
      expect(body.gifter_wallet).toBe(GIFTER_WALLET);
      expect(body.source_account).toBe(GIFTER_WALLET);
      expect(body.contract_id).toBe(SUBSCRIPTION_CONTRACT_ID);
      expect(body.network_passphrase).toBe(NETWORK_PASSPHRASE);
      expect(body.tier_id).toBe("tier_alpha_basic");
      expect(body.recipient_user_id).toBe(RECIPIENT);
      expect(typeof body.transaction_xdr).toBe("string");
    });

    it("never leaks the gifter wallet into the public_view", async () => {
      const res = await POST(
        makeReq({
          tierId: "tier_beta_basic",
          recipientUserId: RECIPIENT,
          gifterWallet: GIFTER_WALLET,
        })
      );
      const body = await res.json();
      expect(JSON.stringify(body.public_view)).not.toContain(GIFTER_WALLET);
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

  describe("utils", () => {
    it("PUBLIC_GIFTED_BY is the string Anonymous", () => {
      expect(PUBLIC_GIFTED_BY).toBe("Anonymous");
    });

    it("isValidWallet accepts a valid key and rejects junk", () => {
      expect(isValidWallet(GIFTER_WALLET)).toBe(true);
      expect(isValidWallet("nope")).toBe(false);
      expect(isValidWallet(undefined)).toBe(false);
    });

    it("buildAnonymousGiftIntentTx targets gift_subscription_anonymous", () => {
      const intent = buildAnonymousGiftIntentTx(
        "tier_beta_basic",
        RECIPIENT,
        GIFTER_WALLET
      );
      expect(intent.function_name).toBe("gift_subscription_anonymous");
      expect(intent.gifted_by).toBe("Anonymous");
      expect(intent.gifter_wallet).toBe(GIFTER_WALLET);
    });

    it("getTierPrice resolves known tiers only", () => {
      expect(getTierPrice("tier_alpha_basic")?.price_usdc).toBe(5);
      expect(getTierPrice("nope")).toBeUndefined();
    });
  });
});
