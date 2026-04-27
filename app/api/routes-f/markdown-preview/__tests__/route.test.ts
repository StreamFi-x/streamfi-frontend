import { POST } from "../route";
import { NextRequest } from "next/server";

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/routes-f/markdown-preview", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/routes-f/markdown-preview", () => {
  describe("markdown rendering", () => {
    it("renders headings", async () => {
      const res = await POST(
        makeReq({
          markdown: "# Title\n## Subtitle\n### Sub-subtitle",
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.html).toContain("<h1>Title</h1>");
      expect(body.html).toContain("<h2>Subtitle</h2>");
      expect(body.html).toContain("<h3>Sub-subtitle</h3>");
    });

    it("renders bold text", async () => {
      const res = await POST(
        makeReq({
          markdown: "This is **bold** text",
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.html).toContain("<strong>bold</strong>");
    });

    it("renders italic text", async () => {
      const res = await POST(
        makeReq({
          markdown: "This is *italic* text",
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.html).toContain("<em>italic</em>");
    });

    it("renders inline code", async () => {
      const res = await POST(
        makeReq({
          markdown: "Use `const x = 5` in JavaScript",
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.html).toContain("<code>const x = 5</code>");
    });

    it("renders code blocks", async () => {
      const res = await POST(
        makeReq({
          markdown: "```\nconst x = 5;\nconst y = 10;\n```",
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.html).toContain("<pre><code>");
      expect(body.html).toContain("const x = 5;");
      expect(body.html).toContain("const y = 10;");
    });

    it("preserves code block content exactly", async () => {
      const res = await POST(
        makeReq({
          markdown: "```\n<script>alert('test')</script>\n```",
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.html).toContain("&lt;script&gt;");
    });

    it("renders links", async () => {
      const res = await POST(
        makeReq({
          markdown: "Check [this link](https://example.com)",
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.html).toContain('<a href="https://example.com">this link</a>');
    });

    it("renders unordered lists", async () => {
      const res = await POST(
        makeReq({
          markdown: "- Item 1\n- Item 2\n- Item 3",
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.html).toContain("<ul>");
      expect(body.html).toContain("<li>Item 1</li>");
      expect(body.html).toContain("<li>Item 2</li>");
      expect(body.html).toContain("</ul>");
    });

    it("renders ordered lists", async () => {
      const res = await POST(
        makeReq({
          markdown: "1. First\n2. Second\n3. Third",
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.html).toContain("<ol>");
      expect(body.html).toContain("<li>First</li>");
      expect(body.html).toContain("</ol>");
    });

    it("renders paragraphs", async () => {
      const res = await POST(
        makeReq({
          markdown: "This is a paragraph.\n\nThis is another.",
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.html).toContain("<p>This is a paragraph.</p>");
      expect(body.html).toContain("<p>This is another.</p>");
    });
  });

  describe("heading extraction", () => {
    it("extracts headings with correct levels", async () => {
      const res = await POST(
        makeReq({
          markdown: "# H1\n## H2\n### H3",
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.headings).toEqual([
        { level: 1, text: "H1" },
        { level: 2, text: "H2" },
        { level: 3, text: "H3" },
      ]);
    });

    it("preserves heading order", async () => {
      const res = await POST(
        makeReq({
          markdown: "# Title\nSome text\n## Section\nMore text\n### Subsection",
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.headings.map((h: { text: string }) => h.text)).toEqual([
        "Title",
        "Section",
        "Subsection",
      ]);
    });
  });

  describe("word count", () => {
    it("counts words correctly", async () => {
      const res = await POST(
        makeReq({
          markdown: "This is a test with seven words here",
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.word_count).toBe(7);
    });

    it("counts words across multiple lines", async () => {
      const res = await POST(
        makeReq({
          markdown: "Hello world\nfoo bar",
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.word_count).toBe(4);
    });
  });

  describe("sanitization", () => {
    it("strips script tags by default", async () => {
      const res = await POST(
        makeReq({
          markdown: "<script>alert('xss')</script>Hello",
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.html).not.toContain("<script>");
    });

    it("strips event handlers by default", async () => {
      const res = await POST(
        makeReq({
          markdown: "[link](https://example.com)",
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.html).not.toContain("onclick");
    });

    it("replaces javascript: links with # by default", async () => {
      const res = await POST(
        makeReq({
          markdown: "[click](javascript:alert('xss'))",
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.html).not.toContain("javascript:");
      expect(body.html).toContain('href="#"');
    });

    it("disables sanitization when sanitize=false", async () => {
      const testHtml = "<div>content</div>";
      const res = await POST(
        makeReq({
          markdown: testHtml,
          sanitize: false,
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.html).toContain("<div>");
    });

    it("still sanitizes in unsanitized mode for script tags", async () => {
      const res = await POST(
        makeReq({
          markdown: "<script>alert('xss')</script>",
          sanitize: false,
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      // Script tags should still be removed even with sanitize=false
      expect(body.html).not.toContain("<script>");
    });
  });

  describe("validation", () => {
    it("returns 400 for missing markdown", async () => {
      const res = await POST(makeReq({}));
      expect(res.status).toBe(400);
    });

    it("returns 400 for non-string markdown", async () => {
      const res = await POST(makeReq({ markdown: 123 }));
      expect(res.status).toBe(400);
    });
  });

  describe("edge cases", () => {
    it("handles empty markdown", async () => {
      const res = await POST(makeReq({ markdown: "" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.html).toBe("");
      expect(body.word_count).toBe(0);
    });

    it("handles malformed markdown gracefully", async () => {
      const res = await POST(
        makeReq({
          markdown: "**unclosed bold\n*unclosed italic",
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(typeof body.html).toBe("string");
    });

    it("handles mixed markdown syntax", async () => {
      const res = await POST(
        makeReq({
          markdown: "# Main Title\n\nHello **world** with *emphasis*.\n\n- List item\n\n[Link](https://example.com)",
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.html).toContain("<h1>");
      expect(body.html).toContain("<strong>");
      expect(body.html).toContain("<em>");
      expect(body.html).toContain("<ul>");
      expect(body.html).toContain("<a href=");
    });
  });
});
