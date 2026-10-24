import { isSafeLinkUrl, toSafeHref } from "../safe-link";

describe("isSafeLinkUrl (#1737)", () => {
  it("accepts http and https URLs", () => {
    expect(isSafeLinkUrl("http://example.com")).toBe(true);
    expect(isSafeLinkUrl("https://example.com/path?x=1")).toBe(true);
  });

  it("accepts mailto: links", () => {
    expect(isSafeLinkUrl("mailto:someone@example.com")).toBe(true);
  });

  it("rejects javascript: URIs", () => {
    expect(isSafeLinkUrl("javascript:alert(document.cookie)")).toBe(false);
  });

  it("rejects data: URIs", () => {
    expect(isSafeLinkUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("rejects a syntactically invalid URL", () => {
    expect(isSafeLinkUrl("not a url")).toBe(false);
  });
});

describe("toSafeHref (#1737)", () => {
  it("returns the URL unchanged when it is safe", () => {
    expect(toSafeHref("https://example.com")).toBe("https://example.com");
  });

  it("returns undefined for a javascript: URI", () => {
    expect(toSafeHref("javascript:alert(1)")).toBeUndefined();
  });

  it("returns undefined for a data: URI", () => {
    expect(toSafeHref("data:text/html,<script>alert(1)</script>")).toBeUndefined();
  });

  it("returns undefined for null, undefined, or empty string", () => {
    expect(toSafeHref(null)).toBeUndefined();
    expect(toSafeHref(undefined)).toBeUndefined();
    expect(toSafeHref("")).toBeUndefined();
  });
});
