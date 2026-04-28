import type { Heading } from "./types";

interface ParsedMarkdown {
  html: string;
  headings: Heading[];
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

function stripEventHandlers(html: string): string {
  // Remove event handler attributes like onclick, onload, etc.
  return html.replace(/\s+on[a-z]+="[^"]*"/gi, "");
}

function stripScriptTags(html: string): string {
  // Remove <script> tags and their content
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
}

function stripJavascriptLinks(html: string): string {
  // Replace javascript: URLs with #
  return html.replace(/href="javascript:[^"]*"/gi, 'href="#"');
}

export function sanitizeHtml(html: string): string {
  let sanitized = html;
  sanitized = stripScriptTags(sanitized);
  sanitized = stripEventHandlers(sanitized);
  sanitized = stripJavascriptLinks(sanitized);
  return sanitized;
}

function parseInlineMarkdown(text: string): string {
  // Bold: **text** or __text__
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");

  // Italic: *text* or _text_
  text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  text = text.replace(/_([^_]+)_/g, "<em>$1</em>");

  // Inline code: `text`
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Links: [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  return text;
}

function countWords(text: string): number {
  const cleaned = text.replace(/[^\w\s]/g, " ");
  const words = cleaned.split(/\s+/).filter((word) => word.length > 0);
  return words.length;
}

export function parseMarkdown(markdown: string): ParsedMarkdown {
  const lines = markdown.split("\n");
  const headings: Heading[] = [];
  const htmlLines: string[] = [];
  let inCodeBlock = false;
  let codeBlockContent = "";
  let inList = false;
  let listType: "ul" | "ol" | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for code block markers
    if (line.startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockContent = "";
        continue;
      } else {
        inCodeBlock = false;
        const escaped = escapeHtml(codeBlockContent.trim());
        htmlLines.push(`<pre><code>${escaped}</code></pre>`);
        continue;
      }
    }

    // Accumulate code block content
    if (inCodeBlock) {
      codeBlockContent += line + "\n";
      continue;
    }

    // Close list if needed
    if (inList && !line.match(/^[\s]*[-*+]\s/i) && !line.match(/^[\s]*\d+\.\s/)) {
      htmlLines.push(listType === "ol" ? "</ol>" : "</ul>");
      inList = false;
      listType = null;
    }

    // Headings: # text through ###### text
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      headings.push({ level, text });
      const processed = parseInlineMarkdown(text);
      htmlLines.push(`<h${level}>${processed}</h${level}>`);
      continue;
    }

    // Unordered lists: - item, * item, + item
    const ulMatch = line.match(/^[\s]*[-*+]\s+(.+)$/);
    if (ulMatch) {
      if (!inList || listType !== "ul") {
        if (inList && listType === "ol") {
          htmlLines.push("</ol>");
        }
        htmlLines.push("<ul>");
        inList = true;
        listType = "ul";
      }
      const content = parseInlineMarkdown(ulMatch[1]);
      htmlLines.push(`<li>${content}</li>`);
      continue;
    }

    // Ordered lists: 1. item, 2. item, etc.
    const olMatch = line.match(/^[\s]*\d+\.\s+(.+)$/);
    if (olMatch) {
      if (!inList || listType !== "ol") {
        if (inList && listType === "ul") {
          htmlLines.push("</ul>");
        }
        htmlLines.push("<ol>");
        inList = true;
        listType = "ol";
      }
      const content = parseInlineMarkdown(olMatch[1]);
      htmlLines.push(`<li>${content}</li>`);
      continue;
    }

    // Skip empty lines
    if (line.trim() === "") {
      continue;
    }

    // Regular paragraphs
    const processed = parseInlineMarkdown(line);
    htmlLines.push(`<p>${processed}</p>`);
  }

  // Close any open list
  if (inList) {
    htmlLines.push(listType === "ol" ? "</ol>" : "</ul>");
  }

  // Close any unclosed code block
  if (inCodeBlock) {
    const escaped = escapeHtml(codeBlockContent.trim());
    htmlLines.push(`<pre><code>${escaped}</code></pre>`);
  }

  const html = htmlLines.join("\n");

  return { html, headings };
}

export function processMarkdown(markdown: string, sanitize: boolean = true): {
  html: string;
  headings: Heading[];
  word_count: number;
} {
  const { html: rawHtml, headings } = parseMarkdown(markdown);
  const html = sanitize ? sanitizeHtml(rawHtml) : rawHtml;
  const wordCount = countWords(markdown);

  return { html, headings, word_count: wordCount };
}
