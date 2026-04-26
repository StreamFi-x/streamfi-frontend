export interface JwtParts {
  header: object;
  payload: object;
  signature: string;
  warnings: string[];
}

export function decodeJwt(token: string): JwtParts {
  const parts = token.split(".");

  if (parts.length !== 3) {
    throw new Error("Invalid JWT: must contain exactly 3 segments separated by dots");
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  let header: object;
  let payload: object;

  try {
    const headerJson = Buffer.from(headerB64, "base64").toString("utf-8");
    header = JSON.parse(headerJson);
  } catch {
    throw new Error("Invalid JWT header: base64 decoding or JSON parsing failed");
  }

  try {
    const payloadJson = Buffer.from(payloadB64, "base64").toString("utf-8");
    payload = JSON.parse(payloadJson);
  } catch {
    throw new Error("Invalid JWT payload: base64 decoding or JSON parsing failed");
  }

  const warnings: string[] = [];

  // Check for expiration
  const payloadObj = payload as Record<string, unknown>;
  if (typeof payloadObj.exp === "number") {
    const expiresAt = payloadObj.exp * 1000; // Convert to milliseconds
    if (Date.now() > expiresAt) {
      warnings.push(`Token is expired (expired at ${new Date(expiresAt).toISOString()})`);
    }
  }

  // Signature not verified warning
  warnings.push("Signature NOT verified. Use this endpoint for debugging only.");

  // Check for missing standard claims
  const standardClaims = ["iss", "sub", "aud", "exp", "nbf", "iat"];
  const missingClaims = standardClaims.filter((claim) => !(claim in payloadObj));
  if (missingClaims.length > 0) {
    warnings.push(`Missing standard claims: ${missingClaims.join(", ")}`);
  }

  return {
    header,
    payload,
    signature: signatureB64,
    warnings,
  };
}
