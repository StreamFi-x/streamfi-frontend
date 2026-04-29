/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/accept-language", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/routes-f/accept-language", () => {
  it("sorts weighted preferences by q value", async () => {
    const res = await POST(
      makeReq({
        header: "en-US,en;q=0.8,fr;q=0.9",
        supported: ["en", "fr"],
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.parsed).toEqual([
      { locale: "en-US", q: 1 },
      { locale: "fr", q: 0.9 },
      { locale: "en", q: 0.8 },
    ]);
    expect(body.best_match).toBe("en");
  });

  it("matches by language prefix when exact tag is unavailable", async () => {
    const res = await POST(
      makeReq({
        header: "pt-BR;q=0.9,es;q=0.8",
        supported: ["pt", "es-MX"],
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.best_match).toBe("pt");
  });

  it("returns null when no supported locale matches", async () => {
    const res = await POST(
      makeReq({
        header: "de-AT,de;q=0.7",
        supported: ["en", "fr"],
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.best_match).toBeNull();
  });

  it("skips malformed header entries and returns what parsed", async () => {
    const res = await POST(
      makeReq({
        header: "bad@tag, en;q=0.5, fr;q=2",
        supported: ["en"],
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.parsed).toEqual([{ locale: "en", q: 0.5 }]);
    expect(body.best_match).toBe("en");
  });
});
