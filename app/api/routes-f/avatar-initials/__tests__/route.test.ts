import { GET } from "../route";
import { extractInitials, clampSize, buildAvatar } from "../_lib/avatar";
import { NextRequest } from "next/server";

function makeGet(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/routes-f/avatar-initials${query}`);
}

// ── Helper unit tests ─────────────────────────────────────────────────────────

describe("extractInitials()", () => {
  it("two-word name → first letters", () => expect(extractInitials("John Doe")).toBe("JD"));
  it("single word → first letter", () => expect(extractInitials("Alice")).toBe("A"));
  it("three words → first and last", () => expect(extractInitials("Mary Jane Watson")).toBe("MW"));
  it("extra whitespace handled", () => expect(extractInitials("  Bob   Lee  ")).toBe("BL"));
  it("empty string → ?", () => expect(extractInitials("")).toBe("?"));
  it("uppercase preserved", () => expect(extractInitials("john doe")).toBe("JD"));
});

describe("clampSize()", () => {
  it("defaults to 128 when undefined", () => expect(clampSize(undefined)).toBe(128));
  it("clamps below min to 32", () => expect(clampSize(10)).toBe(32));
  it("clamps above max to 512", () => expect(clampSize(9999)).toBe(512));
  it("accepts value in range", () => expect(clampSize(256)).toBe(256));
  it("accepts boundary 32", () => expect(clampSize(32)).toBe(32));
  it("accepts boundary 512", () => expect(clampSize(512)).toBe(512));
  it("falls back to 128 for NaN", () => expect(clampSize("abc")).toBe(128));
});

describe("buildAvatar() — determinism", () => {
  it("same name always produces identical SVG", () => {
    const s1 = buildAvatar({ name: "John Doe", size: 128 });
    const s2 = buildAvatar({ name: "John Doe", size: 128 });
    expect(s1).toBe(s2);
  });

  it("different names produce different background colors", () => {
    const s1 = buildAvatar({ name: "Alice Smith", size: 128 });
    const s2 = buildAvatar({ name: "Bob Jones", size: 128 });
    // Extract fill color from rect element
    const fill1 = s1.match(/fill="(rgb\([^"]+\))"/)?.[1];
    const fill2 = s2.match(/fill="(rgb\([^"]+\))"/)?.[1];
    expect(fill1).not.toBe(fill2);
  });

  it("SVG contains correct initials", () => {
    const svg = buildAvatar({ name: "Jane Smith", size: 128 });
    expect(svg).toContain(">JS<");
  });

  it("SVG reflects requested size", () => {
    const svg = buildAvatar({ name: "Test User", size: 64 });
    expect(svg).toContain('width="64"');
    expect(svg).toContain('height="64"');
  });
});

describe("buildAvatar() — contrast", () => {
  const NAMES = ["Alice", "Bob", "Charlie", "David", "Eve", "Frank", "Grace", "Hank"];

  it("foreground is always white or black", () => {
    for (const name of NAMES) {
      const svg = buildAvatar({ name, size: 128 });
      const fg = svg.match(/fill="(#(?:ffffff|000000))"/g);
      // The text element fill should be white or black
      expect(fg?.some((f) => f.includes("#ffffff") || f.includes("#000000"))).toBe(true);
    }
  });
});

// ── Route handler tests ───────────────────────────────────────────────────────

describe("GET /api/routes-f/avatar-initials", () => {
  it("returns SVG content-type", async () => {
    const res = await GET(makeGet("?name=John%20Doe"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/svg+xml");
  });

  it("SVG body is valid XML opening", async () => {
    const res = await GET(makeGet("?name=John%20Doe"));
    const body = await res.text();
    expect(body.startsWith("<svg")).toBe(true);
  });

  it("sets long-lived Cache-Control header", async () => {
    const res = await GET(makeGet("?name=Test"));
    expect(res.headers.get("Cache-Control")).toContain("max-age=31536000");
  });

  it("same name is deterministic across requests", async () => {
    const r1 = await (await GET(makeGet("?name=Steady%20State"))).text();
    const r2 = await (await GET(makeGet("?name=Steady%20State"))).text();
    expect(r1).toBe(r2);
  });

  it("respects size param", async () => {
    const body = await (await GET(makeGet("?name=Size%20Test&size=64"))).text();
    expect(body).toContain('width="64"');
  });

  it("clamps size below min to 32", async () => {
    const body = await (await GET(makeGet("?name=Min%20Test&size=10"))).text();
    expect(body).toContain('width="32"');
  });

  it("clamps size above max to 512", async () => {
    const body = await (await GET(makeGet("?name=Max%20Test&size=9999"))).text();
    expect(body).toContain('width="512"');
  });

  it("returns 400 when name is missing", async () => {
    const res = await GET(makeGet(""));
    expect(res.status).toBe(400);
  });

  it("returns 400 when name is whitespace only", async () => {
    const res = await GET(makeGet("?name=%20%20"));
    expect(res.status).toBe(400);
  });
});
