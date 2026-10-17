# Tip-Goal Escrow Feature

## Overview

Tip goals allow creators to set up milestone-based fundraising during streams. Viewers can contribute tips toward a goal (e.g., "raise 1000 XLM to unlock a special segment"), and funds are held in escrow until the goal is met or the deadline passes.

This is a Web3-native engagement mechanic:
- **Verifiable**: Funds are truly held in escrow on Stellar, not cosmetic client-side progress.
- **Fair**: If the goal is not met by the deadline, all contributors get their funds back automatically.
- **Real-time**: Viewers see live progress updates pushed to the UI.
- **Atomic**: Goal-reached transitions are race-safe; concurrent tips cannot duplicate the event.

## Custody Model

See `lib/tip-goals/escrow-model.md` for full details.

**Selected Model**: Dedicated Escrow Account

- One Stellar account per goal (or one shared per creator)
- Account holds all contributions until goal is resolved
- Creator controls the account key (stored in KMS)
- Private key is secure; backend signs release/refund transactions
- On-chain audit trail on Stellar network

## Architecture

### Core Modules

- **`lib/tip-goals/types.ts`**: Type definitions (TipGoal, TipGoalContribution, etc.)
- **`lib/tip-goals/goal-resolution.ts`**: Race-safe goal-reached detection (SERIALIZABLE transaction)
- **`lib/tip-goals/realtime-progress.ts`**: Real-time progress push to viewers
- **`lib/tip-goals/refund-processor.ts`**: Refund issuance with retry logic
- **`db/migrations/20260926140000_tip_goals_escrow.sql`**: DB schema

### Key Operations

#### Creating a Tip Goal
```typescript
import { createTipGoal } from "@/lib/tip-goals/goal-creation";

const goal = await createTipGoal({
  creator_id: "user-123",
  stream_id: "stream-456",
  title: "Unlock the 48-hour stream",
  description: "Hit 1000 XLM and I'll stream for 48 hours straight",
  goal_amount_xlm: "1000",
  deadline_minutes: 120, // 2 hours
});
```

#### Recording a Contribution (Race-Safe)
```typescript
import { recordContributionAndCheckGoal } from "@/lib/tip-goals/goal-resolution";

const result = await recordContributionAndCheckGoal(
  goalId,
  viewerWallet, // Stellar public key
  viewerId,
  "25.5", // XLM amount
  txHash // Stellar transaction hash
);

if (result.goalReached) {
  // Goal is now reached; trigger release
  console.log(`Goal reached! New amount: ${result.newAmount} XLM`);
}
```

#### Publishing Progress to Viewers
```typescript
import { publishProgressUpdate } from "@/lib/tip-goals/realtime-progress";

await publishProgressUpdate({
  goalId,
  currentAmountXlm: "750",
  currentContributorCount: 45,
  goalReached: false,
  percentComplete: 75,
  message: "So close! 250 XLM to go",
});
```

#### Processing Refunds on Deadline
```typescript
import { initiateGoalRefunds, processPendingRefunds } from "@/lib/tip-goals/refund-processor";

// 1. When deadline passes and goal is not met
await initiateGoalRefunds(goalId);

// 2. Background job processes refunds (runs every 5 min)
const result = await processPendingRefunds(
  goalId,
  escrowSecretKey, // From KMS
  creatorXlmAccount
);

console.log(`Refunded: ${result.refunded_count}, Failed: ${result.failed_count}`);
```

## State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│ Goal Creation                                                    │
│ Status: DRAFT                                                    │
│ (Waiting for creator to activate)                               │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ Active Collection                                                │
│ Status: ACTIVE                                                   │
│ (Tips flowing to escrow account)                                │
└────┬───────────────────────────────────────────┬────────────────┘
     │                                           │
     │ Goal met:                                 │ Deadline passes:
     │ Tips reach threshold                      │ Expires_at <= now()
     │                                           │
     ▼                                           ▼
┌──────────────────────────┐        ┌──────────────────────────┐
│ Goal Reached             │        │ Deadline Passed          │
│ Status: GOAL_REACHED     │        │ Status: DEADLINE_PASSED  │
│ (Waiting for release)    │        │ (Waiting for refunds)    │
└────┬─────────────────────┘        └────┬─────────────────────┘
     │                                    │
     ▼                                    ▼
┌──────────────────────────┐        ┌──────────────────────────┐
│ Releasing Funds          │        │ Refunding                │
│ Status: RELEASING_FUNDS  │        │ Status: REFUNDING        │
│ (Backend releases)       │        │ (Backend refunds)        │
└────┬─────────────────────┘        └────┬─────────────────────┘
     │                                    │
     ▼                                    ▼
┌──────────────────────────┐        ┌──────────────────────────┐
│ Released                 │        │ Refund Complete          │
│ Status: RELEASED         │        │ Status: REFUND_COMPLETE  │
│ (✓ Complete)             │        │ (✓ Complete)             │
└──────────────────────────┘        └──────────────────────────┘
```

## Race-Safe Goal Detection

Goal-reached is detected atomically using SERIALIZABLE transaction isolation:

```sql
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- 1. Lock the goal
SELECT id, status, goal_amount_xlm, current_amount_xlm FROM tip_goals WHERE id = ? FOR UPDATE;

-- 2. Record the contribution
INSERT INTO tip_goal_contributions (...) VALUES (...);

-- 3. Check if goal is reached (atomic with step 2)
IF (current_amount_xlm + new_amount >= goal_amount_xlm) AND status = 'ACTIVE' THEN
  UPDATE tip_goals SET status = 'GOAL_REACHED', goal_reached_at = NOW() WHERE id = ?;
END IF;

COMMIT;
```

**Why atomic?**
- Two concurrent tips landing near the threshold can race.
- Without atomicity, both might see the goal as not-reached and record contributions independently.
- With SERIALIZABLE isolation, exactly one transaction succeeds in setting status to GOAL_REACHED.
- The other sees that the goal is already reached and does not duplicate the event.

## Refund Logic

### Flow
1. Goal deadline passes → status changes to DEADLINE_PASSED (via cron job)
2. Backend calls `initiateGoalRefunds()` → status changes to REFUNDING
3. Background job processes refunds:
   - For each contribution, issue a refund Tx from escrow to contributor
   - On success: mark `refunded = true`, record `refund_tx_hash`
   - On failure: categorize and schedule retry
4. When all refunds are done → status changes to REFUND_COMPLETE

### Failure Handling

**Unreachable Account** (no trustline, account closed, etc.):
- Tx fails with: "Account does not exist", "No trust line", etc.
- Marked as `refund_failed_reason = 'unreachable_account'`
- **Not retried** (no point; account cannot receive)
- Requires manual intervention or sweep to creator's account

**Transient Failure** (network error, sequence mismatch, etc.):
- Marked as `refund_failed_reason = 'transient_failure'`
- Scheduled for retry with exponential backoff
- Retries: 1s, 2s, 4s, 8s, ..., up to 24 hours
- Max 288 retries (spans 24 hours)

**Max Retries Exceeded**:
- After 288 retries, mark as `refund_failed_reason = 'max_retries_exceeded'`
- Alert operator
- Requires manual investigation

### Exponential Backoff
```
Retry 1:  1 second
Retry 2:  2 seconds
Retry 3:  4 seconds
Retry 4:  8 seconds
...
Retry N:  min(1s * 2^(N-1), 24 hours)
```

## Real-Time Progress Sync

Progress is published to a realtime channel without per-viewer polling:

**Channel**: `tip-goal:${goalId}:progress`

**Events**:
- `tip-goal:progress`: New contribution or status update
  ```json
  {
    "currentAmountXlm": "750.5",
    "currentContributorCount": 42,
    "goalReached": false,
    "percentComplete": 75.05,
    "message": "750.5 / 1000 XLM (42 contributors)"
  }
  ```
- `tip-goal:reached`: Goal is reached
  ```json
  { "goalId": "goal-123" }
  ```
- `tip-goal:deadline-passed`: Deadline passed, refunds starting
  ```json
  { "goalId": "goal-123" }
  ```
- `tip-goal:refund-complete`: All refunds are done
  ```json
  { "goalId": "goal-123", "successCount": 42, "failureCount": 1 }
  ```

**Server-Side Aggregation**:
- Backend maintains the current sum in DB
- On each contribution, sums are updated atomically
- Progress is published once per contribution (or batched if high frequency)
- Viewers subscribe to the channel and receive updates in real-time
- No need for viewers to poll the chain directly

## Database Schema

See `db/migrations/20260926140000_tip_goals_escrow.sql` for full schema.

**Tables**:

### `tip_goals`
- `id`: UUID primary key
- `creator_id`: Who created the goal
- `stream_id`: Which stream session (optional)
- `title`, `description`: Goal metadata
- `goal_amount_xlm`: Target amount
- `current_amount_xlm`: Current sum of contributions
- `current_contributor_count`: Number of unique contributors
- `escrow_account_public_key`: Where tips are sent
- `status`: State (ACTIVE, GOAL_REACHED, RELEASED, etc.)
- `expires_at`: Deadline
- `goal_reached_at`, `release_completed_at`, `refund_completed_at`: Timestamps
- Indexes: creator, stream, expiry, status

### `tip_goal_contributions`
- `id`: UUID primary key
- `goal_id`: FK to tip_goals
- `contributor_wallet`: Stellar public key
- `contributor_id`: FK to users (optional, for internal tracking)
- `amount_xlm`: Contribution amount
- `tx_hash`: Stellar transaction hash (unique)
- Refund tracking: `refunded`, `refund_tx_hash`, `refund_attempt_count`, `refund_next_retry_at`, etc.
- Indexes: goal, wallet, pending refunds, unreachable accounts

## Testing

Run tests:
```bash
npm run test -- lib/tip-goals/__tests__/goal-resolution.test.ts
npm run test -- lib/tip-goals/__tests__/refund-processor.test.ts
```

Test coverage:
- Race conditions: concurrent tips crossing threshold
- Deadline transitions: goals moving to DEADLINE_PASSED
- Refund processing: success, transient failure with retry, unreachable, max retries
- Real-time progress: events published correctly

## Future Enhancements

1. **Partial Releases**: Release funds incrementally as milestones are reached (e.g., unlock content at 25%, 50%, 75%)
2. **Goal Templates**: Creator-predefined goals for different streams
3. **Analytics**: Track goal metrics (success rate, avg contribution, etc.)
4. **Notifications**: Email/push when goal is reached or refunds are issued
5. **Multi-Asset Support**: Accept USDC or other assets in addition to XLM
6. **Escrow Customization**: Per-goal escrow account or shared pool
7. **Event Subscriptions**: Real-time updates via contract events (more cost-efficient than polling)
8. **Stellar Events API**: Listen to account activity directly from Stellar instead of polling
