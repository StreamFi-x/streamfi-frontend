# Tip-Goal Escrow Model

## Overview

Tip goals require holding funds in escrow until a goal is met or a deadline is reached. There are two primary models, each with tradeoffs:

### Model 1: Dedicated Escrow Account (Recommended for MVP)

**Setup**: Each stream has a dedicated Stellar account funded as an escrow holder. The creator controls the account key but releases funds only after goal conditions are met.

**Custody**:
- Escrow account public key is stored in the DB
- Private key is stored in a secure key management service (AWS KMS, Vult, etc.)
- Only backend can sign release transactions

**Flow**:
1. Viewer sends tip to escrow account (via Horizon)
2. Backend records the tip in DB with contributor details
3. If goal is reached: backend releases funds to creator account
4. If deadline passes: backend refunds all contributors
5. Real-time progress pushed to all viewers

**Pros**:
- Simple, auditable on-chain (visible on Stellar explorer)
- Fine-grained control; can partially release or hold funds
- No additional contract development needed
- Straightforward refund logic (single transaction per contributor or batch)

**Cons**:
- Requires key custody (mitigated by KMS)
- Escrow account must hold all tips (not distributed until release)
- Each creator needs separate account (cost: account creation + minimum balance)

### Model 2: Soroban Contract Escrow

**Setup**: A single Soroban smart contract holds all tips for all creators. Contract enforces release conditions.

**Custody**:
- Contract controls the escrow balance
- No human key custody needed
- Release logic is onchain and deterministic

**Flow**:
1. Viewer calls contract to deposit tip for a goal
2. Contract updates escrow balance and individual balances
3. If goal is reached: contract releases funds to creator
4. If deadline passes: contract allows withdrawals by contributors

**Pros**:
- No key custody needed
- Fully decentralized (contract owns the funds)
- Can serve multiple creators from one contract

**Cons**:
- Requires Soroban contract development (out of scope for this issue)
- Contract must handle refund logic (complex for many contributors)
- Higher gas costs if many contributors
- Test and audit burden

## Selected Model: Dedicated Escrow Account

For this MVP, we use **Model 1 (Dedicated Escrow Account)** because:
- No contract development needed
- Clear audit trail on Stellar network
- Simple refund logic
- Can launch immediately

## Escrow Account Management

### Creation
- One account per active tip-goal (or one shared per creator)
- Account is funded with minimum balance (1 XLM)
- Public key stored in `tip_goals` table
- Private key stored in KMS with restricted access

### Lifecycle
1. **Goal Created**: Escrow account public key generated and stored
2. **Contributions**: Tips sent to escrow account address
3. **Goal Reached**: Release funds to creator account
4. **Goal Missed**: Initiate refunds to all contributors
5. **Deadline Passed**: Clean up (archive account or disable)

## Refund Logic

### Per-Contributor Tracking

```sql
CREATE TABLE tip_goal_contributions (
  id UUID PRIMARY KEY,
  goal_id UUID NOT NULL REFERENCES tip_goals(id),
  contributor_wallet VARCHAR(255) NOT NULL,
  contributor_id UUID REFERENCES users(id),
  amount_xlm NUMERIC(20, 7) NOT NULL,
  tx_hash VARCHAR(255) NOT NULL,
  refunded BOOLEAN DEFAULT FALSE,
  refund_tx_hash VARCHAR(255),
  refund_attempted_at TIMESTAMPTZ,
  refund_failed_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Refund Flow

1. Goal deadline passes without reaching threshold
2. Identify all contributions for the goal
3. For each contribution:
   - Create refund transaction from escrow to contributor wallet
   - Sign with escrow account key (via KMS)
   - Submit to Stellar network
   - Mark refund_tx_hash and refund_attempted_at
4. Retry failed refunds (exponential backoff)
5. Handle unreachable accounts (no trustline for XLM, account closed, etc.)

### Failure Handling

**Unreachable Account**:
- If refund tx fails because account cannot receive XLM (no trustline, closed, etc.), mark as `refund_failed_reason = "unreachable_account"`
- Do NOT retry indefinitely
- Flag in UI so contributor can contact support
- Consider sweeping to creator's account after timeout or manual review

**Transient Failure** (network error, sequence number mismatch):
- Mark `refund_failed_reason = "transient_failure"`
- Retry with exponential backoff (1s, 2s, 4s, etc. up to 24 hours)
- Alert if retries exhaust

## State Machine

```
DRAFT
  ↓ (creator sets up goal)
ACTIVE
  ├─ (goal met before deadline)
  │  ↓
  │ GOAL_REACHED → RELEASING_FUNDS → RELEASED
  │
  └─ (deadline passes, goal not met)
     ↓
     DEADLINE_PASSED → REFUNDING → REFUND_COMPLETE
```

## Database Schema

```sql
CREATE TABLE tip_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES stream_sessions(id) ON DELETE SET NULL,
  
  title VARCHAR(255) NOT NULL,
  description TEXT,
  goal_amount_xlm NUMERIC(20, 7) NOT NULL,
  current_amount_xlm NUMERIC(20, 7) DEFAULT 0,
  current_contributor_count INTEGER DEFAULT 0,
  
  -- Escrow account for holding tips
  escrow_account_public_key VARCHAR(255) NOT NULL,
  
  -- Timeline
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- State
  status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'GOAL_REACHED', 'RELEASING_FUNDS', 'RELEASED', 'DEADLINE_PASSED', 'REFUNDING', 'REFUND_COMPLETE')),
  
  -- Completion tracking
  goal_reached_at TIMESTAMPTZ,
  release_completed_at TIMESTAMPTZ,
  refund_completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tip_goals_creator ON tip_goals(creator_id);
CREATE INDEX idx_tip_goals_stream ON tip_goals(stream_id);
CREATE INDEX idx_tip_goals_expires ON tip_goals(expires_at) WHERE status IN ('ACTIVE', 'GOAL_REACHED');

CREATE TABLE tip_goal_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES tip_goals(id) ON DELETE RESTRICT,
  contributor_wallet VARCHAR(255) NOT NULL,
  contributor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  amount_xlm NUMERIC(20, 7) NOT NULL,
  tx_hash VARCHAR(255) NOT NULL UNIQUE,
  
  -- Refund tracking
  refunded BOOLEAN DEFAULT FALSE,
  refund_tx_hash VARCHAR(255) UNIQUE,
  refund_attempted_at TIMESTAMPTZ,
  refund_attempt_count INTEGER DEFAULT 0,
  refund_failed_reason TEXT,
  refund_next_retry_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_contributions_goal ON tip_goal_contributions(goal_id);
CREATE INDEX idx_contributions_wallet ON tip_goal_contributions(contributor_wallet);
CREATE INDEX idx_contributions_pending_refund ON tip_goal_contributions(goal_id) WHERE refunded = FALSE AND tx_hash IS NOT NULL;
```

## Real-Time Progress Sync

See `lib/tip-goals/realtime-progress.ts` for implementation.

- Progress published to channel: `tip-goal:${goalId}:progress`
- Payload: `{ currentAmountXlm, currentContributorCount, goalReached, message }`
- Published on: contribution received, goal reached, deadline passed, refund complete
- Server aggregates contributions and pushes to subscribers without per-viewer polling

## Race-Safe Goal Detection

See `lib/tip-goals/goal-resolution.ts` for implementation.

- Use DB transaction with SERIALIZABLE isolation
- Check current + new amount against threshold atomically
- Update status to GOAL_REACHED in same transaction
- Triggers release job immediately
- Prevents duplicate goal-reached events from concurrent tips

## Refund Retry Strategy

See `lib/tip-goals/refund-processor.ts` for implementation.

- Failed refunds marked with `refund_next_retry_at`
- Exponential backoff: 1s, 2s, 4s, 8s, ..., 24h max
- Background job polls failed refunds every 5 minutes
- Retries up to 288 times (24 hours)
- If unreachable: alert operator, allow manual resolution
