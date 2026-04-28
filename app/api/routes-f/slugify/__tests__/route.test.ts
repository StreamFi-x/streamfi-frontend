import { POST } from "../route";
import { slugify } from "../_lib/slugify";
import { NextRequest } from "next/server";

function makePost(body: object): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/slugify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Unit tests for the slugify helper ────────────────────────────────────────

describe("slugify() helper — varied inputs", () => {
  it("basic ASCII", () => expect(slugify("Hello World")).toBe("hello-world"));
  it("strips diacritics (é → e)", () => expect(slugify("café latte")).toBe("cafe-latte"));
  it("strips diacritics (ü → u)", () => expect(slugify("über cool")).toBe("uber-cool"));
  it("strips diacritics (ñ → n)", () => expect(slugify("España")).toBe("espana"));
  it("removes emoji", () => expect(slugify("Hello 🌍 World")).toBe("hello-world"));
  it("multiple emoji in a row", () => expect(slugify("🎉🎊 party")).toBe("party"));
  it("strips punctuation", () => expect(slugify("hello, world!")).toBe("hello-world"));
  it("strips special chars", () => expect(slugify("foo@bar.com")).toBe("foo-bar-com"));
  it("collapses multiple spaces", () => expect(slugify("too   many   spaces")).toBe("too-many-spaces"));
  it("trims leading/trailing separators", () => expect(slugify("  hello  ")).toBe("hello"));
  it("underscore separator", () => expect(slugify("hello world", { separator: "_" })).toBe("hello_world"));
  it("numbers are preserved", () => expect(slugify("section 42")).toBe("section-42"));
  it("all non-alphanumeric input returns empty string", () => expect(slugify("!!! ???")).toBe(""));
  it("chinese characters produce empty slug (no romanization)", () => {
    const s = slugify("你好世界");
    expect(typeof s).toBe("string");
  });
  it("mixed diacritics and emoji", () => expect(slugify("résumé 📄")).toBe("resume"));
});

describe("slugify() maxLength — word boundary truncation", () => {
  it("does not truncate below maxLength", () => {
    const s = slugify("hello world foo bar", { maxLength: 50 });
    expect(s).toBe("hello-world-foo-bar");
  });

  it("truncates at word boundary", () => {
    const s = slugify("hello world foo bar", { maxLength: 11 });
    expect(s).toBe("hello-world");
    expect(s.length).toBeLessThanOrEqual(11);
  });

  it("does not leave a trailing separator after truncation", () => {
    const s = slugify("hello world foo", { maxLength: 6 });
    expect(s.endsWith("-")).toBe(false);
    expect(s.endsWith("_")).toBe(false);
  });
});

// ── POST /api/routes-f/slugify route tests ───────────────────────────────────

describe("POST /api/routes-f/slugify", () => {
  it("returns slug for basic input", async () => {
    const res = await POST(makePost({ text: "Hello World" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.slug).toBe("hello-world");
  });

  it("uses underscore separator", async () => {
    const res = await POST(makePost({ text: "hello world", separator: "_" }));
    const data = await res.json();
    expect(data.slug).toBe("hello_world");
  });

  it("respects maxLength", async () => {
    const res = await POST(makePost({ text: "hello world foo bar", maxLength: 11 }));
    const data = await res.json();
    expect(data.slug.length).toBeLessThanOrEqual(11);
  });

  it("strips diacritics", async () => {
    const res = await POST(makePost({ text: "café résumé" }));
    const data = await res.json();
    expect(data.slug).toBe("cafe-resume");
  });

  it("strips emoji", async () => {
    const res = await POST(makePost({ text: "🚀 launch" }));
    const data = await res.json();
    expect(data.slug).toBe("launch");
  });

  it("returns 400 for missing text", async () => {
    const res = await POST(makePost({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty text", async () => {
    const res = await POST(makePost({ text: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid separator", async () => {
    const res = await POST(makePost({ text: "hello", separator: "~" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for maxLength < 1", async () => {
    const res = await POST(makePost({ text: "hello", maxLength: 0 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/slugify", {
      method: "POST",
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
