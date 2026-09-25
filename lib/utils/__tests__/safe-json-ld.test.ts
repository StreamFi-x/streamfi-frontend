import { safeJsonLdStringify } from "../safe-json-ld";

describe("safeJsonLdStringify", () => {
  it("escapes closing script tags to prevent HTML script breakout", () => {
    const malicious = {
      name: "evil streamer",
      bio: "</script><script>alert('xss')</script>",
    };

    const output = safeJsonLdStringify(malicious);

    expect(output).not.toContain("</script>");
    expect(output).not.toContain("<script>");
    expect(output).not.toContain("<");
    expect(output).toContain("\\u003c/script\\u003e");

    const parsed = JSON.parse(output);
    expect(parsed.bio).toBe("</script><script>alert('xss')</script>");
    expect(parsed.name).toBe("evil streamer");
  });

  it("handles empty or nullish values gracefully", () => {
    expect(safeJsonLdStringify(null)).toBe("");
    expect(safeJsonLdStringify(undefined)).toBe("");
  });

  it("safely stringifies standard JSON-LD schema objects", () => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "Person",
      name: "streamer123",
      url: "https://streamfi.com/streamer123",
      description: "Just a streamer <gaming & fun>",
    };

    const output = safeJsonLdStringify(schema);
    expect(output).not.toContain("<");
    const parsed = JSON.parse(output);
    expect(parsed.description).toBe("Just a streamer <gaming & fun>");
    expect(parsed["@type"]).toBe("Person");
  });
});
