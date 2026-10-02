export interface TwitterCredentialClaims {
  /** Stable, unique Twitter account identifier. */
  id: string;
  username: string;
}

export type TwitterCredentialResult =
  | { ok: true; claims: TwitterCredentialClaims }
  | { ok: false; error: string };

export interface OauthTwitterLinkBody {
  /** Twitter OAuth 2.0 authorization code, exchanged (mocked here) for the
   * account's Twitter id/username. */
  oauth_code: string;
}

export interface TwitterLinkRecord {
  twitter_id: string;
  username: string;
  linked_at: string;
}

export interface OauthTwitterLinkResponse {
  linked: true;
  twitter_id: string;
  username: string;
  linked_at: string;
}
