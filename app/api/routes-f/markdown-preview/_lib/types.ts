export interface MarkdownPreviewRequest {
  markdown: string;
  sanitize?: boolean;
}

export interface Heading {
  level: number;
  text: string;
}

export interface MarkdownPreviewResponse {
  html: string;
  headings: Heading[];
  word_count: number;
}
