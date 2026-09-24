import { serializeJsonLd } from "@/lib/serialize-json-ld";

describe("serializeJsonLd (#1613)", () => {
  it("escapes script-breaking bio so </script> cannot appear unescaped", () => {
    const payload = {
      "@context": "https://schema.org",
      "@type": "Person",
      name: "attacker",
      description: '</script><script>alert("xss")</script>',
    };

    const html = serializeJsonLd(payload);

    expect(html.includes("</script>")).toBe(false);
    expect(html).toContain("\\u003c/script>");
    // Remains valid JSON after unicode unescape of <
    expect(JSON.parse(html.replace(/\\u003c/g, "<"))).toEqual(payload);
  });

  it("escapes stream title breakout in VideoObject name/description", () => {
    const payload = {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: 'Live</script><script>alert(1)</script>',
      description: 'bio<!--',
    };

    const html = serializeJsonLd(payload);

    expect(html.includes("</script>")).toBe(false);
    expect(html.includes("<!--")).toBe(false);
    expect(html).toContain("\\u003c/script>");
    expect(html).toContain("\\u003c!--");
  });

  it("round-trips ordinary bios unchanged semantically", () => {
    const payload = {
      name: "alice",
      description: 'Hello "world" & friends <3',
    };
    const html = serializeJsonLd(payload);
    expect(JSON.parse(html.replace(/\\u003c/g, "<"))).toEqual(payload);
  });
});
