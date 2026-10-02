import crypto from "crypto";

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, hashedPassword: string): boolean {
  if (!password || !hashedPassword) return false;

  if (hashedPassword.includes(":")) {
    const [salt, hash] = hashedPassword.split(":");
    if (!salt || !hash) return false;
    const derived = crypto.scryptSync(password, salt, 64).toString("hex");
    const left = Buffer.from(derived, "hex");
    const right = Buffer.from(hash, "hex");
    if (left.length !== right.length) return false;
    return crypto.timingSafeEqual(left, right);
  }

  // Legacy unsalted sha256 fallback
  const expected = crypto.createHash("sha256").update(password).digest("hex");
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(hashedPassword, "hex");

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}
