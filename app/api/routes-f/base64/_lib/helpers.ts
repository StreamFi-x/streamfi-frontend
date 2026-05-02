const MAX_INPUT_BYTES = 1024 * 1024; // 1 MB

export function encodeBase64(
  input: string,
  variant: "standard" | "urlsafe" = "standard",
  padding: boolean = true
): string {
  const buffer = Buffer.from(input, "utf-8");
  let encoded = buffer.toString("base64");

  if (variant === "urlsafe") {
    encoded = encoded.replace(/\+/g, "-").replace(/\//g, "_");
  }

  if (!padding) {
    encoded = encoded.replace(/=/g, "");
  }

  return encoded;
}

export function decodeBase64(
  input: string,
  variant: "standard" | "urlsafe" = "standard"
): string {
  let decoded = input;

  if (variant === "urlsafe") {
    decoded = decoded.replace(/-/g, "+").replace(/_/g, "/");
  }

  // Add padding if missing
  const remainder = decoded.length % 4;
  if (remainder) {
    decoded += "=".repeat(4 - remainder);
  }

  try {
    const buffer = Buffer.from(decoded, "base64");
    return buffer.toString("utf-8");
  } catch {
    throw new Error("Invalid base64 input");
  }
}

export function validateInput(input: string): void {
  const bytes = Buffer.byteLength(input, "utf-8");
  if (bytes > MAX_INPUT_BYTES) {
    throw new Error(`Input exceeds maximum size of ${MAX_INPUT_BYTES} bytes`);
  }
}
