# StreamFi Subscription Contract Interface (Soroban)

## Overview
The subscription contract is the on-chain source of truth for subscription state. The frontend DB is a synced cache only.

## Contract State

### Subscription Record
```
struct Subscription {
  subscriber: Address,
  creator: Address,
  tier_id: u32,
  authorized_at: u64,              // Unix timestamp of last authorization
  renews_at: u64,                  // Unix timestamp when renewal is required
  amount_stroops: u128,            // Amount per period in stroops
  period_seconds: u64,             // Subscription period (e.g., 30 days)
  authorization_expiry: u64,       // Signed authorization expires at this timestamp
  cancelled_at: Option<u64>,       // Unix timestamp of cancellation; None = active
}
```

## Contract Functions

### authorize_subscription
**Purpose**: Subscriber authorizes a new subscription or renewal.

**Input**:
- `subscriber: Address` — the subscriber (signer)
- `creator: Address` — the content creator
- `tier_id: u32` — subscription tier
- `amount_stroops: u128` — amount per period
- `period_seconds: u64` — renewal period (e.g., 2592000 for 30 days)
- `authorization_expiry: u64` — this authorization valid until this Unix timestamp
- `sig: BytesN<64>` — Ed25519 signature authorizing the subscription (signed by subscriber)

**Logic**:
- Verify `sig` is valid and signed by `subscriber`
- Verify `authorization_expiry > now`
- Create or update the Subscription record
- Set `cancelled_at = None`
- Emit `SubscriptionAuthorized` event

**Returns**: Subscription record

### query_subscription
**Purpose**: Read the current subscription state on-chain.

**Input**:
- `subscriber: Address`
- `creator: Address`

**Logic**:
- Look up Subscription record
- Return it or None

**Returns**: Option<Subscription>

### is_active
**Purpose**: Determine if a subscription is currently active (shortcut for gating).

**Input**:
- `subscriber: Address`
- `creator: Address`

**Logic**:
- Query Subscription
- Return `true` if: subscription exists AND `cancelled_at == None` AND `renews_at > now`

**Returns**: bool

### cancel_subscription
**Purpose**: Subscriber cancels their subscription.

**Input**:
- `subscriber: Address` (signer)
- `creator: Address`

**Logic**:
- Verify signer is subscriber
- Look up Subscription
- Set `cancelled_at = now`
- Emit `SubscriptionCancelled` event

**Returns**: Subscription record (with updated cancelled_at)

## Authorization Model

### Signed Token (Recommended for MVP)
Subscriber signs an authorization token (Ed25519) that commits to:
- Creator address
- Tier ID
- Amount per period
- Period duration
- Authorization expiry timestamp

Token is valid until `authorization_expiry`. When `now >= authorization_expiry`, the subscriber must re-authorize by signing and calling `authorize_subscription` again. This prevents unauthorized indefinite renewal.

**Renewal Flow**:
1. Off-chain service (backend job) checks `renews_at <= now` for active subscriptions
2. If renewal needed and authorization not yet expired, call `authorize_subscription` to bump `renews_at`
3. If authorization expired, subscription lapses; no automatic renewal until re-authorized
4. DB cache is updated from contract state via RPC read

## Events

### SubscriptionAuthorized
```
event SubscriptionAuthorized {
  subscriber: Address,
  creator: Address,
  tier_id: u32,
  amount_stroops: u128,
  period_seconds: u64,
  renews_at: u64,
}
```

### SubscriptionCancelled
```
event SubscriptionCancelled {
  subscriber: Address,
  creator: Address,
  cancelled_at: u64,
}
```

## Relationship to DB Subscriptions Table

| Column | Source | Purpose |
|--------|--------|---------|
| `id` | DB | Internal row ID |
| `subscriber_id` | On-chain | Cached from contract |
| `creator_id` | On-chain | Cached from contract |
| `tier_id` | On-chain | Cached from contract |
| `authorized_at` | On-chain | Cached from contract |
| `renews_at` | On-chain | Cached from contract |
| `amount_usdc` | On-chain (stroops → USD) | Cached from contract |
| `status` | On-chain | 'active' = not cancelled; 'cancelled' = cancelled_at != None |
| `expires_at` | On-chain | = renews_at (when renewal is required) |
| `cancelled_at` | On-chain | Cached from contract |
| `created_at` | DB | Local record creation |
| `updated_at` | DB | Local record update (set on RPC sync) |

## Notes

- No native recurring billing on Stellar, so authorization with expiry + periodic re-authorization is the model
- Contract enforces on-chain state; DB is eventually consistent
- RPC reads are synchronous on the hot path; caching with TTL mitigates latency
- Fail-closed on RPC unavailable: deny access rather than serve stale cache (security-first for gating)
