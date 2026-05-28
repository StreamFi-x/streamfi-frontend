import crypto from "crypto";

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function hashPassword(password: string) {
  return sha256(password);
}

export function verifyPassword(password: string, hashedPassword: string) {
  const expected = sha256(password);
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(hashedPassword, "hex");

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}
