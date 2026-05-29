export const SIGNATURES: { mime: string; extension: string; bytes: number[] }[] = [
  { mime: "image/png", extension: "png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/jpeg", extension: "jpg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/gif", extension: "gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: "application/pdf", extension: "pdf", bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: "application/zip", extension: "zip", bytes: [0x50, 0x4b, 0x03, 0x04] },
  { mime: "application/gzip", extension: "gz", bytes: [0x1f, 0x8b] },
  { mime: "video/mp4", extension: "mp4", bytes: [0x00, 0x00, 0x00] }, // ftyp box prefix
  { mime: "image/webp", extension: "webp", bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF header
];
