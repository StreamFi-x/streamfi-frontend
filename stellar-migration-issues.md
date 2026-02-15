# Stellar Migration Issues

> **Migration: StarkNet → Stellar Wallet Authentication**
>
> This document outlines all the issues needed to migrate StreamFi's wallet authentication from StarkNet (`@starknet-react/core`) to Stellar (`@creit-tech/stellar-wallets-kit` + `@stellar/stellar-sdk`). Issues are ordered by implementation dependency — each phase builds on the previous one.
>
> **Current StarkNet footprint:** 20 files, 4 npm packages, 10+ API routes, 7 UI components

---

## Phase 1: Foundation

These issues set up the new Stellar infrastructure. Nothing else can proceed until these are done.

---

### Issue #1 — Install Stellar SDK packages and remove StarkNet dependencies

**Labels:** `migration`, `setup`, `stellar`

**Description:**

Replace all StarkNet npm packages with their Stellar equivalents. This is the first step — no code changes yet, just dependency swaps.

**Current StarkNet packages to remove:**

```
@starknet-react/chains: ^3.1.2
@starknet-react/core: ^3.7.2
@starknet-react/typescript-config: ^0.0.1
starknet: ^6.24.1
```

**Stellar packages to install:**

```
@creit-tech/stellar-wallets-kit   — Wallet connection kit (supports Freighter, Lobstr, xBull, Albedo, Hana, Hot Wallet, etc.)
@stellar/stellar-sdk              — Core Stellar SDK for address validation, key handling, and network interaction
@stellar/freighter-api            — Freighter browser wallet API (most popular Stellar wallet)
```

**Acceptance criteria:**

- [ ] All 4 StarkNet packages removed from `package.json`
- [ ] All 3 Stellar packages installed and listed in `package.json`
- [ ] `npm install` runs without errors
- [ ] No StarkNet imports exist in `package.json` (devDependencies included)
- [ ] Build will fail at this point (expected) — do NOT attempt to fix imports yet

**Files affected:**

- `package.json`

---

### Issue #2 — Create Stellar Wallet Provider to replace StarknetConfig

**Labels:** `migration`, `core`, `stellar`

**Description:**

Replace the `StarknetConfig` provider in `components/providers.tsx` with a Stellar Wallets Kit initialization. The current provider wraps the entire app with StarkNet chain config, connectors (Argent, Braavos), and auto-connect. We need the Stellar equivalent.

**Current implementation (`components/providers.tsx`):**

```tsx
import { sepolia, mainnet } from "@starknet-react/chains";
import {
  StarknetConfig,
  publicProvider,
  argent,
  braavos,
  useInjectedConnectors,
  voyager,
} from "@starknet-react/core";

export function Providers({ children }) {
  const { connectors } = useInjectedConnectors({
    recommended: [argent(), braavos()],
    includeRecommended: "always",
    order: "alphabetical",
  });

  return (
    <StarknetConfig
      chains={[mainnet, sepolia]}
      provider={publicProvider()}
      connectors={connectors}
      explorer={voyager}
      autoConnect={true}
    >
      <ThemeProvider>
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    </StarknetConfig>
  );
}
```

**What needs to happen:**

1. Remove all `@starknet-react` imports
2. Initialize `StellarWalletsKit` with `defaultModules()` — this gives us Freighter, xBull, Albedo, Lobstr, etc.
3. Configure for the appropriate Stellar network (Testnet for dev, Mainnet/Pubnet for production)
4. Create a React Context (`StellarWalletContext`) to expose the kit instance to child components — since Stellar Wallets Kit is framework-agnostic, we need our own context wrapper
5. The context should expose: `kit` (the StellarWalletsKit instance), `publicKey` (connected address or null), `isConnected` (boolean), `connect()`, `disconnect()`, and `network`
6. Keep `ThemeProvider` and `AuthProvider` nesting intact

**Acceptance criteria:**

- [ ] `StarknetConfig` completely removed from `providers.tsx`
- [ ] `StellarWalletProvider` context created and wraps the app
- [ ] Stellar Wallets Kit initialized with default modules (Freighter, xBull, Albedo, Lobstr, etc.)
- [ ] Network configurable via environment variable (e.g., `NEXT_PUBLIC_STELLAR_NETWORK=testnet`)
- [ ] Context provides: `kit`, `publicKey`, `isConnected`, `connect()`, `disconnect()`, `network`
- [ ] Provider hierarchy remains: `StellarWalletProvider > ThemeProvider > AuthProvider > children`

**Files affected:**

- `components/providers.tsx` (major rewrite)
- New file: `contexts/stellar-wallet-context.tsx` (new context)

---

### Issue #3 — Build new Connect Wallet modal for Stellar wallets

**Labels:** `migration`, `ui`, `stellar`

**Description:**

Replace `components/connectWallet.tsx` which currently renders StarkNet connectors (Argent, Braavos, and injected wallets) with a Stellar wallet connection modal. The UI pattern stays the same (modal with wallet options), but the wallets and connection logic change completely.

**Current implementation (`components/connectWallet.tsx`):**

- Uses `useConnect()` and `useAccount()` from `@starknet-react/core`
- Lists available StarkNet connectors with their icons
- Calls `connect({ connector: wallet })` on click
- Auto-closes modal on successful connection
- Handles connecting/disconnected states

**What needs to happen:**

1. Replace `useConnect` / `useAccount` with the `StellarWalletContext` from Issue #2
2. Use `StellarWalletsKit` built-in modal via `kit.openModal()`, **OR** build a custom modal that lists available Stellar wallets (Freighter, xBull, Albedo, Lobstr, etc.)
3. On wallet selection, call `kit.setWallet(walletId)` then `kit.getAddress()` to get the public key
4. Update connection state via context
5. Handle wallet-not-installed states (e.g., Freighter extension not installed — show install link)
6. Keep the same modal UI pattern (overlay, wallet list, close button) for design consistency

**Stellar wallets to support (via defaultModules):**

- Freighter (browser extension — most popular)
- xBull (browser extension + PWA)
- Albedo (web-based, no install needed)
- Lobstr (mobile + web)
- Hana, Hot Wallet, etc. (via default modules)

**Acceptance criteria:**

- [ ] No `@starknet-react` imports in `connectWallet.tsx`
- [ ] Modal displays available Stellar wallets with icons/names
- [ ] Clicking a wallet triggers connection flow and retrieves public key
- [ ] Modal auto-closes on successful connection
- [ ] Loading/connecting state shown during connection
- [ ] Error state shown if connection fails
- [ ] Wallet-not-installed state handled gracefully (install link)
- [ ] Works with `StellarWalletContext` from Issue #2

**Files affected:**

- `components/connectWallet.tsx` (major rewrite)

---

## Phase 2: Core Auth

These issues migrate the authentication and session management logic. Depends on Phase 1.

---

### Issue #4 — Migrate AuthProvider from StarkNet to Stellar

**Labels:** `migration`, `core`, `auth`, `stellar`

**Description:**

This is the biggest single issue. `components/auth/auth-provider.tsx` (~450 lines) is the heart of the auth system. It uses three StarkNet hooks (`useAccount`, `useDisconnect`, `useConnect`) and manages wallet sessions, auto-connect, user data fetching, and logout. All of this needs to migrate to Stellar.

**Current StarkNet hooks used:**

```tsx
import { useAccount, useDisconnect, useConnect } from "@starknet-react/core";

const { address, isConnected, status } = useAccount();
const { disconnect } = useDisconnect();
const { status: connectStatus } = useConnect();
```

**What needs to happen:**

1. Replace all `@starknet-react/core` imports with `StellarWalletContext` from Issue #2
2. Replace `useAccount()` → use `publicKey` and `isConnected` from Stellar context
3. Replace `useDisconnect()` → use `disconnect()` from Stellar context
4. Replace `useConnect()` status → use connection state from Stellar context
5. Update `address` references → `publicKey` (Stellar public keys are 56-char strings starting with `G`, not hex addresses)
6. Update `fetchUserData()` — currently calls `/api/users/wallet/${walletAddress}` — keep same pattern but with Stellar public key
7. Update `storeWalletConnection()` — currently stores `starknet_last_wallet` and `starknet_auto_connect` in localStorage. Rename these keys (see Issue #6)
8. Update `handleWalletChange()` — currently listens to `useAccount` status changes. Replace with Stellar wallet state changes from context
9. Update auto-connect logic — check if Stellar wallet was previously connected and reconnect
10. Keep session management logic intact (24hr timeout, 30min refresh, activity tracking) — this is wallet-agnostic
11. Update the `x-wallet-address` header sent in API calls to use Stellar public key

**Key storage keys to update (full list in Issue #6):**

- `starknet_last_wallet` → `stellar_last_wallet`
- `starknet_auto_connect` → `stellar_auto_connect`
- `wallet` key values change from StarkNet hex → Stellar G-address

**Acceptance criteria:**

- [ ] Zero `@starknet-react` imports in `auth-provider.tsx`
- [ ] Uses `StellarWalletContext` for all wallet state
- [ ] `fetchUserData()` works with Stellar public key
- [ ] Auto-connect works for returning users
- [ ] Logout fully clears Stellar wallet state
- [ ] Session timeout/refresh logic unchanged
- [ ] `x-wallet-address` header sends Stellar public key
- [ ] `AuthContextType` interface updated — `isWalletConnecting` still works

**Files affected:**

- `components/auth/auth-provider.tsx` (major rewrite)

---

### Issue #5 — Update ProtectedRoute for Stellar wallet checks

**Labels:** `migration`, `auth`, `stellar`

**Description:**

`components/auth/ProtectedRoute.tsx` gates dashboard and settings pages behind wallet connection. It currently uses `useAccount()` from StarkNet and checks `starknet_auto_connect` / `starknet_last_wallet` in localStorage for auto-connect detection.

**Current StarkNet usage:**

```tsx
import { useAccount } from "@starknet-react/core";
const { address, isConnected, status } = useAccount();

// Auto-connect detection
const autoConnect = localStorage.getItem("starknet_auto_connect");
const lastWallet = localStorage.getItem("starknet_last_wallet");
```

**What needs to happen:**

1. Replace `useAccount()` with `StellarWalletContext`
2. Use `publicKey` and `isConnected` from Stellar context instead of `address` and `isConnected`
3. Update localStorage key checks: `starknet_auto_connect` → `stellar_auto_connect`, `starknet_last_wallet` → `stellar_last_wallet`
4. Keep the same UX: show loading during auto-connect attempt (3s timeout), show `ConnectWalletModal` if not connected, redirect to `/explore` on dismissal

**Acceptance criteria:**

- [ ] No `@starknet-react` imports in `ProtectedRoute.tsx`
- [ ] Uses Stellar wallet context for connection state
- [ ] Auto-connect detection uses new `stellar_*` localStorage keys
- [ ] Protected routes still require wallet connection to access
- [ ] `ConnectWalletModal` shown when wallet not connected
- [ ] Redirect to `/explore` on modal dismissal works

**Files affected:**

- `components/auth/ProtectedRoute.tsx`

---

### Issue #6 — Migrate session storage keys from `starknet_*` to `stellar_*`

**Labels:** `migration`, `auth`, `stellar`

**Description:**

The auth system uses several localStorage/sessionStorage/cookie keys prefixed with `starknet_`. These need to be renamed for Stellar. This issue also serves as a reference for all storage keys across the app.

**Keys to rename:**

| Current Key             | New Key                | Storage      | Location                                  |
| ----------------------- | ---------------------- | ------------ | ----------------------------------------- |
| `starknet_last_wallet`  | `stellar_last_wallet`  | localStorage | `auth-provider.tsx`, `ProtectedRoute.tsx` |
| `starknet_auto_connect` | `stellar_auto_connect` | localStorage | `auth-provider.tsx`, `ProtectedRoute.tsx` |

**Keys that stay the same (wallet-agnostic):**

| Key                               | Storage                              | Notes                                                |
| --------------------------------- | ------------------------------------ | ---------------------------------------------------- |
| `wallet`                          | localStorage, sessionStorage, cookie | Value changes from StarkNet hex to Stellar G-address |
| `user_${walletAddress}`           | localStorage                         | Key includes wallet address — format changes         |
| `user_timestamp_${walletAddress}` | localStorage                         | Key includes wallet address — format changes         |
| `userData`                        | sessionStorage                       | Value contains wallet field — format changes         |
| `username`                        | sessionStorage                       | No change needed                                     |

**What needs to happen:**

1. Find-and-replace `starknet_last_wallet` → `stellar_last_wallet` across all files
2. Find-and-replace `starknet_auto_connect` → `stellar_auto_connect` across all files
3. Ensure the `wallet` cookie/storage values now store Stellar public keys (56-char `G...` format)
4. Consider adding a one-time migration helper that clears old `starknet_*` keys from returning users' browsers (optional but nice-to-have)

**Acceptance criteria:**

- [ ] No `starknet_` prefixed keys anywhere in the codebase
- [ ] All renamed keys work correctly for auto-connect and session persistence
- [ ] Returning users with old `starknet_*` keys don't get stuck in broken state (keys are simply ignored/cleared)

**Files affected:**

- `components/auth/auth-provider.tsx`
- `components/auth/ProtectedRoute.tsx`

**Note:** This issue can be done as part of Issue #4 and #5 if preferred, but is listed separately for tracking clarity.

---

## Phase 3: UI Components

These issues update all UI components that directly use StarkNet hooks. Depends on Phase 1 + Phase 2.

---

### Issue #7 — Update Navbar wallet integration

**Labels:** `migration`, `ui`, `stellar`

**Description:**

`components/explore/Navbar.tsx` uses `useAccount` and `useDisconnect` from StarkNet to show/hide the connect button, display the connected address, and handle disconnect.

**Current StarkNet usage:**

```tsx
import { useAccount, useDisconnect } from "@starknet-react/core";
const { address, isConnected } = useAccount();
const { disconnect } = useDisconnect();
```

**What needs to happen:**

1. Replace `useAccount` and `useDisconnect` with `StellarWalletContext`
2. Replace `address` with `publicKey` from Stellar context
3. Replace `disconnect()` with Stellar context's `disconnect()`
4. Update address display — StarkNet addresses are shortened hex (`0x1234...abcd`), Stellar public keys are `G...` format. Update the shortening logic accordingly (e.g., `GABCD...WXYZ`)
5. Update the `/api/users/wallet/${address}` call to use Stellar public key
6. Update sessionStorage writes to store Stellar public key

**Acceptance criteria:**

- [ ] No `@starknet-react` imports in `Navbar.tsx`
- [ ] Connect/disconnect works with Stellar wallet
- [ ] Connected address displays correctly (shortened Stellar G-address)
- [ ] Profile data fetch works with Stellar public key
- [ ] Session storage updated correctly on connect

**Files affected:**

- `components/explore/Navbar.tsx`

---

### Issue #8 — Update ProfileModal registration flow for Stellar

**Labels:** `migration`, `ui`, `auth`, `stellar`

**Description:**

`components/explore/ProfileModal.tsx` uses `useAccount` to get the connected wallet address and passes it to the `/api/users/register` endpoint during new user registration.

**Current StarkNet usage:**

```tsx
import { useAccount } from "@starknet-react/core";
const { address } = useAccount();

// In registration payload:
{
  wallet: (address, username, email);
}
```

**What needs to happen:**

1. Replace `useAccount` with `StellarWalletContext`
2. Use `publicKey` instead of `address` in the registration payload
3. Update localStorage/sessionStorage writes to use Stellar public key
4. Registration payload `wallet` field will now contain a Stellar G-address instead of a StarkNet hex address

**Acceptance criteria:**

- [ ] No `@starknet-react` imports in `ProfileModal.tsx`
- [ ] Registration sends Stellar public key as `wallet`
- [ ] Session/local storage updated with Stellar public key on registration success
- [ ] Registration flow works end-to-end with Stellar wallet

**Files affected:**

- `components/explore/ProfileModal.tsx`

---

### Issue #9 — Update Quick Actions component

**Labels:** `migration`, `ui`, `stellar`

**Description:**

`components/explore/quick-actions.tsx` uses `useAccount` to check connection state and fetch user profile data.

**Current StarkNet usage:**

```tsx
import { useAccount } from "@starknet-react/core";
const { address, isConnected } = useAccount();
// Fetches: /api/users/wallet/${address}
```

**What needs to happen:**

1. Replace `useAccount` with `StellarWalletContext`
2. Use `publicKey` and `isConnected` from Stellar context
3. Update the `/api/users/wallet/${address}` call to use Stellar public key
4. Keep same conditional rendering logic (profile action vs connect action)

**Acceptance criteria:**

- [ ] No `@starknet-react` imports in `quick-actions.tsx`
- [ ] Connection state check uses Stellar context
- [ ] User profile fetch works with Stellar public key
- [ ] Conditional rendering (connected vs disconnected) works correctly

**Files affected:**

- `components/explore/quick-actions.tsx`

---

### Issue #10 — Update Profile Dropdown disconnect logic

**Labels:** `migration`, `ui`, `stellar`

**Description:**

`components/ui/profileDropdown.tsx` uses `useAccount` and `useDisconnect` from StarkNet to show connection status and provide a disconnect action.

**Current StarkNet usage:**

```tsx
import { useAccount, useDisconnect } from "@starknet-react/core";
const { disconnect } = useDisconnect();
const { isConnected } = useAccount();
```

**What needs to happen:**

1. Replace both hooks with `StellarWalletContext`
2. Use context's `disconnect()` and `isConnected`
3. Keep same UI behavior (disconnect menu item)

**Acceptance criteria:**

- [ ] No `@starknet-react` imports in `profileDropdown.tsx`
- [ ] Disconnect action works with Stellar wallet
- [ ] Connection state reflected correctly in dropdown

**Files affected:**

- `components/ui/profileDropdown.tsx`

---

### Issue #11 — Update useProfileModal hook

**Labels:** `migration`, `hooks`, `stellar`

**Description:**

`hooks/useProfileModal.ts` uses `useAccount` to get the wallet address for the registration form.

**Current StarkNet usage:**

```tsx
import { useAccount } from "@starknet-react/core";
const { address } = useAccount();
// Uses address in registration payload and storage
```

**What needs to happen:**

1. Replace `useAccount` with `StellarWalletContext`
2. Use `publicKey` instead of `address`
3. Update registration payload and storage writes

**Acceptance criteria:**

- [ ] No `@starknet-react` imports in `useProfileModal.ts`
- [ ] Uses Stellar public key for registration
- [ ] Storage writes use Stellar public key

**Files affected:**

- `hooks/useProfileModal.ts`

---

## Phase 4: Data Layer

These issues update the backend (API routes, database, types) to handle Stellar addresses. Can be done in parallel with Phase 3.

---

### Issue #12 — Update User type definitions for Stellar addresses

**Labels:** `migration`, `types`, `stellar`

**Description:**

Update TypeScript interfaces in `types/user.ts` to reflect Stellar address format. While the field name `wallet` stays the same, we should add documentation and optionally a branded type to make it clear this is now a Stellar public key.

**Current types:**

```typescript
interface User {
  wallet: string; // Was StarkNet hex address (0x...)
}
```

**What needs to happen:**

1. Update `User` interface — add JSDoc comment clarifying `wallet` is now a Stellar public key (`G...`, 56 characters)
2. Update `UserRegistrationInput` — same documentation
3. Update `UserUpdateInput` — same documentation
4. Optionally add a `StellarPublicKey` type alias: `type StellarPublicKey = string` for stronger typing
5. Review any other types in `types/` that reference wallet addresses

**Acceptance criteria:**

- [ ] `types/user.ts` updated with Stellar address documentation
- [ ] No references to StarkNet address format in type definitions
- [ ] All wallet-related types consistently documented

**Files affected:**

- `types/user.ts`
- Any other files in `types/` that reference wallet

---

### Issue #13 — Update API routes for Stellar wallet address format

**Labels:** `migration`, `api`, `stellar`

**Description:**

10+ API routes use `wallet` as a parameter (URL path, query string, or request body). While the field name `wallet` doesn't change, we should add Stellar-specific validation since address formats differ:

- **StarkNet** (old): Hex string, variable length, starts with `0x` (e.g., `0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7`)
- **Stellar** (new): Base32-encoded, exactly 56 characters, starts with `G` (e.g., `GBCEHJ...XYZ`)

**API routes that need wallet validation updates:**

| Route                         | Method | Wallet Source |
| ----------------------------- | ------ | ------------- |
| `/api/users/wallet/[wallet]`  | GET    | URL param     |
| `/api/users/register`         | POST   | Request body  |
| `/api/users/updates/[wallet]` | PUT    | URL param     |
| `/api/users/follow`           | POST   | Request body  |
| `/api/streams/[wallet]`       | GET    | URL param     |
| `/api/streams/create`         | POST   | Request body  |
| `/api/streams/start`          | POST   | Request body  |
| `/api/streams/update`         | PATCH  | Request body  |
| `/api/streams/delete`         | DELETE | Request body  |
| `/api/streams/delete-get`     | GET    | Query param   |
| `/api/fetch-username`         | GET    | Query param   |
| `/api/debug/user-stream`      | GET    | Query param   |

**What needs to happen:**

1. Add a Stellar address validation utility function:
   ```typescript
   // utils/stellar.ts
   import { StrKey } from "@stellar/stellar-sdk";
   export function isValidStellarAddress(address: string): boolean {
     return StrKey.isValidEd25519PublicKey(address);
   }
   ```
2. Add validation to each API route that accepts a wallet parameter — return 400 if wallet is not a valid Stellar public key
3. Review `LOWER(wallet)` SQL queries — Stellar addresses are case-sensitive (uppercase), so case normalization logic may need updating. Stellar public keys are always uppercase, so `LOWER()` comparisons should be replaced with exact match or the storage should be standardized
4. No column renames needed — `wallet` column name stays the same

**Acceptance criteria:**

- [ ] `utils/stellar.ts` utility created with `isValidStellarAddress()`
- [ ] All 12 API routes validate wallet as valid Stellar public key
- [ ] Invalid wallet addresses return 400 with clear error message
- [ ] SQL queries handle Stellar address format correctly (case sensitivity)
- [ ] Existing wallet queries work with 56-char Stellar public keys

**Files affected:**

- New file: `utils/stellar.ts`
- All 12 API route files listed above

---

### Issue #14 — Update database schema for Stellar public keys

**Labels:** `migration`, `database`, `stellar`

**Description:**

The `users` table stores wallet addresses as `VARCHAR(255)`. While this is large enough for Stellar public keys (56 characters), we should review and update the schema, and plan for data migration if there are existing StarkNet addresses in the database.

**Current schema (from `api/users/register/route.ts`):**

```sql
wallet VARCHAR(255) UNIQUE NOT NULL
```

**What needs to happen:**

1. Review the `wallet` column — `VARCHAR(255)` is fine for Stellar keys (56 chars), no column type change needed
2. **If there is existing user data** with StarkNet addresses: create a migration script or plan to handle these records. Options:
   - Delete test data (if this is pre-production)
   - Add a `wallet_type` column to distinguish old vs new (if backward compatibility needed)
   - Simply document that old StarkNet users will need to re-register
3. Remove any `LOWER(wallet)` SQL comparisons that were StarkNet-specific — Stellar public keys are case-sensitive and always uppercase
4. Update the `setup-db` script (`scripts/setup-db.ts`) if it contains wallet format assumptions
5. Update `scripts/update-schema.ts` if it references wallet format

**Database tables with wallet columns:**

- `users` — `wallet VARCHAR(255) UNIQUE NOT NULL`
- `stream_sessions` — references `user_id`, not wallet directly
- `chat_messages` — references `user_id`, not wallet directly
- `stream_viewers` — references `user_id`, not wallet directly

**Acceptance criteria:**

- [ ] Database schema reviewed for Stellar compatibility
- [ ] `LOWER(wallet)` queries replaced with exact match where appropriate
- [ ] Migration strategy documented for any existing StarkNet user data
- [ ] `setup-db` and `update-schema` scripts updated if needed

**Files affected:**

- `app/api/users/register/route.ts` (table creation)
- `scripts/setup-db.ts`
- `scripts/update-schema.ts`
- All API routes with `LOWER(wallet)` queries

---

## Phase 5: Cleanup and QA

Final sweep to ensure nothing was missed and everything works end-to-end.

---

### Issue #15 — Remove all remaining StarkNet references from codebase

**Labels:** `migration`, `cleanup`, `stellar`

**Description:**

After all previous issues are complete, do a final sweep of the entire codebase to ensure zero StarkNet references remain. This is a safety net to catch anything missed.

**Search for and remove/replace:**

- Any remaining `@starknet-react` imports
- Any remaining `starknet` package imports
- String literals: `"starknet"`, `"StarkNet"`, `"Starknet"`
- localStorage keys: `starknet_*`
- Comments referencing StarkNet
- Any StarkNet-related environment variables
- References to Argent, Braavos, or Voyager (StarkNet-specific wallets/explorer)
- The `@starknet-react/typescript-config` in `tsconfig.json` (if referenced)

**What needs to happen:**

1. Run a global search for `starknet` (case-insensitive) across all files
2. Run a global search for `argent`, `braavos`, `voyager`
3. Review and update any comments or documentation that reference StarkNet
4. Update `README.md` or any docs to reference Stellar instead of StarkNet
5. Verify `package-lock.json` has no StarkNet packages
6. Clean `node_modules` and do a fresh install

**Acceptance criteria:**

- [ ] `grep -ri "starknet" .` returns zero results (excluding node_modules, .git, .next)
- [ ] `grep -ri "argent\|braavos\|voyager" .` returns zero results (excluding node_modules, .git, .next)
- [ ] Fresh `npm install` succeeds
- [ ] `npm run build` succeeds with zero StarkNet-related errors
- [ ] `npm run type-check` passes

**Files potentially affected:**

- Any file missed in previous issues
- `README.md`, `DEVELOPMENT_GUIDELINES.md`
- `tsconfig.json` (if it extends starknet-react config)

---

### Issue #16 — End-to-end testing of Stellar wallet auth flow

**Labels:** `migration`, `testing`, `stellar`, `qa`

**Description:**

Manually test every user flow that involves wallet authentication to verify the Stellar migration is complete and working. Write automated tests where possible.

**Test scenarios:**

**A. First-time user flow:**

1. Visit app without any wallet connected
2. Navigate to `/dashboard` → should show Connect Wallet modal
3. Connect Stellar wallet (Freighter) → modal should close
4. Profile modal should appear for registration
5. Fill in username + email → submit
6. Verify registration succeeds with Stellar public key as wallet
7. Confirm user appears in database with `G...` address
8. Verify email verification flow works

**B. Returning user flow:**

1. Close and reopen browser/tab
2. App should auto-connect to previously connected Stellar wallet
3. User data should load from cache then refresh from API
4. Verify `stellar_auto_connect` and `stellar_last_wallet` in localStorage

**C. Disconnect flow:**

1. Click disconnect in Navbar or Profile Dropdown
2. Wallet should disconnect
3. All session data should clear (localStorage, sessionStorage, cookies)
4. User should redirect to `/` (landing page)
5. Protected routes should show Connect Wallet modal again

**D. Multi-wallet flow:**

1. Connect with Freighter
2. Disconnect
3. Connect with a different Stellar wallet (e.g., Albedo or xBull)
4. Verify new wallet address is used throughout

**E. Protected routes:**

1. `/dashboard/*` — all sub-routes require wallet
2. `/settings/*` — all sub-routes require wallet
3. Verify redirect behavior when wallet disconnects on protected page

**F. API integration:**

1. Create a stream → verify wallet stored correctly
2. Start/stop stream → verify wallet validation works
3. Follow a user → verify wallet used correctly
4. Update profile → verify wallet in payload

**G. Edge cases:**

1. Wallet extension not installed → should show install prompt
2. User rejects connection in wallet → should show error state
3. Network timeout during connection → should handle gracefully
4. Multiple tabs open → session should be consistent

**Acceptance criteria:**

- [ ] All 7 test scenario groups (A-G) pass
- [ ] No console errors related to StarkNet or missing imports
- [ ] No broken UI states during wallet connection/disconnection
- [ ] Session persistence works across page reloads
- [ ] Database records contain valid Stellar public keys
- [ ] Automated tests added for critical paths (connect, disconnect, protected routes)

---

## Implementation Order Summary

```
Phase 1 (Foundation)          Phase 2 (Core Auth)           Phase 3 (UI)              Phase 4 (Data)           Phase 5 (Cleanup)
─────────────────────         ─────────────────────         ────────────────          ────────────────         ────────────────
#1 Install packages     →     #4 AuthProvider          →    #7  Navbar          →                             #15 Remove all refs
#2 Wallet Provider      →     #5 ProtectedRoute        →    #8  ProfileModal                                  #16 E2E Testing
#3 Connect Modal        →     #6 Storage keys          →    #9  Quick Actions
                                                             #10 Profile Dropdown
                                                             #11 useProfileModal
                                                                                       #12 Type defs
                                                                                       #13 API routes
                                                                                       #14 DB schema
```

> **Phase 3 and Phase 4 can run in parallel** — UI components and data layer are independent of each other once Phase 2 is done.

---

## Reference: Stellar SDK Resources

- [Stellar Wallets Kit](https://stellarwalletskit.dev/) — Multi-wallet connection library
- [Stellar SDK Docs](https://stellar.github.io/js-stellar-sdk/) — Core SDK documentation
- [Freighter React Integration](https://developers.stellar.org/docs/build/guides/freighter/integrate-freighter-react) — Freighter wallet guide
- [Stellar Frontend dApp Guide](https://developers.stellar.org/docs/build/guides/dapps/frontend-guide) — Comprehensive frontend guide

---

## Packages Reference

**Remove:**

```
@starknet-react/chains
@starknet-react/core
@starknet-react/typescript-config
starknet
```

**Install:**

```
@creit-tech/stellar-wallets-kit    — Multi-wallet kit (Freighter, xBull, Albedo, Lobstr, etc.)
@stellar/stellar-sdk               — Core SDK (StrKey validation, network interaction)
@stellar/freighter-api             — Freighter-specific API (optional, covered by wallets kit)
```
