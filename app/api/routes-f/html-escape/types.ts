export interface HtmlEscapeRequest {
  input: string;
  mode: 'escape' | 'unescape';
}

export interface HtmlEscapeResponse {
  output: string;
}
