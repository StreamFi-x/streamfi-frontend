/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, PUT } from "../creator-min-tip/route";
import { POST as CHECK } from "../creator-min-tip/check/route";
import { minTipStore } from "../creator-min-tip/store";

function getReq(creatorId: string) {
  return new NextRequest(
    `http://localhost/api/routes-f/creator-min-tip?creator_id=${creatorId}`
  );
}

function putReq(body: unknown) {
  return new NextRequest(
    "http://localhost/api/routes-f/creator-min-tip",
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

function checkReq(body: unknown) {
  return new NextRequest(
    "http://localhost/api/routes-f/creator-min-tip/check",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

describe("/api/routes-f/creator-min-tip", () => {
  beforeEach(() => {
    minTipStore.clear();
  });

  describe("GET — retrieve minimum tips", () => {
    it("returns defaults (0, 0) for unknown creator", async () => {
      const res = await GET(getReq("creator-new"));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.min_xlm).toBe(0);
      expect(data.min_usdc).toBe(0);
    });

    it("returns configured values after PUT", async () => {
      await PUT(
        putReq({ creator_id: "c1", min_xlm: 5, min_usdc: 2 })
      );

      const res = await GET(getReq("c1"));
      const data = await res.json();
      expect(data.min_xlm).toBe(5);
      expect(data.min_usdc).toBe(2);
    });

    it("rejects missing creator_id", async () => {
      const req = new NextRequest(
        "http://localhost/api/routes-f/creator-min-tip"
      );
      const res = await GET(req);
      expect(res.status).toBe(400);
    });
  });

  describe("PUT — set minimum tips", () => {
    it("sets both min_xlm and min_usdc", async () => {
      const res = await PUT(
        putReq({ creator_id: "c1", min_xlm: 10, min_usdc: 5 })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.min_xlm).toBe(10);
      expect(data.min_usdc).toBe(5);
    });

    it("allows setting only min_xlm", async () => {
      const res = await PUT(putReq({ creator_id: "c1", min_xlm: 3 }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.min_xlm).toBe(3);
      expect(data.min_usdc).toBe(0);
    });

    it("allows setting only min_usdc", async () => {
      const res = await PUT(putReq({ creator_id: "c1", min_usdc: 1 }));
      const data = await res.json();
      expect(data.min_xlm).toBe(0);
      expect(data.min_usdc).toBe(1);
    });

    it("rejects negative min_xlm", async () => {
      const res = await PUT(
        putReq({ creator_id: "c1", min_xlm: -1 })
      );
      expect(res.status).toBe(400);
    });

    it("rejects negative min_usdc", async () => {
      const res = await PUT(
        putReq({ creator_id: "c1", min_usdc: -5 })
      );
      expect(res.status).toBe(400);
    });

    it("rejects missing creator_id", async () => {
      const res = await PUT(putReq({ min_xlm: 5 }));
      expect(res.status).toBe(400);
    });
  });

  describe("POST /check — verify tip allowed", () => {
    it("allows a tip above the minimum", async () => {
      await PUT(putReq({ creator_id: "c1", min_xlm: 5 }));

      const res = await CHECK(
        checkReq({ creator_id: "c1", asset: "XLM", amount: 10 })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.allowed).toBe(true);
      expect(data.reason).toBeUndefined();
    });

    it("rejects a tip below the minimum with reason", async () => {
      await PUT(putReq({ creator_id: "c1", min_xlm: 5 }));

      const res = await CHECK(
        checkReq({ creator_id: "c1", asset: "XLM", amount: 2 })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.allowed).toBe(false);
      expect(data.reason).toMatch(/Minimum XLM/);
    });

    it("allows exact minimum amount", async () => {
      await PUT(putReq({ creator_id: "c1", min_usdc: 10 }));

      const res = await CHECK(
        checkReq({ creator_id: "c1", asset: "USDC", amount: 10 })
      );
      const data = await res.json();
      expect(data.allowed).toBe(true);
    });

    it("rejects USDC tip below minimum", async () => {
      await PUT(putReq({ creator_id: "c1", min_usdc: 10 }));

      const res = await CHECK(
        checkReq({ creator_id: "c1", asset: "USDC", amount: 5 })
      );
      const data = await res.json();
      expect(data.allowed).toBe(false);
      expect(data.reason).toMatch(/Minimum USDC/);
    });

    it("rejects unsupported asset", async () => {
      const res = await CHECK(
        checkReq({ creator_id: "c1", asset: "BTC", amount: 1 })
      );
      const data = await res.json();
      expect(data.allowed).toBe(false);
      expect(data.reason).toMatch(/Unsupported asset/);
    });

    it("allows any amount when no minimum is configured", async () => {
      const res = await CHECK(
        checkReq({ creator_id: "c-new", asset: "XLM", amount: 0.001 })
      );
      const data = await res.json();
      expect(data.allowed).toBe(true);
    });

    it("rejects missing creator_id", async () => {
      const res = await CHECK(
        checkReq({ asset: "XLM", amount: 5 })
      );
      expect(res.status).toBe(400);
    });

    it("rejects missing asset", async () => {
      const res = await CHECK(
        checkReq({ creator_id: "c1", amount: 5 })
      );
      expect(res.status).toBe(400);
    });

    it("rejects missing amount", async () => {
      const res = await CHECK(
        checkReq({ creator_id: "c1", asset: "XLM" })
      );
      expect(res.status).toBe(400);
    });
  });
});
