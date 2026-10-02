jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

import { POST } from "../route";

function makeRequest(body: object) {
  return new Request("http://localhost/api/routes-f/age-units", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

describe("routes-f age-units", () => {
  it("computes exact birthday values", async () => {
    const res = await POST(
      makeRequest({
        birthdate: "2000-05-28T00:00:00.000Z",
        on_date: "2026-05-28T00:00:00.000Z",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.years).toBe(26);
    expect(json.total_months).toBe(312);
  });

  it("handles leap-year births before the leap-day anniversary is reached", async () => {
    const res = await POST(
      makeRequest({
        birthdate: "2000-02-29T00:00:00.000Z",
        on_date: "2021-02-28T00:00:00.000Z",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.years).toBe(20);
    expect(json.total_months).toBe(251);
  });

  it("rejects future birthdates", async () => {
    const res = await POST(
      makeRequest({
        birthdate: "2030-01-01T00:00:00.000Z",
        on_date: "2026-01-01T00:00:00.000Z",
      })
    );

    expect(res.status).toBe(400);
  });
});
