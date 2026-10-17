# On-Chain Subscriptions Architecture

## Overview

Subscriptions are now backed by an on-chain Soroban smart contract as the source of truth. The PostgreSQL `subscriptions` table serves as a synced cache only. This ensures:

- **Trust**: Subscription state is cryptographically proven on-chain.
- **Decentralization**: No single backend server is the arbiter of who has access.
- **Transparency**: Any party can independently verify subscription state by querying the contract.

## Contract Interface

See `lib/subscriptions/soroban-contract-spec.md` for the complete contract specification.

### Key Functions

- **`authorize_subscription`**: Subscriber signs and authorizes a subscription. Requires a valid Ed25519 signature and an authorization token that commits to the terms (amount, period, creator, tier).
- **`query_subscription`**: Read-only query to fetch the current subscription state for a subscriber and creator.
- **`is_active`**: Shortcut to check if a subscription is currently active (not cancelled, renews_at in future).
- **`cancel_subscription`**: Subscriber cancels their subscription, setting `cancelled_at = now`.

### Authorization Model

Subscriptions use **signed authorization tokens** with expiry. A subscriber signs a message committing to:
- Creator address
- Tier ID
- Amount per period
- Period duration (e.g., 2,592,000 seconds = 30 days)
- Authorization expiry timestamp

This token is passed to `authorize_subscription` on-chain. When `now >= authorization_expiry`, the subscription cannot renew automatically; the subscriber must re-authorize by signing a new token.

**Renewal Flow**:
1. Off-chain service (e.g., a cron job) detects subscriptions where `renews_at <= now`.
2. If the authorization token has not yet expired, call `authorize_subscription` again to bump `renews_at`.
3. If the token has expired, the subscription lapses until the subscriber re-authorizes.
4. The DB cache is synced from the contract state via RPC queries.

## Environment Configuration

### Required

```env
SOROBAN_RPC_URL=https://soroban-rpc.stellar.org  # or testnet equivalent
STREAMFI_SUBSCRIPTION_CONTRACT_ID=CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

The contract ID is the on-chain address of the deployed subscription contract. This must match the contract that holds the authoritative subscription state.

## Access-Check Flow

When a viewer attempts to access a subscribers-only stream:

1. **Get wallets**: Fetch the creator and viewer wallet addresses from the DB (or passed directly).
2. **RPC query**: Call `isSubscriptionActive(viewerWallet, creatorWallet)` via `lib/subscriptions/rpc-client.ts`.
3. **Cache lookup**: If the result was cached within the TTL (default 5 minutes), return it immediately.
4. **RPC read**: If cache miss or expired, query the contract via Soroban RPC to get the current subscription state.
5. **Verify state**: Check if the subscription exists, is not cancelled (`cancelled_at === null`), and `renews_at > now`.
6. **Fail-closed on error**: If the RPC is unreachable or returns an error, deny access (security-first).

### Caching Strategy

- **TTL**: 5 minutes (configurable per call).
- **Invalidation**: Cache is invalidated on explicit `invalidateSubscriptionCache()` call (e.g., after on-chain events).
- **Fallback on RPC failure**: Deny access (fail-closed). This is safer than serving stale cache for access gating.

## DB Schema Changes

The `subscriptions` table is now used as a **synced cache** rather than the source of truth:

| Column | Source | Synced From |
|--------|--------|-------------|
| `id` | DB | Internal row ID |
| `subscriber_id` | On-chain | Stellar wallet → user lookup |
| `creator_id` | On-chain | Stellar wallet → user lookup |
| `tier_id` | On-chain | Contract state |
| `authorized_at` | On-chain | Contract state |
| `renews_at` | On-chain | Contract state (renewal deadline) |
| `amount_usdc` | On-chain | Contract state (stroops → USD conversion) |
| `status` | On-chain | 'active' if `cancelled_at === null`, else 'cancelled' |
| `expires_at` | On-chain | = `renews_at` |
| `cancelled_at` | On-chain | Contract state |
| `created_at` | DB | Local sync timestamp |
| `updated_at` | DB | Local sync timestamp |

### Sync Process (Future)

A background job will periodically query the contract for subscriptions and update the DB cache. This ensures:
- Fast local reads via DB queries (for analytics, earnings reports, etc.).
- Eventual consistency with on-chain truth.
- Audit trail of all subscription state changes.

## Error Handling and Fallbacks

### RPC Unavailable

- **Access checks**: Deny access (fail-closed). This prevents unauthorized access during an RPC outage.
- **Error logging**: All RPC failures are logged with the subscriber and creator addresses (no sensitive data).

### Contract Not Deployed or Not Found

- **Access checks**: Deny access. The error should be escalated; the contract ID may be wrong or the contract not yet deployed.

### Invalid Subscriber/Creator Addresses

- **Access checks**: Deny access. The wallet addresses may not be properly initialized in the DB.

## Testing

See `lib/subscriptions/__tests__/rpc-client.test.ts` for comprehensive tests covering:

- Active subscriptions (allowed access)
- Lapsed subscriptions (denied access)
- Never-existed subscriptions (denied access)
- RPC errors (fail-closed: deny access)
- Cache TTL and invalidation
- All fallback scenarios

Run tests with:
```bash
npm run test -- lib/subscriptions/__tests__/rpc-client.test.ts
npm run test -- lib/__tests__/stream-access-rpc.test.ts
npm run test -- lib/stream/__tests__/access-rpc.test.ts
```

## Future Enhancements

1. **Automated renewal**: Background job that detects renewals and re-authorizes on-chain.
2. **Refund handling**: Support refunds via contract state and DB audit trail.
3. **Tier management**: Support multiple tiers with different amounts and features.
4. **Event subscriptions**: Listen for contract events (SubscriptionAuthorized, SubscriptionCancelled) to invalidate cache in real-time.
5. **RPC failover**: Add backup RPC endpoints and automatic failover.
