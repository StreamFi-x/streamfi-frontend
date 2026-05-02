/**
 * Magic 8-Ball API — unit tests
 * Run: npx vitest --run app/api/routes-f/magic-8-ball/__tests__
 */

import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ANSWERS } from "../_lib/answers";
import { pickRandom, validateQuestion, MIN_Q, MAX_Q } from "../_lib/helpers";

// ── Helpers ───────────────────────────────────────────────────────────────────
function makePost(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/magic-8-ball", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Answers ───────────────────────────────────────────────────────────────────
describe("answers", () => {
  it("has exactly 20 answers", () => {
    expect(ANSWERS).toHaveLength(20);
  });

  it("has 10 positive answers", () => {
    expect(ANSWERS.filter((a) => a.category === "positive")).toHaveLength(10);
  });

  it("has 5 neutral answers", () => {
    expect(ANSWERS.filter((a) => a.category === "neutral")).toHaveLength(5);
  });

  it("has 5 negative answers", () => {
    expect(ANSWERS.filter((a) => a.category === "negative")).toHaveLength(5);
  });

  it("all 20 answers are reachable via pickRandom", () => {
    // Run enough iterations to hit all 20 with high probability
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      seen.add(pickRandom().text);
      if (seen.size === ANSWERS.length) break;
    }
    expect(seen.size).toBe(ANSWERS.length);
  });

  it("categories are correctly tagged", () => {
    const positiveTexts = [
      "It is certain", "It is decidedly so", "Without a doubt",
      "Yes definitely", "You may rely on it", "As I see it yes",
      "Most likely", "Outlook good", "Yes", "Signs point to yes",
    ];
    const neutralTexts = [
      "Reply hazy try again", "Ask again later", "Better not tell you now",
      "Cannot predict now", "Concentrate and ask again",
    ];
    const negativeTexts = [
      "Don't count on it", "My reply is no", "My sources say no",
      "Outlook not so good", "Very doubtful",
    ];

    for (const text of positiveTexts) {
      expect(ANSWERS.find((a) => a.text === text)?.category).toBe("positive");
    }
    for (const text of neutralTexts) {
      expect(ANSWERS.find((a) => a.text === text)?.category).toBe("neutral");
    }
    for (const text of negativeTexts) {
      expect(ANSWERS.find((a) => a.text === text)?.category).toBe("negative");
    }
  });
});

// ── Validation ────────────────────────────────────────────────────────────────
describe("validateQuestion", () => {
  it("returns null for a valid question", () => {
    expect(validateQuestion("Will it rain?")).toBeNull();
  });

  it("errors when question is missing", () => {
    expect(validateQuestion(undefined)).not.toBeNull();
    expect(validateQuestion(null)).not.toBeNull();
  });

  it("errors when question is too short", () => {
    expect(validateQuestion("ab")).not.toBeNull();
    expect(validateQuestion("")).not.toBeNull();
  });

  it("errors when question is too long", () => {
    expect(validateQuestion("a".repeat(MAX_Q + 1))).not.toBeNull();
  });

  it("accepts question at exact min length", () => {
    expect(validateQuestion("a".repeat(MIN_Q))).toBeNull();
  });

  it("accepts question at exact max length", () => {
    expect(validateQuestion("a".repeat(MAX_Q))).toBeNull();
  });
});

// ── POST handler ──────────────────────────────────────────────────────────────
describe("POST /api/routes-f/magic-8-ball", () => {
  // Re-import fresh module for each test block to reset counter
  let POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.resetModules();
    ({ POST } = await import("../route"));
  });

  it("returns 400 when question is missing", async () => {
    const res = await POST(makePost({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("returns 400 when question is too short", async () => {
    const res = await POST(makePost({ question: "ab" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when question is too long", async () => {
    const res = await POST(makePost({ question: "a".repeat(501) }));
    expect(res.status).toBe(400);
  });

  it("returns 200 with question, answer, and category for valid input", async () => {
    const res = await POST(makePost({ question: "Will it rain today?" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.question).toBe("Will it rain today?");
    expect(typeof body.answer).toBe("string");
    expect(["positive", "neutral", "negative"]).toContain(body.category);
  });

  it("increments total_asks on each valid request", async () => {
    await POST(makePost({ question: "Question one?" }));
    await POST(makePost({ question: "Question two?" }));
    const { totalAsks } = await import("../route");
    expect(totalAsks).toBe(2);
  });

  it("does not increment total_asks on invalid request", async () => {
    await POST(makePost({ question: "ab" })); // too short
    const { totalAsks } = await import("../route");
    expect(totalAsks).toBe(0);
  });
});

// ── GET /stats ────────────────────────────────────────────────────────────────
describe("GET /api/routes-f/magic-8-ball/stats", () => {
  it("returns total_asks reflecting POST calls", async () => {
    vi.resetModules();
    const { POST: freshPOST } = await import("../route");
    const { GET } = await import("../stats/route");

    await freshPOST(makePost({ question: "Will it work?" }));
    await freshPOST(makePost({ question: "Are you sure?" }));

    const res = await GET();
    const body = await res.json();
    expect(body.total_asks).toBe(2);
  });
});
