import { NextRequest } from "next/server";
import { POST } from "../route";

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/routes-f/spell-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/routes-f/spell-check", () => {
  it("detects common typos and returns suggestions", async () => {
    const res = await POST(makeReq({ text: "I recieve teh package" }));
    expect(res.status).toBe(200);
    const body = await res.json();

    const words = body.misspelled.map((entry: { word: string }) => entry.word);
    expect(words).toContain("recieve");
    expect(words).toContain("teh");
  });

  it("does not flag dictionary words as misspelled", async () => {
    const res = await POST(makeReq({ text: "ability able about above" }));
    const body = await res.json();
    expect(body.misspelled).toEqual([]);
  });

  it("ranks suggestions by edit distance", async () => {
    const res = await POST(makeReq({ text: "abotu", max_suggestions: 3 }));
    const body = await res.json();
    const aboutEntry = body.misspelled.find(
      (entry: { word: string }) => entry.word === "abotu"
    );
    expect(aboutEntry).toBeTruthy();
    expect(aboutEntry.suggestions.length).toBeGreaterThan(0);
  });

  it("caps input size at 100KB", async () => {
    const oversized = "a".repeat(102401);
    const res = await POST(makeReq({ text: oversized }));
    expect(res.status).toBe(413);
  });
});
