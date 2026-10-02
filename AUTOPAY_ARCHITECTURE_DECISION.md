# Autopay Architecture Decision: Soroban Pre-Authorized Allowance vs. Custodial Pre-Funded Balance

## Problem Statement

Current subscription implementation relies on manual renewal. Users must proactively remember to renew their subscription or they lose access. This creates two issues:

1. **Churn through friction:** Higher-than-necessary churn from subscribers who forget to renew, not due to deliberate cancellation
2. **Subpar user experience:** Unexpected loss of access when a subscription lapses is poor UX for a product marketed as a recurring subscription

**The Core Constraint:** Stellar has no native recurring-payment primitive. There is no way to automatically charge a wallet without either:
- The user re-authorizing each payment (breaks the "automatic" requirement)
- The platform having standing permission to move funds on the user's behalf

This document evaluates the two viable architectural approaches and recommends a path forward.

---

## Option 1: Soroban Pre-Authorized Allowance (Smart Contract Approach)

### How It Works

Deploy a Soroban smart contract that implements a recurring-payment allowance mechanism:

1. **User authorizes** the contract with permission to charge their wallet for recurring payments (via a signed Soroban invocation)
2. **Contract stores** the authorization with parameters: amount, cycle duration, max total charges, beneficiary creator
3. **Platform calls contract** each renewal period to execute the recurring charge without user re-signature
4. **Contract validates** the charge is within authorized bounds before transferring funds

### Pseudocode (Soroban Rust)
```rust
#[contract]
pub struct RecurringPayment {
  // Authorized recurring payment
  struct Authorization {
    subscriber: Address,
    creator: Address,
    amount: i128,
    cycle_days: u32,
    max_total_cycles: u32,
    cycles_used: u32,
  }

  pub fn authorize_recurring_payment(
    subscriber: Address,
    creator: Address,
    amount: i128,
    cycle_days: u32,
    max_cycles: u32,
  ) -> Result<(), Error> {
    // Store authorization
    // Verify subscriber has signed this invocation
  }

  pub fn execute_recurring_charge(auth_id: u64) -> Result<(), Error> {
    // Check authorization is valid
    // Check cycles_used < max_cycles
    // Transfer funds from subscriber to creator
    // Increment cycles_used
  }

  pub fn cancel_recurring_payment(auth_id: u64) -> Result<(), Error> {
    // Allow subscriber to revoke authorization
  }
}
```

### Tradeoffs

#### Advantages
- **No custodial risk:** Platform never holds user funds
- **True automation:** Zero user friction after initial authorization
- **Transparent:** All transactions on-chain, auditable
- **Subscriber control:** User can revoke at any time (on-chain call)
- **Scales with Soroban:** Benefits from future smart contract improvements

#### Disadvantages
- **Requires smart contract development:** Non-trivial Soroban/Rust development
- **Security auditing required:** Contracts handling recurring payments need professional audit (financial bugs are expensive)
- **User UX complexity:** Requires explaining smart contract authorization to non-technical users
- **Stellar ecosystem immaturity:** Soroban is relatively new; fewer reference implementations
- **Failed payments hard to retry:** If a charge fails (user insufficient balance), manual retry flow needed
- **Deployment overhead:** Requires contract deployment, versioning, upgrades
- **Regulatory uncertainty:** Contract-mediated payments may trigger regulatory questions depending on jurisdiction

---

## Option 2: Custodial Pre-Funded Balance (Platform-Managed Account Approach)

### How It Works

Platform holds a subscriber-funded balance and draws down each renewal period:

1. **User funds a balance** with the platform (e.g., "add $50 to my account") via one-time Stellar payment
2. **Platform holds balance** in a controlled wallet or contract
3. **Platform charges balance** each renewal cycle without additional user transaction
4. **Platform alerts user** when balance is low or depleted
5. **User refunds balance** if they cancel or don't renew

### Pseudocode (Database Model)
```typescript
interface UserBalance {
  user_id: string;
  balance_usdc: number;
  created_at: Date;
  last_refunded_at?: Date;
}

interface SubscriptionWithBalance {
  subscription_id: string;
  subscriber_id: string;
  creator_id: string;
  tier_id: string;
  balance_depleted_at?: Date;
}

async function renewSubscriptionFromBalance(
  subscription: SubscriptionWithBalance,
  tierPrice: number
) {
  const balance = await getUserBalance(subscription.subscriber_id);
  
  if (balance.balance_usdc < tierPrice) {
    // Insufficient balance — notify user
    return { success: false, reason: 'insufficient_balance' };
  }

  // Deduct from balance, create new subscription
  await deductFromBalance(subscription.subscriber_id, tierPrice);
  await createNewSubscription(subscription);
  
  return { success: true };
}
```

### Tradeoffs

#### Advantages
- **Simpler to implement:** Pure database/ledger logic, no contract development
- **Faster failure handling:** Insufficient balance is immediately visible; can retry on next cron cycle
- **Better UX for users:** "Click to fund, then forget about renewal" is familiar from many SaaS products
- **No blockchain calls during renewal:** Faster, cheaper renewal processing
- **Clearer user mental model:** Users understand "prepaid balance" more easily than smart contracts
- **Regulatory clarity:** Prepaid account model is well-understood by regulators in many jurisdictions

#### Disadvantages
- **Custodial responsibility:** Platform holds user funds (even if temporary)
- **Refund complexity:** Must track and process refunds if users cancel or don't renew
- **Single point of failure:** If platform wallet is compromised, user funds at risk
- **Regulatory surface:** Holding user funds may require licensing, compliance depending on jurisdiction
- **KYC/AML considerations:** May require user verification for account funding
- **Liquidity management:** Platform must maintain sufficient balance to handle refunds and creator payouts

---

## Recommendation: Hybrid Phased Approach

**Phase 1 (Now):** Implement expiry notifications + one-click renewal with **manual payment** (current status)
- Users get proactive alerts 3 days before expiry
- One-click renewal skips creator/tier selection, streamlines checkout
- Reduces friction significantly without payment architecture changes

**Phase 2 (Near-term):** Implement **Custodial Pre-Funded Balance**
- Lower barrier to entry than Soroban
- Sufficient for MVP recurring billing
- Platform can add "Quick Renew" button: "Charge $X from your StreamFi balance?"
- Rationale: Balance model scales with current architecture, user familiar with prepaid accounts

**Phase 3 (Long-term):** Migrate to **Soroban Pre-Authorized Allowance** (once Soroban ecosystem matures)
- Eliminates custodial risk and refund complexity
- True automation without platform holding funds
- Requires contract audit and user education on smart contract authorization

---

## Phase 1 Implementation (Current PR)

✅ **Expiry Notifications:**
- Cron job runs daily, checks subscriptions expiring in N days
- Sends "Your subscription expires in 3 days" notification
- Includes one-click renewal link

✅ **One-Click Renewal:**
- GET `/api/routes-f/subscription-renew?subscription_id=XXX` returns pre-populated intent
- Client redirects to checkout with creator/tier pre-selected
- User only needs to confirm payment (no re-entry of details)

✅ **Manual Payment Renewal:**
- POST `/api/routes-f/subscription-renew-confirm` completes renewal with new payment tx hash
- Creates new subscription record, marks old one as "cancelled"
- Tracks renewal_count for analytics/insights

---

## Phase 2 Implementation Plan (Future)

### Database Schema Changes
```sql
-- Add balance tracking
CREATE TABLE user_balances (
  user_id UUID PRIMARY KEY,
  balance_usdc NUMERIC,
  created_at TIMESTAMP,
  last_refunded_at TIMESTAMP,
  last_funded_at TIMESTAMP
);

-- Track refund requests
CREATE TABLE balance_refund_requests (
  id UUID PRIMARY KEY,
  user_id UUID,
  amount_usdc NUMERIC,
  status 'pending' | 'processing' | 'completed',
  created_at TIMESTAMP,
  completed_at TIMESTAMP
);
```

### API Endpoints
```
POST /api/routes-f/balance-fund       — User funds their account
GET  /api/routes-f/balance-status     — Check balance
POST /api/routes-f/balance-refund     — Request refund
GET  /api/routes-f/subscription-renew-with-balance — Quick renew from balance
```

---

## Phase 3 Implementation Plan (Future)

### Soroban Contract
```rust
// Deploy contract to Stellar testnet/mainnet
// Support for:
// - authorize_recurring_payment()
// - execute_recurring_charge()
// - cancel_recurring_payment()
```

### API Endpoints
```
POST /api/routes-f/authorize-recurring-payment  — Get unsigned Soroban tx for user to sign
GET  /api/routes-f/recurring-payment-status     — Check authorization status
```

---

## Timeline and Effort

| Phase | Effort | Timeline | Complexity |
|-------|--------|----------|-----------|
| Phase 1 (Expiry alerts + manual renewal) | 1-2 weeks | Now | Low |
| Phase 2 (Custodial balance) | 3-4 weeks | 1-2 months | Medium |
| Phase 3 (Soroban contract) | 6-8 weeks + audit | 3-4 months | High |

---

## Risk Analysis

### Phase 1 Risks
- **Low:** Pure application logic, no financial transactions changed
- **Mitigation:** Test notification timing extensively

### Phase 2 Risks
- **Medium:** Platform holds user funds (even temporarily)
- **Mitigation:** 
  - Implement strict access controls on balance accounts
  - Audit balance accounting logic
  - Provide transparent balance statement to users
  - Consider custody insurance

### Phase 3 Risks
- **High:** Smart contract handles fund transfers
- **Mitigation:**
  - Hire professional Soroban auditor
  - Start with limited max-charge caps
  - Extensive testing on testnet before mainnet
  - Implement circuit breaker to halt charges if anomalies detected

---

## Acceptance Criteria Met

✅ **Proactive notifications:** Cron job sends expiry alerts N days before expiry
✅ **One-click renewal flow:** Streamlined checkout skipping creator/tier selection
✅ **Documented autopay direction:** This document records tradeoffs and phased approach
✅ **Tests:** Full test coverage for notification timing and renewal flow happy/failure paths

---

## Future Decisions

1. **Pre-funding approach:** If implementing Phase 2, decide on per-tier funding caps or unlimited prepaid accounts
2. **Refund policy:** If implementing Phase 2, establish refund window and grace periods
3. **Soroban migration:** Monitor Soroban ecosystem maturity; revisit Phase 3 quarterly
