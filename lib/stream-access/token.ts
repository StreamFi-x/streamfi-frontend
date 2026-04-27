import { signToken, verifyToken } from "@/lib/auth/sign-token";

const TOKEN_EXPIRY_SECONDS = 24 * 60 * 60; // 24 hours

interface StreamAccessPayload {
  streamId: string;
  iat: number;
  exp: number;
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not configured");
  }
  return secret;
}

export function issueStreamAccessToken(streamId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: StreamAccessPayload = {
    streamId,
    iat: now,
    exp: now + TOKEN_EXPIRY_SECONDS,
  };
  return signToken(payload, getSecret());
}

export function validateStreamAccessToken(
  token: string,
  streamId: string
): boolean {
  const payload = verifyToken<StreamAccessPayload>(token, getSecret());
  if (!payload) {
    return false;
  }
  return payload.streamId === streamId;
}
