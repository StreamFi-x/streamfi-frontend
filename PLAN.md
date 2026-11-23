# Implementation Plan: Issues #1735, #1736, #1741, #1744

Branch: `feat/issues-1735-1736-1741-1744` (based on `dev`, targeting upstream `StreamFi-x/streamfi-frontend:dev`).

---

## Step 1 — Issue #1744: Sanitize API Error Responses Across All Route Handlers

### Goal
Ensure no API route handler in `app/api/**/route.ts` returns raw caught exception messages (`error.message`, `err.message`, `String(error)`, `details: ...`) or internal implementation strings (such as `"Database operation failed"` or `"Database error"`) directly in client-facing responses. Internal details are always logged server-side, while clients receive a consistent, safe, user-facing message.

### Implementation Details
1. **Create shared helper** `lib/api/error-response.ts`:
   - Export `INTERNAL_ERROR_MESSAGE = "An unexpected error occurred. Please try again later."`.
   - Export `createSanitizedErrorResponse(error: unknown, options: { context: string; publicMessage?: string; status?: number; extra?: Record<string, unknown>; headers?: HeadersInit }): NextResponse`:
     - Logs structured server-side diagnostics (`console.error(\`[\${context}]\`, ...)` with message/stack/name when `error instanceof Error`, or raw value otherwise).
     - Returns `NextResponse.json({ error: publicMessage ?? INTERNAL_ERROR_MESSAGE, ...extra }, { status: status ?? 500, headers })`.
2. **Audit and update all leaking route handlers in `app/api/`**:
   - `app/api/waitlist/subscribe/route.ts`: replace `"Database operation failed"` with sanitized response via `createSanitizedErrorResponse` (`publicMessage: "Unable to process your subscription right now. Please try again later."`).
   - `app/api/debug/clear-users/route.ts`: log error server-side and return sanitized `"Failed to clear users"` instead of `error.message`.
   - `app/api/debug/env/route.ts`: log error server-side and remove `details: error.message`.
   - `app/api/debug/migrate-chat/route.ts`: return sanitized `"Migration failed"` (with `success: false, changes_so_far: done`) instead of `error.message`.
   - `app/api/category/route.ts`: remove `details: message` from 500 response.
   - `app/api/category/[title]/streams/route.ts`: remove `details: message` from 500 response.
   - `app/api/developer/keys/route.ts` & `app/api/developer/keys/rotate/route.ts`: map known safe domain conditions (`"limit reached"` -> 400 `"API key limit reached"`, `"not found"` -> 404 `"API key not found"`) and return sanitized 500 messages otherwise (never forwarding raw `error.message`).
   - `app/api/notifications/send-transactional-email/route.ts`: log `result.error` server-side and remove `details: result.error` and `details: message` from 500 responses.
   - `app/api/streams/create/route.ts`: remove `details: muxError.message`, `details: dbError.message`, `details: errorMessage`; replace `"Failed to save stream data to database"` and `"Database error. Please try again later."` with safe user-facing messages (`"Failed to create stream. Please try again later."` / `"Service temporarily unavailable. Please try again later."`).
   - `app/api/streams/playback/[playbackId]/route.ts`: remove `details: error.message` from 500 response.
   - `app/api/tips/send/route.ts`: replace `{ error: 'Database error' }` with `{ error: 'Unable to process tip request. Please try again later.' }`.
   - `app/api/routes-f/backfill-trigger/route.ts`: remove `details: String(error)` from 500 response.
   - `app/api/routes-f/cron-subscription-expiry-alerts/route.ts`, `app/api/routes-f/cron-update-concurrent-viewers/route.ts`, `app/api/routes-f/cron-verify-pending-payout-changes/route.ts`: remove raw `error.message` / `String(error)` from 500 response bodies.
   - `app/api/routes-f/wallet-trustline/route.ts`: remove `details: message` and map invalid-input errors to safe static messages instead of raw `error.message`.
   - `app/api/routes-f/tip-send-xlm/route.ts`, `app/api/routes-f/tip-send-usdc/route.ts`, `app/api/routes-f/tip-send-multi-asset/route.ts`, `app/api/routes-f/tip-send-multi-asset-v2/route.ts`: map known recipient/trustline errors to safe static strings rather than forwarding raw caught `error.message`.
   - `app/api/routes-f/channel-points/balance/route.ts`, `app/api/routes-f/channel-points/balance/spend/route.ts`, `app/api/routes-f/channel-points/catalog/route.ts`, `app/api/routes-f/featured-stream/route.ts`, `app/api/routes-f/channel/info-panels/reorder/route.ts`, `app/api/routes-f/vod-playlist/route.ts`, `app/api/routes-f/vod-playlist/reorder/route.ts`: replace raw `error.message` / `err.message` pass-throughs with explicit mapped safe messages while preserving existing test contracts (e.g. `"Creator not found"` for `featured-stream`).
   - Remaining utility catch handlers (`app/api/routes-f/base32`, `binary-to-text`, `char-stats`, `cookie-parse`, `country-flag`, `duration`, `gcd-lcm`, `markdown-preview`, `nanoid`, `nth-prime`, `quadratic`, `robots-txt`, `scientific-notation`, `sitemap-xml`, `text-fingerprint`, `triangle`, `unix-date`, `vector-ops`, `xml-to-json`, `app/api/routesF/pascal-triangle`, `qr-payload-builder`): log caught exceptions server-side and return static safe 400 validation error messages (never `err.message` / `error.message` / `e.message`), verifying existing unit tests remain green.
3. **Tests**:
   - Create `__tests__/api/error-sanitization.test.ts`:
     - Unit tests for `createSanitizedErrorResponse`.
     - Route-level tests for `waitlist/subscribe`, `debug/clear-users`, `debug/env`, `debug/migrate-chat`, `streams/playback/[playbackId]`, `notifications/send-transactional-email` asserting internal DB/driver error text is logged server-side and never returned in the JSON body.
     - Static grep audit test scanning every `app/api/**/route.ts` to verify no `NextResponse.json` returns raw caught `error.message` / `err.message` / `e.message` / `String(error)` / `Database operation failed` / `Database error` (excluding typed domain error subclasses and Zod validation `issue.message`).

---

## Step 2 — Issue #1735: Email Re-Verification State Machine for Verified Accounts

### Goal
Define, document, and consistently implement an explicit state machine for changing the email address on an already-verified account, covering:
- Keeping the previous verified email active (`emailverified = true`) during the pending verification grace window so the account never shows verified on an unverified address and never loses its valid email prematurely.
- Transition from `verified` -> `pending_reverification` -> `verified` (with new email promoted).
- Handling delivery bounces/failures (`pending_reverification` -> `change_failed`) without losing the previous verified email.
- Explicit rollback (`pending_reverification` / `change_failed` -> `verified`) restoring the previous verified email and invalidating pending tokens.

### Implementation Details
1. **Documentation**: Create `docs/EMAIL_REVERIFICATION_STATE_MACHINE.md` with:
   - Mermaid state diagram (`stateDiagram-v2`).
   - Formal table of states (`unverified`, `verified`, `pending_reverification`, `change_failed`), events (`REQUEST_CHANGE`, `CONFIRM_NEW_EMAIL`, `DELIVERY_BOUNCED`, `TOKEN_EXPIRED`, `ROLLBACK_CHANGE`), guards, DB column invariants, and API endpoint contracts.
2. **Database Migration**: Create `db/migrations/20261120120000_add_pending_email_reverification.sql`:
   - Idempotently add to `users`:
     - `pending_email VARCHAR(255)`
     - `pending_email_requested_at TIMESTAMPTZ`
     - `email_change_status VARCHAR(32) NOT NULL DEFAULT 'none'`
     - `email_change_failure_reason TEXT`
     - `previous_verified_email VARCHAR(255)`
   - Add index `idx_users_pending_email_lower ON users (LOWER(pending_email)) WHERE pending_email IS NOT NULL`.
3. **Pure State Machine Module**: Create `lib/auth/email-reverification.ts`:
   - Export types: `EmailVerificationState`, `EmailChangeStatus`, `EmailAccountSnapshot`, `EmailChangeEvent`, `EmailTransitionResult`.
   - Export `deriveEmailVerificationState(snapshot: EmailAccountSnapshot): EmailVerificationState`.
   - Export `transitionEmailVerification(snapshot: EmailAccountSnapshot, event: EmailChangeEvent): EmailTransitionResult`:
     - Enforces all invariants (e.g., rejects changing to the same already-verified email; preserves `email` and `emailVerified: true` on `REQUEST_CHANGE` from `verified`; records `change_failed` while preserving `email` and `emailVerified: true` on `DELIVERY_BOUNCED`; promotes `pendingEmail` -> `email`, records `previousVerifiedEmail`, clears `pendingEmail` on `CONFIRM_NEW_EMAIL`; clears `pendingEmail` and restores `verified` with previous email intact on `ROLLBACK_CHANGE` or `TOKEN_EXPIRED`).
   - Export `canRollbackEmailChange(snapshot: EmailAccountSnapshot): boolean`.
4. **API Route Integration**:
   - `app/api/routes-f/auth-email-verify-request/route.ts`:
     - Query the authenticated user's current `email`, `emailverified`, `pending_email`, `email_change_status`.
     - Run `transitionEmailVerification(snapshot, { type: "REQUEST_CHANGE", newEmail: email })`.
     - If already verified on the same email, return `409` (`"This email address is already verified on your account"`).
     - Persist `pending_email`, `pending_email_requested_at`, `email_change_status = 'pending'`, `email_change_failure_reason = NULL` while leaving `users.email` and `users.emailverified` untouched for verified accounts!
     - If `sendEmailVerificationLink` fails (bounce/SMTP error):
       - For a verified account undergoing an email change: run `DELIVERY_BOUNCED` transition, invalidate the unconsumed token (`consumed_at = NOW()`), persist `email_change_status = 'failed'`, `email_change_failure_reason = 'Email delivery failed'`, keep previous verified `email` & `emailverified = true` intact, and return `200` (or structured status with `deliveryFailed: true`, `state: "change_failed"`, `canRollback: true`, `email: previousEmail`) — wait: let's check existing test `"still returns 200 even if sending the email fails"` so that existing behavior for initial verification stays 200 while verified-account email change clearly reports `deliveryFailed: true, state: "change_failed", canRollback: true, activeEmail`!
   - `app/api/routes-f/auth-email-verify-confirm/route.ts`:
     - After atomically consuming the token, verify the new email isn't verified on another account (`409` if taken, rolling back pending change without clobbering existing verified email).
     - Update `users` to set `previous_verified_email = CASE WHEN emailverified = true AND LOWER(email) != LOWER(${email}) THEN email ELSE previous_verified_email END`, `email = ${email}`, `emailverified = true`, `pending_email = NULL`, `pending_email_requested_at = NULL`, `email_change_status = 'none'`, `email_change_failure_reason = NULL`, `updated_at = NOW()`.
     - Return `{ message: "Email address verified successfully.", email, state: "verified" }`.
   - New route `app/api/routes-f/auth-email-change-rollback/route.ts`:
     - `GET`: returns current email verification state (`state`, `email`, `emailVerified`, `pendingEmail`, `emailChangeStatus`, `failureReason`, `canRollback`).
     - `POST`: authenticated via `verifySession`, runs `ROLLBACK_CHANGE` (or optional `{ action: "record_bounce", reason }` for bounce handling), invalidates any unconsumed `email_verification_tokens` for the user, clears `pending_email` / `pending_email_requested_at` / `email_change_failure_reason`, sets `email_change_status = 'none'`, keeps previous verified `email` & `emailverified = true` intact, invalidates user caches, and returns `{ message, state, email, emailVerified }`.
   - `app/api/users/updates/[wallet]/route.ts`:
     - Fix casing bug (`user.emailverified`, `user.emailnotifications`) and forbid client-supplied `emailVerified = true` self-verification.
     - If `user.emailverified === true` and `formData` includes a different `email`, do NOT overwrite `users.email` or clear `emailverified`; instead set `pending_email = newEmail`, `pending_email_requested_at = CURRENT_TIMESTAMP`, `email_change_status = 'pending'` and include `emailChangePending: true, pendingEmail: newEmail` in the JSON response.
5. **Tests**:
   - Create `lib/auth/__tests__/email-reverification.test.ts` covering all state machine transitions, invariants, bounce, expiry, rollback, and invalid transitions.
   - Update `app/api/routes-f/auth-email-verify-request/__tests__/route.test.ts` and `app/api/routes-f/auth-email-verify-confirm/__tests__/route.test.ts`.
   - Create `app/api/routes-f/auth-email-change-rollback/__tests__/route.test.ts`.

---

## Step 3 — Issue #1736: Prevent Concurrent Profile Section Edits from Overwriting Unrelated Fields

### Goal
Ensure editing and saving one profile settings section (e.g., Basic Settings: username/bio) from one tab/device does not silently overwrite changes saved to a different section (e.g., Social Links or Avatar/Banner) from another tab/device, AND detect true same-field conflicts with a clear `409 Conflict` warning instead of silent data loss.

### Implementation Details
1. **Create pure diff & conflict helper** `lib/users/profile-partial-update.ts`:
   - `ProfileSnapshot` interface (`username`, `bio`, `socialLinks`, `avatar`, `banner`, `updatedAt`).
   - `computeProfilePatch(initial: ProfileSnapshot, current: ProfileSnapshot)`:
     - Compares each section/field independently (`username`, `bio`, `socialLinks` normalized deep comparison, `avatar`, `banner`).
     - Returns `{ patch: Partial<UserUpdateInput>, baseValues: Record<string, unknown>, changedFields: string[], hasChanges: boolean }`.
   - `detectFieldConflicts(params: { serverRow: Record<string, unknown>; incomingFields: string[]; expectedUpdatedAt?: string | null; baseValues?: Record<string, unknown> | null }): string[]`:
     - If `expectedUpdatedAt` is supplied and matches the server row's `updated_at`, returns `[]` (no concurrent write occurred).
     - If `expectedUpdatedAt` differs from server's `updated_at` (a concurrent save happened):
       - If `baseValues` is provided: checks ONLY the fields in `incomingFields`; if a field's current server value differs from `baseValues[field]`, marks it as a conflicting field! Disjoint-section edits have `[]` conflicts and merge cleanly!
       - If `baseValues` is NOT provided (strict mode): returns `incomingFields` as conflicting.
2. **Fix Backend Update Endpoints (`app/api/users/updates/[wallet]/route.ts` and `app/api/users/updates/privy/[privyId]/route.ts`)**:
   - Detect exact field presence via `formData.has("username")`, `formData.has("bio")`, `formData.has("email")`, `formData.has("streamkey")`, `formData.has("emailNotifications")`, `formData.has("enable_recording")`, `formData.has("latency_mode")`, `formData.has("socialLinks")`, `formData.has("creator")`, plus `avatarFile` / `avatarUrlField` and `bannerFile`.
   - Parse optional `expectedUpdatedAt` and `baseValues` (JSON string) from `formData`.
   - Run `detectFieldConflicts(...)`: if any conflicting fields exist, return `409 Conflict` with `{ error: "Your profile was updated in another tab or device. Reload the latest profile before saving these fields.", code: "PROFILE_CONFLICT", conflictingFields, currentUser }`.
   - Validate ONLY the fields actually present in the request (never failing when unrelated fields are omitted).
   - Perform a **true partial SQL `UPDATE`** using explicit boolean presence flags (`CASE WHEN ${hasUsername} THEN ${username} ELSE username END`, etc.) so omitted columns are NEVER overwritten in PostgreSQL even if two requests execute concurrently between `SELECT` and `UPDATE`!
   - Also add `verifySession` ownership check note / keep existing Privy route contract intact while ensuring true partial updates and optimistic conflict checking on `privy/[privyId]/route.ts` as well.
3. **Update Frontend (`types/user.ts`, `components/auth/auth-provider.tsx`, `components/settings/profile/profile-page.tsx`)**:
   - Extend `UserUpdateInput` in `types/user.ts` with optional `expectedUpdatedAt?: string` and `baseValues?: Record<string, unknown>`.
   - Update `AuthProvider.updateUserProfile` in `components/auth/auth-provider.tsx`:
     - Append `username`, `email`, `bio`, `streamkey` whenever `!== undefined` (so explicitly clearing `bio` to `""` works, while omitted `undefined` fields are NOT sent at all!).
     - Append `expectedUpdatedAt` and `baseValues` when present.
     - Return `{ success, error, conflict?: boolean, conflictingFields?: string[], currentUser?: User, user?: User }`.
   - Update `components/settings/profile/profile-page.tsx`:
     - Store `initialSnapshot` when the user profile loads and refresh it after every successful save.
     - In `handleSaveChanges`, call `computeProfilePatch(initialSnapshot, currentSnapshot)`.
     - If `!hasChanges`, notify the user ("No changes to save") and skip the network request.
     - Send ONLY `patch` + `expectedUpdatedAt` + `baseValues` to `updateUserProfile`.
     - On success, merge the server-returned `result.user` into local form state & `initialSnapshot` so edits from other tabs are reflected seamlessly.
     - On `result.conflict`, display a clear conflict alert with conflicting field names and a "Reload Latest Profile" button that syncs from `result.currentUser` (or `refreshUser()`).
4. **Tests**:
   - Create `lib/users/__tests__/profile-partial-update.test.ts` testing dirty-diff calculation and field-level conflict detection (disjoint edits merge cleanly; same-field concurrent edits return conflicts; clearing fields works).
   - Expand `app/api/users/updates/[wallet]/__tests__/route.test.ts` and create `app/api/users/updates/privy/[privyId]/__tests__/route.test.ts` testing:
     - Partial update only touches fields present in `FormData`.
     - Concurrent disjoint-section save (stale `expectedUpdatedAt` + non-conflicting `baseValues`) succeeds (`200`) without overwriting other sections.
     - Concurrent same-field save (stale `expectedUpdatedAt` + modified server value) returns `409 Conflict` with `conflictingFields`.

---

## Step 4 — Issue #1741: Show Estimated Network Fee Before User Signs a Tip Transaction

### Goal
Fetch a real live Stellar network fee estimate from Horizon (`feeStats()`) before presenting the signing step, and display it clearly as a distinct line item separate from the tip amount in a pre-signature Tip Confirmation step before invoking wallet signing (`kit.signTransaction`).

### Implementation Details
1. **Enhance `lib/stellar/payments.ts`**:
   - Track whether the cached fee came from live Horizon `feeStats()` or a fallback (`isFallback: boolean`).
   - Export interface `FeeEstimateDetails`:
     ```ts
     export interface FeeEstimateDetails {
       stroops: number;
       xlm: number;
       baseFeeStroops: number;
       isSurgePricing: boolean;
       isFallback: boolean;
     }
     ```
   - Export `getFeeEstimateDetails(network?: "testnet" | "mainnet"): Promise<FeeEstimateDetails>` using the existing cached `feeStats()` pipeline (so `getRecommendedFeeStroops`, `calculateFeeEstimate`, and `getFeeEstimate` stay 100% backwards-compatible and share the same cache).
2. **Enhance `components/tipping/TipModal.tsx`**:
   - Add `"confirming"` to `TransactionState`: `"idle" | "confirming" | "building" | "signing" | "submitting" | "success" | "error"`.
   - Track live fee state: `feeDetails: FeeEstimateDetails | null`, `isLoadingFee: boolean`.
   - Fetch `getFeeEstimateDetails(network)` when the modal opens (showing `"Estimating..."` until resolved — never rendering a hardcoded value as if it were live).
   - Add a **Pre-Sign Confirmation Step (`transactionState === "confirming"`)**:
     - From `"idle"`, clicking `"Review Tip"` validates the amount, refreshes the live fee estimate via `getFeeEstimateDetails(network)`, checks sender balance & account funding (using that exact `feeDetails.stroops`), and enters `"confirming"` WITHOUT calling `kit.signTransaction` yet.
     - In `"confirming"`, render a clear, accessible confirmation summary (`data-testid="tip-confirmation-summary"`):
       - Recipient (`@recipientUsername` + truncated address)
       - **Tip amount**: `{amount} XLM` (plus USD equivalent if `xlmPrice > 0`)
       - **Estimated network fee**: `{feeDetails.xlm.toFixed(7)} XLM` (`{feeDetails.stroops} stroops`) as a distinct line item (`data-testid="estimated-network-fee"`), with optional USD equivalent if `xlmPrice > 0`, a surge-pricing notice if `feeDetails.isSurgePricing` (`"Network congestion detected — surge fee applied"`), or a fallback notice if `feeDetails.isFallback` (`"Live fee estimate unavailable — showing network base fee"`), plus a `"Refresh"` action to re-fetch the estimate.
       - **Total**: `{(parseFloat(amount) + feeDetails.xlm).toFixed(7)} XLM`
     - Footer buttons in `"confirming"`: `"Back"` (returns to `"idle"`) and `"Confirm & Sign"` (calls `handleConfirmAndSign()`, which builds the transaction with `feeStroops: feeDetails.stroops`, calls `kit.signTransaction(...)`, and submits).
3. **Tests**:
   - Expand `lib/stellar/__tests__/fee-estimate.test.ts` to verify `getFeeEstimateDetails` (normal fee, surge pricing flag, fallback flag on Horizon error/timeout).
   - Create `components/tipping/__tests__/TipModal.test.tsx` testing:
     - Shows loading indicator while fee estimate is in flight (not a hardcoded value).
     - Displays live network fee from Horizon `getFeeEstimateDetails` as a distinct line item separate from tip amount.
     - Clicking `"Review Tip"` enters confirmation step without invoking `kit.signTransaction`.
     - Confirmation step displays tip amount, estimated network fee (including surge pricing banner when `isSurgePricing: true`), and total.
     - Clicking `"Confirm & Sign"` calls `buildTipTransaction` with the exact displayed `feeStroops` and then calls `kit.signTransaction`.
     - Clicking `"Back"` returns to edit state without signing.

---

## Step 5 — Full Verification, Self-Assessment, Commit & Pull Request

1. Run full quality suite:
   - `npm.cmd run type-check`
   - `npm.cmd run lint`
   - `npm.cmd run format:check`
   - Jest tests for all modified/added suites (`npx.cmd jest ...`) and full test check.
2. Verify `git diff` and `git status` (do not stage `PLAN.md`; ensure zero emojis and zero AI attribution anywhere in commit messages, PR title, PR body, or code comments).
3. Self-assess quality (target >= 9/10 across correctness, edge cases, security, test coverage, and adherence to repo conventions).
4. Commit on `feat/issues-1735-1736-1741-1744`, push to `origin`, and open 1 Pull Request against `StreamFi-x/streamfi-frontend` base branch `dev` with:
   ```
   closes #1735
   closes #1741
   closes #1736
   closes #1744
   ```
