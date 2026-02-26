jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

import { POST as profilePost } from "../profile/route";
import { POST as accessPost } from "../access/route";
import { GET as sessionGet } from "../session/route";

const makeRequest = (url: string, method: string, body?: object, auth?: string) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { authorization: auth } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

const expectErrorShape = (body: Record<string, unknown>) => {
  expect(body).toHaveProperty("code");
  expect(body).toHaveProperty("message");
  expect(body).toHaveProperty("details");
};

describe("routes-f error normalization", () => {
  it("maps BAD_REQUEST to 400 with normalized shape", async () => {
    const response = await profilePost(makeRequest("/api/routes-f/profile", "POST", {}));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("BAD_REQUEST");
    expectErrorShape(body);
  });

  it("maps UNAUTHORIZED to 401", async () => {
    const response = await sessionGet(makeRequest("/api/routes-f/session", "GET"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
    expectErrorShape(body);
  });

  it("maps FORBIDDEN to 403", async () => {
    const response = await sessionGet(
      makeRequest("/api/routes-f/session", "GET", undefined, "Bearer wrong-token")
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("FORBIDDEN");
    expectErrorShape(body);
  });

  it("maps NOT_FOUND to 404", async () => {
    const response = await profilePost(
      makeRequest("/api/routes-f/profile", "POST", { wallet: "missing-wallet" })
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
    expectErrorShape(body);
  });

  it("maps UNPROCESSABLE_ENTITY to 422", async () => {
    const response = await accessPost(
      makeRequest("/api/routes-f/access", "POST", { role: "viewer" })
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.code).toBe("UNPROCESSABLE_ENTITY");
    expectErrorShape(body);
  });

  it("maps unknown errors to 500", async () => {
    const response = await profilePost(
      makeRequest("/api/routes-f/profile", "POST", { wallet: "explode-wallet" })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(body.message).toBe("Internal server error");
    expectErrorShape(body);
  });
});
