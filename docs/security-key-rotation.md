# Security key rotation runbook

## Keyring formats

Keep key material in the deployment secret manager. Do not commit values. Session keyring values are opaque strings of at least 32 characters; preserve the exact old `SESSION_SECRET` string as a previous value so existing tokens remain verifiable. AES keyring values are 32-byte hex values:

```json
{"activeKid":"2026-09","keys":{"2026-09":"<64-hex-character-key>","2026-06":"<previous-64-hex-character-key>"}}
```

Configure this as `SESSION_KEYRING_JSON` and `STELLAR_ENCRYPTION_KEYRING_JSON`. Session tokens now include a key ID; old tokens without IDs continue to validate against the configured overlap set. Custodial encryption writes `v1:<kid>:<iv>:<tag>:<ciphertext>` and reads the legacy `iv:tag:ciphertext` format by trying configured keys. Configure `TOTP_ENCRYPTION_KEYRING_JSON` separately before enabling TOTP enrollment.

For HMAC integrations use JSON with `activeKid` and a `keys` object of opaque secret strings. Configure `MUX_WEBHOOK_KEYRING_JSON` and `INTERNAL_API_KEYRING_JSON`; the verifier accepts up to five concurrent values so both sides can be rolled over without downtime.

## Rotation procedure

1. Add a new key ID and key while retaining the previous key in each keyring. Deploy the complete overlap set to all instances.
2. Make the new key active. New wallet envelopes and signed sessions use it; previous keys remain verification-only.
3. Run `npm run rotate:stellar-key -- --dry-run` in staging and review decrypt failures and row counts. Then run `npm run rotate:stellar-key`; the process handles Stellar keys and TOTP seeds in 100-user batches with separate cursors in `secret_rotation_checkpoints`, so rerunning resumes after interruption.
4. Exercise login, TOTP, wallet export, wallet regeneration, and signed Mux webhooks in staging. Retain the old key until re-encryption is complete and old sessions have expired.
5. Remove an old key only after confirming no stored envelope references it and the session overlap window has elapsed. Keep an encrypted offline recovery copy according to the custody policy.

Never rotate `STELLAR_ENCRYPTION_KEY` by replacing it directly. Never remove the previous session/HMAC key during a rolling deploy. Rehearse this procedure in staging before production use.

## Protected actions

`wallet_export`, `wallet_regeneration`, `admin_user_ban`, and `admin_user_delete` require a five-minute, action/resource-bound TOTP or one-time recovery-code challenge. Challenges are consumed once. There is no server-side payout trigger in this checkout; a payout endpoint must use the same centralized challenge policy before it is introduced.