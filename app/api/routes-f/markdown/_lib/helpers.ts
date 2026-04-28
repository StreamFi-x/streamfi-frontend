const MAX_MARKDOWN_SIZE = 50 * 1024; // 50 KB

export function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  return text.replace(/[&<>"']/g, char => htmlEscapes[char]);
}

export function processMarkdown(markdown: string): string {
  // Check size limit
  if (markdown.length > MAX_MARKDOWN_SIZE) {
    throw new Error("Markdown content exceeds 50 KB limit");
  }

  // Escape HTML first to prevent XSS
  let html = escapeHtml(markdown);

  // Process code blocks first (before other markdown processing)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const escapedCode = code.trim();
    return `<pre><code class="language-${lang || "text"}">${escapedCode}</code></pre>`;
  });

  // Process inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Process headers (h1-h6)
  html = html.replace(/^(#{1,6})\s+(.+)$/gm, (match, hashes, content) => {
    const level = hashes.length;
    return `<h${level}>${content.trim()}</h${level}>`;
  });

  // Process bold text
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");

  // Process italic text
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/_([^_]+)_/g, "<em>$1</em>");

  // Process links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Process unordered lists
  html = html.replace(/^[\*\-\+]\s+(.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>");
  html = html.replace(/<\/ul>\s*<ul>/g, "");

  // Process ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>");

  // Convert consecutive <li> elements to <ol>
  html = html.replace(
    /(<li>[\s\S]*?<\/li>)(\s*<li>[\s\S]*?<\/li>)*/g,
    match => {
      // Check if this is already in a <ul>
      if (
        html
          .substring(Math.max(0, html.indexOf(match) - 5), html.indexOf(match))
          .includes("<ul>")
      ) {
        return match;
      }
      return `<ol>${match}</ol>`;
    }
  );

  // Process paragraphs (lines that aren't already HTML elements)
  html = html
    .split("\n\n")
    .map(paragraph => {
      const trimmed = paragraph.trim();
      if (!trimmed) return "";

      // Skip if it starts with an HTML tag (already processed)
      if (trimmed.match(/^<(h[1-6]|ul|ol|li|pre|code|strong|em|a)/)) {
        return trimmed;
      }

      // Convert line breaks within paragraphs
      const paragraphContent = trimmed.replace(/\n/g, "<br>");
      return `<p>${paragraphContent}</p>`;
    })
    .join("\n\n");

  return html.trim();
}
