import { NextRequest } from "next/server";
import { POST } from "../route";

function makeReq(text: string) {
  return new NextRequest("http://localhost/api/routes-f/vowel-syllable", {
    method: "POST",
    body: JSON.stringify({ text }),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/routes-f/vowel-syllable", () => {
  it("counts vowels, consonants, words", async () => {
    const res = await POST(makeReq("Hello world"));
    const body = await res.json();
    expect(body.vowels).toBe(3);
    expect(body.consonants).toBe(7);
    expect(body.words).toBe(2);
  });

  it("estimates syllables with silent e handling", async () => {
    const res = await POST(makeReq("make table"));
    const body = await res.json();
    expect(body.syllables).toBe(3);
  });
});
