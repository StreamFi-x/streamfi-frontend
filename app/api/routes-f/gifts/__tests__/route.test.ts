jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));
jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));
jest.mock("../_lib/db", () => ({
  ensureGiftSchema: jest.fn().mockResolvedValue(undefined),
  getGiftCatalogItem: jest.fn((id: string) =>
    id === "crown"
      ? {
          id: "crown",
          name: "Crown",
          price_usd: 25,
          icon_url: "/images/gifts/crown.png",
          animation_url: "/animations/gifts/crown.json",
        }
      : undefined
  ),
}));

import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { POST } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;

function makeRequest(body: object) {
  return new Request("http://localhost/api/routes-f/gifts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

describe("routes-f gifts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "sender-1",
      wallet: null,
      privyId: "did:privy:1",
      username: "alice",
      email: "alice@example.com",
    });
  });

  it("creates a gift transaction", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [{ id: "recipient-1", username: "bob" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "gift-tx-1",
            gift_id: "crown",
            gift_name: "Crown",
            quantity: 2,
            amount_usdc: "50",
            tx_hash: "0xtx",
          },
        ],
      });

    const res = await POST(
      makeRequest({
        recipient_id: "550e8400-e29b-41d4-a716-446655440000",
        gift_id: "crown",
        quantity: 2,
        tx_hash: "0xtx",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.gift_id).toBe("crown");
    expect(json.amount_usdc).toBe("50");
  });

  it("enforces quantity max 100", async () => {
    const res = await POST(
      makeRequest({
        recipient_id: "550e8400-e29b-41d4-a716-446655440000",
        gift_id: "crown",
        quantity: 101,
      })
    );

    expect(res.status).toBe(400);
  });
});
