export interface Base64Request {
  input: string;
  mode: "encode" | "decode";
  variant?: "standard" | "urlsafe";
  padding?: boolean;
}

export interface Base64Response {
  output: string;
}
