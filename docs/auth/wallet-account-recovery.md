# Account Recovery Specification for Non-Custodial (Wallet-Only) Users

## 1. Problem Statement (#1446)
While custodial (Privy) accounts have automated OAuth recovery, self-custodied wallet users (e.g. Freighter users) whose sole credential is a Stellar secret key face total account loss if their key is misplaced.

---

## 2. Recovery Architecture & Verification Model

### Proactive Secondary Binding
1. **Authenticated Linking**: Logged-in wallet users configure a secondary recovery method via `POST /api/auth/recovery/setup`.
2. **Two-Step Verification**: A 6-digit verification code is delivered to the recovery email and confirmed via `POST /api/auth/recovery/verify-setup` before being activated.

### Abuse-Resistant Recovery Execution
1. **Challenge Request**: The user submits their username and new public key via `POST /api/auth/recovery/request`.
2. **Single-Use Signed Token**: A 32-byte cryptographic token (hashed with SHA-256) is issued with a 15-minute expiration.
3. **Execution & Rebinding**: `POST /api/auth/recovery/execute` replaces the account's wallet with the new Stellar address, terminates all existing active sessions (`DELETE FROM user_sessions`), and invalidates all cached profile data.

---

## 3. Deliberate Handling for Unconfigured Accounts
- Accounts that never configured a verified secondary recovery method prior to losing their key **cannot be recovered**.
- This deliberate architectural constraint protects the platform from social engineering attacks, credential stuffing, and fraudulent identity takeovers.
