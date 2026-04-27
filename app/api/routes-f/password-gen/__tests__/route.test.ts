import { POST } from "../route";
import { NextRequest } from "next/server";

const BASE = "http://localhost/api/routes-f/password-gen";

function req(body: object) {
  return new NextRequest(BASE, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /password-gen", () => {
  it("returns default password (length 16, all classes)", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(200);
    const { passwords, strength_score } = await res.json();
    expect(passwords).toHaveLength(1);
    expect(passwords[0]).toHaveLength(16);
    expect(strength_score).toBe(4);
  });

  it("returns multiple passwords", async () => {
    const res = await POST(req({ count: 5 }));
    const { passwords } = await res.json();
    expect(passwords).toHaveLength(5);
  });

  it("satisfies uppercase-only rule", async () => {
    const res = await POST(req({ uppercase: true, lowercase: false, digits: false, symbols: false, length: 20 }));
    const { passwords } = await res.json();
    expect(/^[A-Z]+$/.test(passwords[0])).toBe(true);
  });

  it("satisfies lowercase-only rule", async () => {
    const res = await POST(req({ uppercase: false, lowercase: true, digits: false, symbols: false, length: 20 }));
    const { passwords } = await res.json();
    expect(/^[a-z]+$/.test(passwords[0])).toBe(true);
  });

  it("satisfies digits-only rule", async () => {
    const res = await POST(req({ uppercase: false, lowercase: false, digits: true, symbols: false, length: 20 }));
    const { passwords } = await res.json();
    expect(/^[0-9]+$/.test(passwords[0])).toBe(true);
  });

  it("excludes ambiguous characters when exclude_ambiguous=true", async () => {
    const ambiguous = /[0O1lI]/;
    for (let i = 0; i < 20; i++) {
      const res = await POST(req({ exclude_ambiguous: true, length: 32 }));
      const { passwords } = await res.json();
      expect(ambiguous.test(passwords[0])).toBe(false);
    }
  });

  it("includes must_include substrings", async () => {
    const res = await POST(req({ must_include: ["abc", "XY"], length: 20 }));
    const { passwords } = await res.json();
    const pw = passwords[0];
    expect(pw).toContain("abc");
    expect(pw).toContain("XY");
  });

  it("strength_score is 0 for single char class", async () => {
    const res = await POST(req({ uppercase: true, lowercase: false, digits: false, symbols: false }));
    const { strength_score } = await res.json();
    expect(strength_score).toBe(0);
  });

  it("strength_score is 1 for two char classes", async () => {
    const res = await POST(req({ uppercase: true, lowercase: true, digits: false, symbols: false }));
    const { strength_score } = await res.json();
    expect(strength_score).toBe(1);
  });

  it("strength_score is 4 for all classes with length >= 12", async () => {
    const res = await POST(req({ length: 16 }));
    const { strength_score } = await res.json();
    expect(strength_score).toBe(4);
  });

  it("returns 400 for length < 4", async () => {
    const res = await POST(req({ length: 3 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for length > 256", async () => {
    const res = await POST(req({ length: 257 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for count < 1", async () => {
    const res = await POST(req({ count: 0 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for count > 100", async () => {
    const res = await POST(req({ count: 101 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when all char classes disabled", async () => {
    const res = await POST(req({ uppercase: false, lowercase: false, digits: false, symbols: false }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when must_include exceeds length", async () => {
    const res = await POST(req({ length: 5, must_include: ["toolong123"] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    const r = new NextRequest(BASE, { method: "POST", body: "not-json" });
    const res = await POST(r);
    expect(res.status).toBe(400);
  });
});
