jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

import { POST as registerPost } from "../register/route";
import { POST as feedbackPost } from "../feedback/route";
import { PATCH as accountPatch } from "../account/route";

const makeRequest = (url: string, method: string, body: object) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("routes-f schema validation", () => {
  it("rejects unknown fields for register route", async () => {
    const request = makeRequest("/api/routes-f/register", "POST", {
      wallet: "wallet_1",
      email: "user@example.com",
      extra: "not-allowed",
    });

    const response = await registerPost(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid request payload");
    expect(body.details).toContain("Unknown field: extra");
  });

  it("rejects unknown fields for feedback route", async () => {
    const request = makeRequest("/api/routes-f/feedback", "POST", {
      wallet: "wallet_1",
      message: "great stream",
      rating: 5,
      channelId: "abc",
    });

    const response = await feedbackPost(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.details).toContain("Unknown field: channelId");
  });

  it("rejects unknown fields for account route", async () => {
    const request = makeRequest("/api/routes-f/account", "PATCH", {
      wallet: "wallet_1",
      displayName: "alice",
      locale: "en-US",
    });

    const response = await accountPatch(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.details).toContain("Unknown field: locale");
  });
});
