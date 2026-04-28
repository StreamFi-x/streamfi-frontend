/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/sentiment", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/routes-f/sentiment", () => {
  it("classifies clearly positive text", async () => {
    const res = await POST(
      makeReq({
        text: "This release is amazing, reliable, helpful and fantastic.",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sentiment).toBe("positive");
    expect(body.score).toBeGreaterThan(0);
    expect(body.positive_words.length).toBeGreaterThan(0);
  });

  it("classifies clearly negative text", async () => {
    const res = await POST(
      makeReq({
        text: "The app is awful, broken, confusing and disappointing.",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sentiment).toBe("negative");
    expect(body.score).toBeLessThan(0);
    expect(body.negative_words.length).toBeGreaterThan(0);
  });

  it("handles neutral text", async () => {
    const res = await POST(
      makeReq({
        text: "The dashboard has charts and a settings menu.",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sentiment).toBe("neutral");
  });

  it("handles negation", async () => {
    const res = await POST(makeReq({ text: "This is not good at all." }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sentiment).toBe("negative");
  });
});
