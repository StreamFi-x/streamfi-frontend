# Security controls rollout

## Stream passwords

Creators set passwords in stream-channel preferences after choosing unlisted or subscriber-only privacy. Passwords are scrypt-hashed; they are never returned by API. Five wrong attempts for one `(live stream session, SHA-256(IP))` pair trigger a 30-second cooldown that doubles per later wrong attempt up to 15 minutes. The counter resets after 30 minutes without attempts; a correct password clears that pair. Old attempts are opportunistically removed after a day and cascade with stream-session deletion. Password, locked, and unknown-stream failures return the same status and response; dummy scrypt work is performed for missing/locked cases. Successful access grants are HttpOnly, short-lived, and bound to the current broadcast session.

## Impossible travel

Login session IP and coarse location history is retained for up to 30 days; anomaly findings are retained for up to 365 days without the IP/location history. `GEOIP_CITY_DB_PATH` must point to a licensed, locally provisioned MaxMind City database. The passive alert heuristic compares up to ten recent geolocated sessions and notifies on estimated travel above 900 km/h when observations are at least one minute apart. It does not block login. Review alert volume for VPNs, carrier reassignment, corporate egress, and travel before changing behavior; this implementation is intentionally detection-only.

## Step-up actions

The action list is centralized in `lib/security/step-up.ts`. Current protected actions are custodial wallet export, wallet regeneration, admin ban/unban, and admin user deletion. Challenges are resource-bound, expire after five minutes, permit at most five failed confirmations, and are consumed once. TOTP enrollment requires a valid authenticator code; recovery codes are shown once, stored as bcrypt hashes, and each can be consumed once. The existing application has no server-side payout trigger; any future payout mutation must be added to this action list and require the same challenge before execution.

## Deployment

Apply `20260928110000_security_controls.sql` before deploying the new routes. Provision GeoIP data and keyring environment variables before enabling their respective features. Do not turn on TOTP UI until the TOTP encryption keyring is configured. Exercise key rotation and anomaly alerting in staging; this draft has not been validated against production traffic.
