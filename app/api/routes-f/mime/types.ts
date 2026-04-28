export interface MimeLookupResponse {
  mime: string;
  category: "image" | "audio" | "video" | "text" | "application" | "font" | "model" | "multipart";
  extensions: string[];
}
