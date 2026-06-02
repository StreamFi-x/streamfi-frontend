import { NextRequest } from "next/server";
import { soundex } from "../soundex";
import { POST } from "../route";

// #860 feat(routes-f): soundex phonetic encoder

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/soundex", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("soundex", () => {
  it.each([
    ["Robert", "R163"],
    ["Rupert", "R163"],
    ["Washington", "W252"],
    ["Lee", "L000"],
    ["Ashcraft", "A261"],
    ["Ashcroft", "A261"],
  ])("encodes %s as %s", (word, expected) => {
    expect(soundex(word)).toBe(expected);
  });

  it("ignores non-alphabetic characters", () => {
    expect(soundex("O'Brien")).toBe(soundex("OBrien"));
  });
});

describe("POST /api/routes-f/soundex", () => {
  it("returns a single code for word", async () => {
    const res = await POST(makeReq({ word: "Robert" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ code: "R163" });
  });

  it("returns codes for words array", async () => {
    const res = await POST(makeReq({ words: ["Robert", "Rupert", "Lee"] }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ codes: ["R163", "R163", "L000"] });
  });

  it("rejects invalid bodies", async () => {
    const missing = await POST(makeReq({}));
    const both = await POST(makeReq({ word: "a", words: ["b"] }));
    const badWord = await POST(makeReq({ word: 123 }));

    expect(missing.status).toBe(400);
    expect(both.status).toBe(400);
    expect(badWord.status).toBe(400);
  });
});
