# Stellar Crypto Tipping Feature - MVP Technical Specification

> **Project:** StreamFi
> **Feature:** Peer-to-peer crypto tipping using Stellar blockchain
> **Scope:** MVP (Minimum Viable Product)
> **Status:** Post Stellar Migration
> **Author:** Technical Architecture Team
> **Date:** February 2026

---

## Table of Contents

1. [Current State & Context](#current-state--context)
2. [Feature Overview](#feature-overview)
3. [Technical Architecture](#technical-architecture)
4. [Database Design](#database-design)
5. [API Design](#api-design)
6. [Frontend Components](#frontend-components)
7. [Stellar Integration](#stellar-integration)
8. [Implementation Plan](#implementation-plan)
9. [Security Considerations](#security-considerations)
10. [Testing Strategy](#testing-strategy)
11. [Future Enhancements](#future-enhancements)

---

## Current State & Context

### Post-Migration Status

StreamFi has completed its migration from StarkNet to Stellar for wallet authentication. The current state includes:

**✅ Completed:**

- Stellar wallet integration (Freighter, xBull, Albedo, Lobstr)
- User authentication via Stellar public keys (`G...` addresses)
- `StellarWalletContext` providing: `kit`, `publicKey`, `isConnected`, `connect()`, `disconnect()`
- All API routes validate Stellar addresses using `isValidStellarAddress()`
- Database stores Stellar public keys in `users.wallet` column
- Session management with `stellar_auto_connect` and `stellar_last_wallet`

**📦 Available Dependencies:**

- `@creit-tech/stellar-wallets-kit` - Multi-wallet connection
- `@stellar/stellar-sdk` - Core Stellar SDK (Transaction building, StrKey validation)
- `@stellar/freighter-api` - Freighter-specific APIs

**🏗️ Existing Infrastructure:**

- PostgreSQL database with `users`, `stream_sessions`, `chat_messages` tables
- Next.js 14 App Router with React 18
- `/api/users/wallet/[wallet]` - Fetch user by Stellar public key
- `/api/streams/*` - Stream management endpoints
- Real-time streaming via Livepeer SDK

---

## Feature Overview

### MVP Goal

Enable viewers to send **XLM (native Stellar asset) tips** directly to streamers during live streams with **zero platform fees**.

### User Stories

**As a viewer:**

- I can tip a streamer in XLM during a live stream
- I can see a confirmation when my tip is sent
- I can view my tip transaction on the Stellar blockchain explorer

**As a streamer:**

- I can see incoming tips in real-time on my stream dashboard
- I can view my total tips received (all-time and per stream)
- I can see who tipped me and how much (if wallet has username)

### MVP Scope (Phase 1)

**✅ In Scope:**

- Tip button on stream pages
- Tip modal with amount input (XLM only)
- Transaction signing via connected Stellar wallet
- Transaction submission to Stellar network
- Tip history display (query Stellar Horizon API on-demand)
- Total tips counter on creator dashboard

**❌ Out of Scope (Future):**

- Stablecoin support (USDC)
- Platform fee splits
- Smart contract escrow
- Recurring/subscription tips
- Tip goals/animations
- Backend caching of tips (fully on-chain queries for MVP)

---

## Technical Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      StreamFi Frontend                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Stream Page (Viewer)                                 │  │
│  │  ┌─────────────┐  ┌──────────────┐                  │  │
│  │  │ Tip Button  │→│ Tip Modal     │                  │  │
│  │  └─────────────┘  │ (Amount Input)│                  │  │
│  │                   └───────┬───────┘                  │  │
│  └───────────────────────────┼──────────────────────────┘  │
│                               ↓                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Stellar Transaction Builder                          │  │
│  │  - Uses @stellar/stellar-sdk                         │  │
│  │  - Constructs Operation.payment()                    │  │
│  │  - Source: viewer's publicKey                        │  │
│  │  - Destination: creator's publicKey                  │  │
│  │  - Asset: XLM (Asset.native())                       │  │
│  └───────────────────────────┬──────────────────────────┘  │
│                               ↓                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Wallet Signature (Freighter/xBull/Albedo)          │  │
│  │  - User approves in wallet popup                     │  │
│  └───────────────────────────┬──────────────────────────┘  │
└────────────────────────────────┼──────────────────────────┘
                                 ↓
                    ┌────────────────────────┐
                    │   Stellar Network      │
                    │   (Mainnet/Testnet)    │
                    │   - Horizon API        │
                    │   - 3-5 sec settlement │
                    └────────────┬───────────┘
                                 ↓
                    ┌────────────────────────┐
                    │  Transaction Confirmed │
                    │  - Hash: TX_HASH_XYZ   │
                    └────────────┬───────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────┐
│                  Tip History Display                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Creator Dashboard                                    │  │
│  │  - Query Horizon API: /accounts/{publicKey}/payments│  │
│  │  - Filter by type=payment, asset=XLM                 │  │
│  │  - Display: sender, amount, timestamp, tx link      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component Architecture

```
app/
├── stream/
│   └── [username]/
│       └── page.tsx                    # Stream viewer page
│           └── <TipButton />           # New component
│
components/
├── stream/
│   ├── TipButton.tsx                   # NEW: Tip button component
│   ├── TipModal.tsx                    # NEW: Tip amount modal
│   └── TipConfirmation.tsx             # NEW: Success/error state
├── dashboard/
│   └── TipHistory.tsx                  # NEW: Tip list display
│
lib/
├── stellar/
│   ├── payments.ts                     # NEW: Payment transaction builder
│   └── horizon.ts                      # NEW: Horizon API client
│
utils/
└── stellar.ts                          # EXISTS: isValidStellarAddress()
```

### Data Flow

```
1. User clicks "Tip" button
   ↓
2. TipModal opens → user enters amount (e.g., "10 XLM")
   ↓
3. Frontend calls buildTipTransaction(viewerPublicKey, creatorPublicKey, amount)
   ↓
4. Transaction built with @stellar/stellar-sdk
   ↓
5. kit.signTransaction() called → wallet popup appears
   ↓
6. User approves in Freighter/xBull/Albedo
   ↓
7. Transaction submitted to Stellar via server.submitTransaction()
   ↓
8. Response received: { hash, ledger, successful }
   ↓
9. TipConfirmation shows success + link to stellarexpert.io
   ↓
10. (Optional) Poll Horizon API to refresh creator's tip history
```

---

## Database Design

### Approach: Hybrid (Minimal Backend State)

For MVP, we'll use a **lightweight hybrid approach**:

- **No dedicated `tips` table** (query Horizon API on-demand for tip history)
- **Add `total_tips_received` column** to `users` table for quick dashboard display
- **Cache mechanism** (optional): Store last Horizon API cursor in localStorage to avoid full history fetch

### Schema Changes

#### `users` Table - Add Columns

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_tips_received NUMERIC(20, 7) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_tips_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_tip_at TIMESTAMP;

COMMENT ON COLUMN users.total_tips_received IS 'Total XLM received via tips (cached from Horizon API)';
COMMENT ON COLUMN users.total_tips_count IS 'Number of tips received';
COMMENT ON COLUMN users.last_tip_at IS 'Timestamp of most recent tip';
```

#### Optional: `tip_cache` Table (For Performance)

```sql
CREATE TABLE IF NOT EXISTS tip_cache (
  id SERIAL PRIMARY KEY,
  receiver_wallet VARCHAR(56) NOT NULL,
  sender_wallet VARCHAR(56),
  amount NUMERIC(20, 7) NOT NULL,
  asset VARCHAR(50) DEFAULT 'XLM',
  tx_hash VARCHAR(64) UNIQUE NOT NULL,
  ledger INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT fk_receiver FOREIGN KEY (receiver_wallet) REFERENCES users(wallet)
);

CREATE INDEX idx_tip_cache_receiver ON tip_cache(receiver_wallet);
CREATE INDEX idx_tip_cache_created_at ON tip_cache(created_at DESC);

COMMENT ON TABLE tip_cache IS 'Cache of tips fetched from Horizon API for faster dashboard display';
```

**Decision:** Start without `tip_cache` table. Add only if Horizon API queries are too slow (unlikely for MVP).

---

## API Design

### New API Routes

#### `GET /api/tips/[username]`

Fetch tip history for a creator from Stellar Horizon API.

**Request:**

```
GET /api/tips/johndoe?limit=20&cursor=now
```

**Query Parameters:**

- `limit` (optional, default: 20): Number of tips to fetch
- `cursor` (optional, default: "now"): Horizon API cursor for pagination

**Response:**

```json
{
  "success": true,
  "tips": [
    {
      "id": "124801847226368001",
      "sender": "GBSENDER123...XYZ",
      "senderUsername": "alice_viewer",
      "amount": "10.0000000",
      "asset": "XLM",
      "txHash": "abc123def456...",
      "timestamp": "2026-02-16T10:30:45Z",
      "explorerUrl": "https://stellarexpert.io/explorer/public/tx/abc123def456"
    }
  ],
  "totalReceived": "1250.50",
  "totalCount": 47,
  "nextCursor": "124801847226368001"
}
```

**Implementation:**

1. Get `username` from URL param
2. Query `users` table to get creator's `wallet` (Stellar public key)
3. Call Horizon API: `GET https://horizon.stellar.org/accounts/{wallet}/payments`
4. Filter results where `type === 'payment'` and `asset_type === 'native'` (XLM)
5. For each payment, check if sender has a StreamFi account (lookup by wallet)
6. Return formatted tip list

---

#### `POST /api/tips/refresh-total`

Manually refresh a user's total tips count by querying Horizon API (admin/background job).

**Request:**

```json
{
  "wallet": "GCREATOR123...ABC"
}
```

**Response:**

```json
{
  "success": true,
  "wallet": "GCREATOR123...ABC",
  "totalTipsReceived": "1250.50",
  "totalTipsCount": 47,
  "lastTipAt": "2026-02-16T10:30:45Z"
}
```

**Implementation:**

1. Query Horizon API for all payments to this wallet
2. Sum amounts where `asset_type === 'native'`
3. Update `users.total_tips_received`, `users.total_tips_count`, `users.last_tip_at`
4. Return updated totals

---

### Modified API Routes

#### `GET /api/users/[username]`

**Add to response:**

```json
{
  "user": {
    "username": "johndoe",
    "wallet": "GCREATOR123...ABC",
    "totalTipsReceived": "1250.50",
    "totalTipsCount": 47,
    "lastTipAt": "2026-02-16T10:30:45Z"
  }
}
```

---

## Frontend Components

### 1. `TipButton.tsx`

**Purpose:** Trigger tip action from stream page

**Props:**

```typescript
interface TipButtonProps {
  creatorUsername: string;
  creatorWallet: string;
  disabled?: boolean;
}
```

**Behavior:**

- Renders a "💰 Tip" button
- Opens `TipModal` on click
- Disabled if viewer's wallet not connected
- Shows tooltip: "Connect wallet to tip"

---

### 2. `TipModal.tsx`

**Purpose:** Amount input and transaction initiation

**Props:**

```typescript
interface TipModalProps {
  isOpen: boolean;
  onClose: () => void;
  creatorUsername: string;
  creatorWallet: string;
  viewerWallet: string;
}
```

**State:**

```typescript
const [amount, setAmount] = useState<string>("");
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [txHash, setTxHash] = useState<string | null>(null);
```

**UI Elements:**

- Input field: "Enter amount (XLM)"
- Quick amount buttons: [5 XLM] [10 XLM] [25 XLM] [50 XLM]
- "Send Tip" button (primary action)
- Cancel button
- Error message display
- Success confirmation with Stellar explorer link

**Flow:**

1. User enters amount
2. Validates: amount > 0, amount <= viewer's balance
3. Calls `buildTipTransaction()` from `lib/stellar/payments.ts`
4. Calls `kit.signTransaction()`
5. Submits to Stellar via `server.submitTransaction()`
6. Displays confirmation or error

---

### 3. `TipConfirmation.tsx`

**Purpose:** Success/error state after tip submission

**Props:**

```typescript
interface TipConfirmationProps {
  status: "success" | "error";
  txHash?: string;
  amount?: string;
  error?: string;
  creatorUsername: string;
}
```

**Success UI:**

```
✅ Tip sent successfully!

You tipped @johndoe 10 XLM

[View on Stellar Explorer →]
```

**Error UI:**

```
❌ Tip failed

Error: Insufficient balance

[Try Again]
```

---

### 4. `TipHistory.tsx`

**Purpose:** Display tip list on creator dashboard

**Props:**

```typescript
interface TipHistoryProps {
  creatorWallet: string;
  limit?: number;
}
```

**Data Source:**

- Fetches from `/api/tips/[username]`
- Displays list of tips with: sender, amount, timestamp, tx link
- Pagination via cursor

**UI:**

```
┌──────────────────────────────────────────────────┐
│ Tips Received                                    │
├──────────────────────────────────────────────────┤
│ @alice_viewer tipped 10 XLM   2 hours ago       │
│ [View Transaction →]                             │
├──────────────────────────────────────────────────┤
│ GBOB123...XYZ tipped 5 XLM    5 hours ago        │
│ [View Transaction →]                             │
├──────────────────────────────────────────────────┤
│ Total: 1250.50 XLM (47 tips)                     │
└──────────────────────────────────────────────────┘
```

---

### 5. `TipCounter.tsx`

**Purpose:** Display total tips on stream page or profile

**Props:**

```typescript
interface TipCounterProps {
  totalTipsReceived: string;
  totalTipsCount: number;
}
```

**UI:**

```
💰 1,250.50 XLM
47 tips
```

---

## Stellar Integration

### Payment Transaction Builder

**File:** `lib/stellar/payments.ts`

```typescript
import {
  Server,
  TransactionBuilder,
  Networks,
  Operation,
  Asset,
  Keypair,
  BASE_FEE,
} from "@stellar/stellar-sdk";

interface BuildTipTransactionParams {
  sourcePublicKey: string; // Viewer's wallet
  destinationPublicKey: string; // Creator's wallet
  amount: string; // XLM amount (e.g., "10")
  network: "testnet" | "mainnet";
}

export async function buildTipTransaction(params: BuildTipTransactionParams) {
  // 1. Select Horizon server
  const server =
    params.network === "testnet"
      ? new Server("https://horizon-testnet.stellar.org")
      : new Server("https://horizon.stellar.org");

  // 2. Load source account
  const sourceAccount = await server.loadAccount(params.sourcePublicKey);

  // 3. Build transaction
  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase:
      params.network === "testnet" ? Networks.TESTNET : Networks.PUBLIC,
  })
    .addOperation(
      Operation.payment({
        destination: params.destinationPublicKey,
        asset: Asset.native(), // XLM
        amount: params.amount,
      })
    )
    .setTimeout(30) // 30 second timeout
    .addMemo(Memo.text("StreamFi Tip")) // Optional memo
    .build();

  return transaction;
}

export async function submitTransaction(
  transaction: Transaction,
  network: "testnet" | "mainnet"
) {
  const server =
    network === "testnet"
      ? new Server("https://horizon-testnet.stellar.org")
      : new Server("https://horizon.stellar.org");

  try {
    const result = await server.submitTransaction(transaction);
    return {
      success: true,
      hash: result.hash,
      ledger: result.ledger,
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.extras?.result_codes || error.message,
    };
  }
}
```

---

### Horizon API Client

**File:** `lib/stellar/horizon.ts`

```typescript
import { Server } from "@stellar/stellar-sdk";

interface FetchPaymentsParams {
  publicKey: string;
  limit?: number;
  cursor?: string;
  network: "testnet" | "mainnet";
}

export async function fetchPaymentsReceived(params: FetchPaymentsParams) {
  const server =
    params.network === "testnet"
      ? new Server("https://horizon-testnet.stellar.org")
      : new Server("https://horizon.stellar.org");

  const payments = await server
    .payments()
    .forAccount(params.publicKey)
    .limit(params.limit || 20)
    .cursor(params.cursor || "now")
    .order("desc")
    .call();

  // Filter only incoming payments with XLM
  const tips = payments.records
    .filter((payment: any) => {
      return (
        payment.type === "payment" &&
        payment.to === params.publicKey &&
        payment.asset_type === "native"
      );
    })
    .map((payment: any) => ({
      id: payment.id,
      sender: payment.from,
      amount: payment.amount,
      asset: "XLM",
      txHash: payment.transaction_hash,
      timestamp: payment.created_at,
      ledger: payment.ledger,
    }));

  return {
    tips,
    nextCursor: payments.records[payments.records.length - 1]?.paging_token,
  };
}
```

---

## Implementation Plan

### Phase 1: Core Tipping (Week 1)

**Day 1-2: Stellar Payment Infrastructure**

- [ ] Create `lib/stellar/payments.ts` - Transaction builder
- [ ] Create `lib/stellar/horizon.ts` - Horizon API client
- [ ] Add network config: `NEXT_PUBLIC_STELLAR_NETWORK` env var
- [ ] Test transaction building on Stellar Testnet

**Day 3-4: Frontend Components**

- [ ] Build `TipButton.tsx` component
- [ ] Build `TipModal.tsx` with amount input
- [ ] Build `TipConfirmation.tsx` success/error states
- [ ] Integrate with `StellarWalletContext` for signing

**Day 5: Integration**

- [ ] Add `TipButton` to stream pages (`app/stream/[username]/page.tsx`)
- [ ] Wire up transaction flow: build → sign → submit
- [ ] Test end-to-end on Testnet with Freighter wallet

---

### Phase 2: Tip History (Week 2)

**Day 1-2: API Routes**

- [ ] Create `GET /api/tips/[username]` - Fetch tips from Horizon
- [ ] Create `POST /api/tips/refresh-total` - Update cached totals
- [ ] Add `total_tips_received`, `total_tips_count`, `last_tip_at` columns to `users` table

**Day 3-4: Dashboard Integration**

- [ ] Build `TipHistory.tsx` component
- [ ] Build `TipCounter.tsx` component
- [ ] Add tip history to creator dashboard (`app/dashboard/home/page.tsx`)
- [ ] Add tip counter to stream pages

**Day 5: Testing & Polish**

- [ ] Test pagination with cursor
- [ ] Test with multiple wallets (Freighter, xBull, Albedo)
- [ ] Error handling: insufficient balance, network errors, user rejection
- [ ] Loading states and skeletons

---

### Phase 3: Production Deployment (Week 3)

**Day 1-2: Mainnet Preparation**

- [ ] Switch from Testnet to Mainnet
- [ ] Update Horizon API endpoints to production
- [ ] Test with real XLM (small amounts)
- [ ] Set up Stellar account monitoring (optional)

**Day 3-4: UX Polish**

- [ ] Add animations to tip confirmation
- [ ] Add sound effects (optional)
- [ ] Add tip leaderboard (top tippers)
- [ ] Add "Recent tips" feed on stream page

**Day 5: Launch**

- [ ] Deploy to production
- [ ] Monitor Stellar transactions
- [ ] Gather user feedback

---

## Security Considerations

### 1. Transaction Signing

**✅ Secure:**

- All transactions signed client-side in user's wallet (Freighter/xBull/Albedo)
- StreamFi **never** has access to private keys
- Users approve each transaction explicitly

**⚠️ Risk:** User sends tip to wrong address
**Mitigation:** Display creator's username and wallet address in confirmation modal

---

### 2. Amount Validation

**Frontend Validation:**

- Amount > 0
- Amount is numeric
- Amount has max 7 decimal places (Stellar precision)

**Backend Validation:**

- None needed (Stellar network validates)

**⚠️ Risk:** User sends more XLM than intended
**Mitigation:** Confirmation step shows exact amount before signing

---

### 3. Wallet Address Validation

**✅ Implemented:**

- `isValidStellarAddress()` validates all wallet addresses using `StrKey.isValidEd25519PublicKey()`
- Frontend validates before building transaction
- API validates creator's wallet exists in database

---

### 4. Rate Limiting

**⚠️ Risk:** User spams tip transactions
**Mitigation:**

- Frontend: Disable button during transaction submission
- Stellar network: Inherent rate limit (1 tx per ledger ~5 seconds per account)

---

### 5. Horizon API Abuse

**⚠️ Risk:** Excessive Horizon API calls (tip history fetches)
**Mitigation:**

- Client-side caching with React Query (5-minute cache)
- Cursor-based pagination (don't refetch all history)
- Optional: Add backend caching with `tip_cache` table

---

## Testing Strategy

### Unit Tests

**Files to test:**

- `lib/stellar/payments.ts`
  - `buildTipTransaction()` - Verify transaction structure
  - `submitTransaction()` - Mock Horizon API responses
- `lib/stellar/horizon.ts`
  - `fetchPaymentsReceived()` - Mock Horizon payment records
- `utils/stellar.ts`
  - `isValidStellarAddress()` - Test valid/invalid addresses

**Framework:** Jest + Testing Library

---

### Integration Tests

**Scenarios:**

1. **Happy path:**
   - User connects wallet → clicks tip → enters amount → approves → transaction succeeds
2. **Error: Insufficient balance:**
   - User tries to tip more XLM than they have → Stellar rejects → error shown
3. **Error: User rejects signature:**
   - User clicks tip → modal opens → user closes wallet popup → error shown
4. **Tip history:**
   - Creator has 0 tips → shows empty state
   - Creator has 50 tips → shows paginated list

---

### Manual Testing Checklist

**Testnet Testing:**

- [ ] Tip 1 XLM from Account A to Account B
- [ ] Verify transaction on Stellar Expert (Testnet)
- [ ] Check tip appears in Account B's tip history
- [ ] Verify `total_tips_received` increments in database
- [ ] Test with Freighter wallet
- [ ] Test with xBull wallet
- [ ] Test with Albedo wallet
- [ ] Test insufficient balance error
- [ ] Test network timeout error
- [ ] Test user rejection (close wallet popup)

**Mainnet Testing (Small Amounts):**

- [ ] Tip 0.1 XLM on Mainnet
- [ ] Verify transaction on Stellar Expert (Mainnet)
- [ ] Monitor Horizon API response times

---

## Future Enhancements

### Phase 2 Features (Post-MVP)

1. **Stablecoin Support (USDC)**
   - Add USDC asset option in tip modal
   - Handle trustline setup (user must trust USDC issuer)
   - Display "Tip $5 USDC" instead of XLM volatility

2. **Platform Fee (Optional)**
   - Implement via Soroban smart contract
   - Split tips: 95% creator, 5% StreamFi
   - Requires contract deployment and testing

3. **Backend Caching**
   - Implement `tip_cache` table
   - Run background job to sync Horizon API → database
   - Faster dashboard load times

4. **Tip Leaderboards**
   - Top tippers (all-time, weekly, per stream)
   - Display on stream page

5. **Tip Goals**
   - Creator sets goal: "Help me reach 1000 XLM!"
   - Progress bar on stream page

6. **Tip Animations**
   - On-screen notification when tip received
   - Sound effects
   - Confetti animation for large tips

7. **Recurring Tips**
   - "Subscribe with 10 XLM/month"
   - Implemented via Soroban time-lock contracts

8. **Tip Refunds (Escrow)**
   - Tips held in smart contract for 24 hours
   - Allow refunds if stream quality issues
   - Requires Soroban contract

---

## Environment Variables

### Required for MVP

```bash
# Stellar Network Configuration
NEXT_PUBLIC_STELLAR_NETWORK=testnet  # or "mainnet"

# Existing (from migration)
NEXT_PUBLIC_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
```

### Optional

```bash
# Stellar Expert Explorer URL (for transaction links)
NEXT_PUBLIC_STELLAR_EXPLORER_URL=https://stellarexpert.io/explorer/testnet

# Horizon API Rate Limit (requests per second)
STELLAR_HORIZON_RATE_LIMIT=10
```

---

## Success Metrics

### MVP Launch Goals (Week 1)

- [ ] 10+ successful tip transactions on Mainnet
- [ ] 0 failed transactions due to frontend bugs
- [ ] < 5 second tip confirmation time (Stellar network average)
- [ ] 100% of tips visible in creator dashboard

### Week 2-4 Goals

- [ ] 100+ tips sent
- [ ] 50+ unique tippers
- [ ] Average tip size: 5-10 XLM
- [ ] < 1% error rate (user rejections don't count as errors)

---

## Rollout Plan

### Week 1: Testnet Beta

- Deploy to staging environment
- Invite 10 beta testers (5 creators, 5 viewers)
- Provide Testnet XLM for testing
- Collect feedback on UX

### Week 2: Mainnet Soft Launch

- Deploy to production with "Beta" label
- Announce in Discord/Twitter
- Monitor Stellar transactions via Horizon API
- Hot-fix any critical bugs

### Week 3: Full Launch

- Remove "Beta" label
- Marketing campaign
- Add tip button to all stream pages
- Monitor usage metrics

---

## Appendix

### Stellar Resources

- [Stellar SDK Documentation](https://stellar.github.io/js-stellar-sdk/)
- [Horizon API Reference](https://developers.stellar.org/api/horizon)
- [Send and Receive Payments Guide](https://developers.stellar.org/docs/build/guides/transactions/send-and-receive-payments)
- [Stellar Expert Explorer (Testnet)](https://stellarexpert.io/explorer/testnet)
- [Stellar Expert Explorer (Mainnet)](https://stellarexpert.io/explorer/public)

### Stellar Testnet Faucet

https://friendbot.stellar.org

### Stellar Wallets

- [Freighter](https://www.freighter.app/)
- [xBull](https://xbull.app/)
- [Albedo](https://albedo.link/)

---

## Questions & Decisions

### Open Questions

1. **Should we support custom memos?**
   - Pro: Users can add personal messages with tips
   - Con: Increases UI complexity
   - **Decision:** Not for MVP, add in Phase 2

2. **Should we cache tips in database or query Horizon on-demand?**
   - **Decision:** Query on-demand for MVP, add caching if performance issues

3. **Should we show anonymous tips (sender not a StreamFi user)?**
   - **Decision:** Yes, show wallet address only (no username)

4. **Should we support tipping in the middle of a stream vs. only during live?**
   - **Decision:** Allow tips anytime (live or VOD)

---

**Document Version:** 1.0
**Last Updated:** February 16, 2026
**Next Review:** After MVP launch (Week 4)
