// NextResponse.json relies on the Streams API (Response.body) which the
// whatwg-fetch polyfill in jest.setup.ts does not implement. Replace
// NextResponse with a lightweight stand-in so route handler tests work.
jest.mock("next/server", () => {
  class MockNextResponse {
    status: number;
    private _data: unknown;
    constructor(data: unknown, init?: { status?: number }) {
      this._data = data;
      this.status = init?.status ?? 200;
    }
    async json() {
      return this._data;
    }
    static json(data: unknown, init?: { status?: number }) {
      return new MockNextResponse(data, init);
    }
  }
  return { NextResponse: MockNextResponse };
});

import type { NextRequest } from "next/server";
import { countSyllables, analyzeText } from "../_lib/helpers";
import { POST } from "../route";

// Build a minimal NextRequest stand-in that only implements what the handler uses.
// Constructing a real NextRequest in jsdom conflicts with the whatwg-fetch polyfill.
function makeRequest(body: unknown): NextRequest {
  return {
    json: jest.fn().mockResolvedValue(body),
  } as unknown as NextRequest;
}

function makeInvalidJsonRequest(): NextRequest {
  return {
    json: jest.fn().mockRejectedValue(new SyntaxError("Unexpected token")),
  } as unknown as NextRequest;
}

// ---------------------------------------------------------------------------
// countSyllables
// ---------------------------------------------------------------------------

describe("countSyllables", () => {
  it.each([
    // monosyllabic
    ["cat", 1],
    ["on", 1],
    ["the", 1], // trailing-e, but count is 1 so no subtraction
    ["fox", 1],
    ["brown", 1],
    ["jumps", 1],
    // silent-e drops a count
    ["make", 1],
    ["time", 1],
    ["score", 1],
    // two syllables
    ["over", 2], // o-ver
    ["running", 2], // run-ning
    ["lazy", 2], // la-zy
    ["seven", 2], // sev-en
    ["ago", 2], // a-go
    ["nation", 2], // na-tion (i+o are adjacent, one group)
    // three syllables
    ["beautiful", 3], // beau-ti-ful
    ["liberty", 3], // lib-er-ty
    ["dedicated", 4], // ded-i-ca-ted (ends in 'd', no silent-e)
    // five syllables
    ["university", 5], // u-ni-ver-si-ty
  ] as [string, number][])(
    "countSyllables(%s) → %d",
    (word, expected) => {
      expect(countSyllables(word)).toBe(expected);
    }
  );

  it("returns 0 for empty string", () => {
    expect(countSyllables("")).toBe(0);
  });

  it("returns 0 for punctuation-only token", () => {
    // All non-alpha → cleaned = "" → 0
    expect(countSyllables("...")).toBe(0);
  });

  it("strips punctuation before counting", () => {
    // "cat." → cleaned "cat" → 1
    expect(countSyllables("cat.")).toBe(1);
    // "over," → cleaned "over" → 2
    expect(countSyllables("over,")).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// analyzeText
// ---------------------------------------------------------------------------

describe("analyzeText", () => {
  // ── empty / blank ────────────────────────────────────────────────────────

  it("returns all-zeros for empty string", () => {
    expect(analyzeText("")).toEqual({
      chars: 0,
      chars_no_spaces: 0,
      words: 0,
      sentences: 0,
      paragraphs: 0,
      avg_words_per_sentence: 0,
      flesch_reading_ease: 0,
      syllable_count: 0,
      reading_time_seconds: 0,
    });
  });

  it("returns all-zeros for whitespace-only input", () => {
    const result = analyzeText("   \n\n   ");
    expect(result.words).toBe(0);
    expect(result.sentences).toBe(0);
    expect(result.paragraphs).toBe(0);
    expect(result.flesch_reading_ease).toBe(0);
  });

  // ── single word ──────────────────────────────────────────────────────────

  it("handles a single word with trailing period", () => {
    // "Hello." — 6 chars, no spaces, 1 word, 1 sentence, 1 paragraph
    // syllables: h-e-l-l-o → e(1), o(2) → count=2, ends 'o', no silent-e → 2
    // avg_words_per_sentence: 1/1 = 1
    // flesch: 206.835 - 1.015*(1/1) - 84.6*(2/1) = 206.835 - 1.015 - 169.2 = 36.62
    // reading_time: (1/200)*60 = 0.3
    const r = analyzeText("Hello.");
    expect(r.chars).toBe(6);
    expect(r.chars_no_spaces).toBe(6);
    expect(r.words).toBe(1);
    expect(r.sentences).toBe(1);
    expect(r.paragraphs).toBe(1);
    expect(r.syllable_count).toBe(2);
    expect(r.avg_words_per_sentence).toBe(1);
    expect(r.flesch_reading_ease).toBeCloseTo(36.62, 1);
    expect(r.reading_time_seconds).toBe(0.3);
  });

  // ── simple sentence (known-values Flesch check) ───────────────────────────

  it("computes all fields correctly for a simple monosyllabic sentence", () => {
    // "The cat sat on the mat."
    // chars: 23, chars_no_spaces: 18 (5 spaces, 1 period)
    // words: 6 (The cat sat on the mat.)
    // sentences: 1, paragraphs: 1
    // syllables: all 1-syllable → 6
    // avg_words_per_sentence: 6
    // flesch: 206.835 − 1.015×6 − 84.6×(6/6) = 206.835 − 6.09 − 84.6 = 116.145 → 116.15
    // reading_time: (6/200)*60 = 1.8
    const r = analyzeText("The cat sat on the mat.");
    expect(r.chars).toBe(23);
    expect(r.chars_no_spaces).toBe(18);
    expect(r.words).toBe(6);
    expect(r.sentences).toBe(1);
    expect(r.paragraphs).toBe(1);
    expect(r.syllable_count).toBe(6);
    expect(r.avg_words_per_sentence).toBe(6);
    expect(r.reading_time_seconds).toBe(1.8);
    // Flesch ±2 of reference (116.15)
    expect(r.flesch_reading_ease).toBeCloseTo(116.15, 0);
  });

  it("Flesch score for a pangram is within ±2 of reference", () => {
    // "The quick brown fox jumps over the lazy dog."
    // words=9, sentences=1
    // syllables: The(1)+quick(1)+brown(1)+fox(1)+jumps(1)+over(2)+the(1)+lazy(2)+dog(1) = 11
    // flesch: 206.835 − 1.015×9 − 84.6×(11/9) = 197.7 − 103.4 = 94.3
    const r = analyzeText("The quick brown fox jumps over the lazy dog.");
    expect(r.words).toBe(9);
    expect(r.syllable_count).toBe(11);
    expect(r.flesch_reading_ease).toBeCloseTo(94.3, 0);
  });

  // ── multiple sentences ────────────────────────────────────────────────────

  it("counts multiple sentences separated by different punctuation", () => {
    const r = analyzeText("Hello! How are you? Fine.");
    expect(r.sentences).toBe(3);
    expect(r.words).toBe(5);
    expect(r.avg_words_per_sentence).toBeCloseTo(5 / 3, 1);
  });

  it("treats ellipsis as one sentence boundary", () => {
    const r = analyzeText("Hmm... okay.");
    expect(r.sentences).toBe(2); // "..." and "." are two groups
    expect(r.words).toBe(2);
  });

  it("treats text with no punctuation as one sentence", () => {
    const r = analyzeText("This has no period at all");
    expect(r.sentences).toBe(1);
    expect(r.words).toBe(6); // This/has/no/period/at/all
  });

  // ── multiple paragraphs ───────────────────────────────────────────────────

  it("detects two paragraphs separated by a blank line", () => {
    const r = analyzeText("First paragraph.\n\nSecond paragraph.");
    expect(r.paragraphs).toBe(2);
    expect(r.words).toBe(4);
    expect(r.sentences).toBe(2);
  });

  it("treats a single newline as within the same paragraph", () => {
    const r = analyzeText("Line one.\nLine two.");
    expect(r.paragraphs).toBe(1);
  });

  it("handles three or more blank lines between paragraphs", () => {
    const r = analyzeText("Para one.\n\n\n\nPara two.");
    expect(r.paragraphs).toBe(2);
  });

  // ── char counts ───────────────────────────────────────────────────────────

  it("counts chars and chars_no_spaces correctly", () => {
    // "a b c" → 5 chars total, 3 non-space
    const r = analyzeText("a b c");
    expect(r.chars).toBe(5);
    expect(r.chars_no_spaces).toBe(3);
  });

  it("treats newlines as whitespace in chars_no_spaces", () => {
    const r = analyzeText("a\nb");
    expect(r.chars).toBe(3);
    expect(r.chars_no_spaces).toBe(2);
  });

  // ── reading time ──────────────────────────────────────────────────────────

  it("reading_time_seconds is correct at 200 WPM", () => {
    // 200 words → (200/200)*60 = 60 s
    const text = Array(200).fill("word").join(" ");
    const r = analyzeText(text);
    expect(r.words).toBe(200);
    expect(r.reading_time_seconds).toBe(60);
  });

  it("reading_time_seconds rounds to 2 decimal places", () => {
    // 1 word → (1/200)*60 = 0.3 s
    const r = analyzeText("word");
    expect(r.reading_time_seconds).toBe(0.3);
  });

  // ── long input ────────────────────────────────────────────────────────────

  it("handles a long multi-paragraph passage without error", () => {
    const para = "The swift river flows through the ancient valley. ";
    const text = [para.repeat(10), para.repeat(10), para.repeat(10)].join(
      "\n\n"
    );
    const r = analyzeText(text);
    expect(r.words).toBeGreaterThan(0);
    expect(r.paragraphs).toBe(3);
    expect(r.sentences).toBeGreaterThan(0);
    expect(r.flesch_reading_ease).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Route handler — POST /api/routes-f/text-stats
// ---------------------------------------------------------------------------

describe("POST /api/routes-f/text-stats", () => {
  // ── happy path ────────────────────────────────────────────────────────────

  it("returns 200 with all required fields for valid text", async () => {
    const res = await POST(makeRequest({ text: "Hello world." }));
    expect(res.status).toBe(200);

    const data = await res.json();
    const requiredFields = [
      "chars",
      "chars_no_spaces",
      "words",
      "sentences",
      "paragraphs",
      "avg_words_per_sentence",
      "flesch_reading_ease",
      "syllable_count",
      "reading_time_seconds",
    ] as const;
    for (const field of requiredFields) {
      expect(data).toHaveProperty(field);
      expect(typeof data[field]).toBe("number");
    }
  });

  it("returns correct counts for a short sentence", async () => {
    const res = await POST(makeRequest({ text: "The cat sat." }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.words).toBe(3);
    expect(data.sentences).toBe(1);
    expect(data.paragraphs).toBe(1);
  });

  it("returns all-zeros for empty string", async () => {
    const res = await POST(makeRequest({ text: "" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.words).toBe(0);
    expect(data.sentences).toBe(0);
    expect(data.flesch_reading_ease).toBe(0);
    expect(data.syllable_count).toBe(0);
  });

  // ── validation errors ─────────────────────────────────────────────────────

  it("returns 400 when text field is missing", async () => {
    const res = await POST(makeRequest({ foo: "bar" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toHaveProperty("error");
  });

  it("returns 400 when text is a number", async () => {
    const res = await POST(makeRequest({ text: 42 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when text is null", async () => {
    const res = await POST(makeRequest({ text: null }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when text is an array", async () => {
    const res = await POST(makeRequest({ text: ["a", "b"] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is not an object", async () => {
    const res = await POST(makeRequest("just a string"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    const res = await POST(makeInvalidJsonRequest());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toHaveProperty("error");
  });

  // ── size cap ──────────────────────────────────────────────────────────────

  it("returns 413 when text exceeds 500 KB", async () => {
    // 501 * 1024 ASCII bytes > 500 KB
    const bigText = "a".repeat(501 * 1024);
    const res = await POST(makeRequest({ text: bigText }));
    expect(res.status).toBe(413);
    const data = await res.json();
    expect(data.error).toMatch(/500 KB/);
  });

  it("accepts text exactly at the 500 KB boundary", async () => {
    // 500 * 1024 ASCII bytes == exactly 500 KB
    const boundaryText = "a".repeat(500 * 1024);
    const res = await POST(makeRequest({ text: boundaryText }));
    expect(res.status).toBe(200);
  });
});
