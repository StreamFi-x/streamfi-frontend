/**
 * Mock verification for a Twitter OAuth 2.0 authorization code.
 *
 * Twitter's real OAuth 2.0 (PKCE) flow issues an authorization code that
 * must be exchanged server-side for an access token, then queried against
 * `GET /2/users/me` for the account's id/username — it does not issue a
 * client-decodable JWT the way Google Identity Services does, so this
 * cannot follow oauth-google-link's JWT-decode approach.
 *
 * This repo has no Twitter API client/credentials configured yet, so this
 * is a mock code -> profile lookup (matching the seed-data-driven pattern
 * already used by sibling mock routes in this folder) rather than a real
 * network call. In production this should be swapped for a real
 * authorization-code exchange (e.g. via `twitter-api-v2`'s
 * `loginWithOAuth2`) before this endpoint is trusted with real
 * account-linking traffic. Documented as a known limitation.
 */
import type { TwitterCredentialResult } from "./types";

const MOCK_AUTHORIZED_CODES: Record<string, { id: string; username: string }> = {
  valid_twitter_code_1: { id: "tw_1001", username: "creator_one" },
  valid_twitter_code_2: { id: "tw_1002", username: "creator_two" },
  valid_twitter_code_already_linked: { id: "tw_1003", username: "creator_three" },
};

export function verifyTwitterCredential(oauthCode: unknown): TwitterCredentialResult {
  if (typeof oauthCode !== "string" || oauthCode.trim().length === 0) {
    return { ok: false, error: "oauth_code is required" };
  }

  const profile = MOCK_AUTHORIZED_CODES[oauthCode];
  if (!profile) {
    return { ok: false, error: "Invalid or expired Twitter authorization code" };
  }

  return {
    ok: true,
    claims: { id: profile.id, username: profile.username },
  };
}
