# Payout Address Verification Security Specification

## Problem

**Risk:** A compromised account can silently redirect all future creator payouts by changing the payout address. With no additional verification, the attacker can set a new address and walk away, with the legitimate creator losing all revenue going forward.

**Why This Matters:**
- Session compromise, phishing, credential reuse → account takeover
- Single high-value attack: change payout address
- No friction, no notification = no detection window
- Creator's dashboard looks normal; only symptom is missing revenue
- Compounded by wallet-regeneration flows lacking safeguards

## Solution: Time-Locked Verification with Out-of-Band Notification

The fix implements **defense in depth** with multiple layers:

1. **Time-locked changes** (cooldown period) — Delays new address from taking effect
2. **Out-of-band notification** (email) — Alerts legitimate owner out-of-band
3. **Test-payment verification** (optional) — Proves wallet ownership
4. **Cancellation path** — Allows legitimate owner to block unrecognized changes
5. **Audit trail** — Logs all changes for forensics

### Architecture

```
User requests payout address change
          ↓
Validate new address (format, not same as current)
          ↓
Rate limit check (max N changes per day)
          ↓
Create pending change request with:
  - Unique request ID
  - Time-lock deadline (e.g., 3 days)
  - Test-payment flag (requires confirmation)
          ↓
Send out-of-band notification to verified contact:
  - Email to account's verified email
  - Includes cancellation link
  - Specifies when change becomes effective
          ↓
[During cooldown period]
  - Legitimate creator sees notification
  - Can click link to cancel (no login required)
  - OR logs in and cancels manually
  - OR does nothing (change proceeds after deadline)
          ↓
[After cooldown, before payout processing]
  - Cron job verifies pending changes past deadline
  - Marks as 'verified' (ready to use)
  - Test-payment requirement checked if configured
          ↓
[On next payout]
  - Check if verified change exists
  - Use new address or keep current
  - Change is now live
```

---

## Configuration

### Verification Settings

```typescript
interface PayoutVerificationConfig {
  cooldownDays: number;              // 3 = 3 day cooldown before change takes effect
  testPaymentAmount: number;         // 0.01 USDC/XLM = verify wallet ownership
  testPaymentAsset: 'USDC' | 'XLM';  // Which asset to use for test
  notificationChannel: 'email' | 'sms' | 'both';
  maxChangeAttemptsPerDay: number;   // 5 = prevent spam
}

// Default (recommended)
{
  cooldownDays: 3,
  testPaymentAmount: 0.01,
  testPaymentAsset: 'USDC',
  notificationChannel: 'email',
  maxChangeAttemptsPerDay: 5,
}
```

### Environment Variables

```bash
# Payout Security
PAYOUT_COOLDOWN_DAYS=3
PAYOUT_TEST_PAYMENT_AMOUNT=0.01
PAYOUT_TEST_PAYMENT_ASSET=USDC
PAYOUT_NOTIFICATION_CHANNEL=email
PAYOUT_MAX_CHANGES_PER_DAY=5

# Email Service Integration
EMAIL_SERVICE=sendgrid|mailgun|custom
SENDGRID_API_KEY=...
MAIL_FROM_ADDRESS=security@streamfi.com
```

---

## API Endpoints

### 1. Initiate Change

```
POST /api/routes-f/payout-address-change

Request (authenticated):
{
  "newPayoutAddress": "GAQAA5Z4K6U5ENRJEZL7HCL7R5D6ZE2BKRMQ4YC7STRONG6ENRJEZL7HCL7R"
}

Response (202 Accepted):
{
  "success": true,
  "requestId": "payout-change-550e8400-e29b-41d4-a716-446655440000",
  "cooldownDays": 3,
  "verificationDeadline": "2026-09-27T14:23:45Z",
  "message": "Your payout address change will take effect in 3 days. Check your email for details and cancel link."
}

Status Codes:
- 202: Change request created (pending verification)
- 400: Invalid address, rate limit exceeded, or same-address error
- 401: Unauthenticated
- 500: Server error
```

### 2. Verify Test Payment

```
POST /api/routes-f/payout-address-verify-payment

Request (authenticated):
{
  "requestId": "payout-change-550e8400-e29b-41d4-a716-446655440000",
  "testPaymentTxHash": "e2e4d5c3b2a9f1e8d7c6b5a4f3e2d1c0"
}

Response (200):
{
  "success": true,
  "message": "Test payment confirmed. Your wallet ownership has been verified."
}

Status Codes:
- 200: Test payment confirmed
- 400: Invalid request or mismatched user
- 401: Unauthenticated
```

### 3. Cancel Change

```
POST /api/routes-f/payout-address-cancel

Request (optional auth):
{
  "requestId": "payout-change-550e8400-e29b-41d4-a716-446655440000"
}

Response (200):
{
  "success": true,
  "message": "Payout address change has been cancelled. Your current address remains in effect."
}

Status Codes:
- 200: Change cancelled
- 400: Invalid/expired link or already cancelled/verified
- 401: Unauthorized (if attempting to cancel another user's request with auth)
```

### 4. Cron: Verify Ready Changes

```
GET /api/routes-f/cron-verify-pending-payout-changes

Headers:
  X-Cron-Secret: <CRON_SECRET>

Response (200):
{
  "success": true,
  "processed": 127,
  "verified": 125
}
```

---

## Data Model

### PayoutAddressChangeRequest

```typescript
{
  requestId: string;                     // Unique identifier
  userId: string;                        // Account owner
  currentAddress: string;                // Address being replaced
  proposedAddress: string;               // New address
  status: 'pending' | 'verified' | 'cancelled' | 'expired';
  createdAt: Date;                       // When request was created
  verificationDeadline: Date;            // When cooldown expires (3 days later)
  verifiedAt?: Date;                     // When approved for use
  cancelledAt?: Date;                    // When cancelled (if cancelled)
  cancellationReason?: string;           // Why it was cancelled
  testPaymentRequired: boolean;          // Does this require test payment?
  testPaymentVerified: boolean;          // Has test payment been confirmed?
  testPaymentTxHash?: string;            // Tx hash of test payment
}
```

### Payout Address Change Notification

Sent via email immediately after change request created:

```
Subject: Verify Your StreamFi Payout Address Change

Hi [Creator Name],

We received a request to change your payout address to:
  G...new address...

If you didn't make this request, CANCEL IT IMMEDIATELY:
  [CANCELLATION LINK]

The new address will take effect on:
  [DATE - 3 DAYS FROM NOW]

Until then, all payouts continue to your current address.

This request was initiated from:
  IP: [IP Address]
  User Agent: [Browser/Device]

If you have any questions, contact security@streamfi.com

---
Cancel Link (no login required): [link includes request ID]
Manage Account: [account settings link]
```

---

## Security Considerations

### Attack Scenarios Mitigated

1. **Session Compromise**
   - Attacker has active session, tries to change address
   - 3-day cooldown delays new address from taking effect
   - Legitimate owner gets email alert
   - Owner can cancel within window
   - **Mitigation:** Time-lock + notification

2. **Phishing Attack**
   - Attacker tricks creator into logging in on phishing site
   - Attacker changes payout address
   - Similar to session compromise
   - **Mitigation:** Out-of-band notification reaches legitimate owner's email (attacker likely doesn't control email)

3. **Credential Reuse**
   - Creator's password leaked from other service
   - Attacker uses credentials to log in
   - Again, time-lock provides window
   - **Mitigation:** Time-lock + notification

4. **Wallet Compromise (via test payment)**
   - Attacker might set an address they can't actually receive payments to
   - Test payment confirmation proves they control the new wallet
   - **Mitigation:** Test-payment verification

### Limitations

**What This DOESN'T Protect Against:**

- **Compromised Email:** If attacker also controls creator's email, they can cancel the notification
  - Mitigation: Platform should support additional contact methods (SMS, authenticator app)
  - Mitigation: Creator should use strong email password, 2FA on email

- **Creator Willingly Complied:** If creator was socially engineered or coerced into approving the change
  - Mitigation: Requires out-of-band security training and awareness

- **Insider Attack:** If platform employee with database access changes the address
  - Mitigation: Requires backend access controls, audit logging, least-privilege database permissions

### Rate Limiting

- Max N change requests per user per day (default: 5)
- Prevents spam/brute-force attempts on cancellation logic
- Tunable via `maxChangeAttemptsPerDay` config

### Audit Trail

- All change requests logged with timestamps
- Cancellations logged with reason
- Test-payment confirmations logged with tx hash
- Verifications logged with automatic vs. manual status

---

## Implementation Checklist

- [ ] **PayoutAddressVerifier** class created
- [ ] **Time-locked changes** with cooldown enforcement
- [ ] **Out-of-band notification** integration (email)
- [ ] **Test-payment verification** mechanism
- [ ] **Cancellation path** with no-auth support
- [ ] **Cron job** for automatic verification after cooldown
- [ ] **API endpoints** for initiate, verify, cancel
- [ ] **Rate limiting** on change attempts
- [ ] **Audit logging** of all changes
- [ ] **Tests** for cooldown timing, cancellation, notifications
- [ ] **Email templates** for notifications
- [ ] **Documentation** for creators on security flow
- [ ] **Runbook** for security incident response

---

## Testing Strategy

### Unit Tests (in `payout-verification.test.ts`)

✅ **Cooldown Timing:**
- Initiating change creates deadline 3 days in future
- Verification blocked before deadline
- Verification allowed after deadline
- Expired changes marked as expired

✅ **Cancellation Path:**
- Legitimate owner can cancel anytime before verification
- Non-owner cannot cancel
- Cancellation prevents verification
- Cannot cancel already-verified changes
- Cancellation reason tracked

✅ **Test-Payment Verification:**
- Test payment flag set on creation
- Cannot verify without test payment if required
- Test payment confirmation marks as verified
- Tx hash stored for audit trail

✅ **Notifications:**
- Notification sent on request creation
- Notification includes cancellation link
- Multiple notification handlers supported
- Failed handlers don't block subsequent handlers

✅ **Rate Limiting:**
- Allows N changes per day
- Blocks on (N+1)th attempt
- Resets per calendar day

### Integration Tests (e.g., `payout-address-change.integration.test.ts`)

```typescript
describe('End-to-End Payout Address Security', () => {
  it('prevents attacker from changing address within cooldown window', async () => {
    // Create user, set initial address
    // Simulate attacker session change request
    // Verify legitimate owner gets email notification
    // Verify owner can cancel via link
    // Verify change does NOT take effect even after TTL (because cancelled)
  });

  it('applies verified change on next payout after cooldown', async () => {
    // Create user with address A
    // Request change to address B
    // Wait for cooldown period
    // Verify change is now active (address B would be used for payouts)
  });

  it('handles multiple pending changes (latest takes precedence)', async () => {
    // Request change A→B
    // Request change A→C (before B verified)
    // Verify only latest (A→C) proceeds
    // Previous request (A→B) handled appropriately
  });
});
```

### Load Tests

- Verify performance under high notification volume
- Test cron job with thousands of pending requests
- Verify no race conditions in cancellation/verification

---

## Deployment Checklist

1. **Before Rollout:**
   - [ ] All tests passing (unit, integration, load)
   - [ ] Email delivery tested (sendgrid, mailgun, or custom)
   - [ ] Cancellation link tested in email client
   - [ ] Cron job scheduling configured
   - [ ] Rate limiting tuned for realistic creator behavior
   - [ ] Runbook written for security incidents

2. **At Rollout:**
   - [ ] Feature flag: new payout changes require verification
   - [ ] Existing payout addresses grandfather in (no verification required)
   - [ ] Creator notification: explain new security flow
   - [ ] Support team trained on cancellation/override process

3. **Post-Rollout:**
   - [ ] Monitor email delivery rates
   - [ ] Monitor cancellation rates (should be low; high = false positives)
   - [ ] Monitor change verification completion rates
   - [ ] Gather creator feedback on UX friction
   - [ ] Adjust cooldown days if too restrictive

---

## Future Enhancements

1. **Multi-factor verification:** Require 2FA or security questions
2. **SMS notifications:** Redundant contact channel
3. **Authenticator app:** TOTP or push approval
4. **Whitelist addresses:** Allow fast-track for previously-used addresses
5. **Graduated cooldowns:** Shorter cooldown for re-enabling recent addresses
6. **IP-based alerts:** Flag changes from new IP addresses
7. **Velocity-based alerts:** Flag unusual patterns (multiple changes in short time)

---

## References

- CWE-639: Authorization Bypass Through User-Controlled Key (request parameter manipulation to bypass access controls)
- OWASP: Insecure Direct Object References
- Security Best Practice: Time-locked critical changes with out-of-band notification
