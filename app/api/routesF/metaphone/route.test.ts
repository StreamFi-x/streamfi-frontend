import { NextRequest } from "next/server";
import { metaphone } from "./metaphone";
import { POST } from "./route";

// #886 feat(routesF): metaphone phonetic encoder

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/metaphone", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("metaphone", () => {
  it.each([
    ["Smith", "SM0"],
    ["Smithee", "SM0"],
    ["Smyth", "SM0"],
    ["Robert", "RBRT"],
    ["Rupert", "RPRT"],
    ["Washington", "WXNK"],
    ["Who", "W"],
    ["Answer", "ANSW"],
    ["Cough", "K"],
    ["Day", "T"],
  ])("encodes %s as %s", (word, expected) => {
    expect(metaphone(word)).toBe(expected);
  });

  it("ignores non-alphabetic characters", () => {
    expect(metaphone("Smith-Jones")).toBe(metaphone("SmithJones"));
  });
});

describe("POST /api/routesF/metaphone", () => {
  it("returns a single code for word", async () => {
    const res = await POST(makeReq({ word: "Robert" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ code: "RBRT" });
  });

  it("returns codes for words array", async () => {
    const res = await POST(makeReq({ words: ["Robert", "Rupert", "Smith"] }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ codes: ["RBRT", "RPRT", "SM0"] });
  });

  it("rejects invalid bodies", async () => {
    const missing = await POST(makeReq({}));
    const both = await POST(makeReq({ word: "a", words: ["b"] }));
    const badWords = await POST(makeReq({ words: ["ok", 1] }));

    expect(missing.status).toBe(400);
    expect(both.status).toBe(400);
    expect(badWords.status).toBe(400);
  });
});
