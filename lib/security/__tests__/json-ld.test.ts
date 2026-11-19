import { serializeJsonLd } from "@/lib/security/json-ld";

describe("serializeJsonLd", () => {
  it("escapes script-closing markup from user-controlled values", () => {
    expect(serializeJsonLd({ bio: "</script><script>alert(1)</script>" }))
      .toBe('{"bio":"\\u003c/script>\\u003cscript>alert(1)\\u003c/script>"}');
  });
});