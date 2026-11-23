# Wallet Switching Confirmation Dialog - Issue #1696

## Overview

This document describes the need for a confirmation dialog when switching wallets mid-session, protecting users from accidentally losing their Privy identity association.

## Current State - Issue #1696

### Problem Summary

The wallet switching flow (`connect()` in `contexts/stellar-wallet-context.tsx`) has no confirmation:

1. **Silent Identity Loss** - Switching wallets clears Privy sessionStorage without warning
2. **No Undo Available** - Lost Google/email account associations cannot be recovered
3. **Easy Accident** - Creator casually clicking a different wallet loses authentication
4. **Mid-Stream Risk** - Especially dangerous during active broadcast
5. **No Multi-Wallet Support** - App conflates connecting wallet with switching identity

### Current Flow

```typescript
// Current pattern (WRONG - no confirmation)
const connect = async (wallet: string) => {
  // Immediately set new wallet
  await walletKit.setWallet(wallet);
  
  // Immediately clear Privy state
  sessionStorage.removeItem('privy_user');
  sessionStorage.removeItem('privy_session');
  
  // Update app state
  setActivePublicKey(newPublicKey);
  // No warning, no undo, identity lost
};
```

### Risk Scenarios

**Scenario 1: Mid-Stream Creator**
- Streaming to 100 viewers
- Creator curiosity-clicks different wallet button
- Privy identity silently lost
- Chat authentication breaks
- Creator can't access creator features

**Scenario 2: Multiple Account Holder**
- User has account on Wallet A
- User also has separate account on Wallet B
- Switches to Wallet B to check something
- Privy identity lost without knowing
- Can't get back to Wallet A account

**Scenario 3: Testing/Development**
- Creator testing on testnet wallet
- Switches back to mainnet wallet
- Mainnet identity lost
- Lost stream data, followers, tips

## Acceptance Criteria - Issue #1696

From the issue:
> At minimum, selecting a new wallet while already connected to a different one shows a clear confirmation explaining that this will change the active account, before any state is cleared.

**Must Pass:**
- [ ] Confirmation dialog shown when switching wallets
- [ ] Dialog explains account will be changed
- [ ] User can cancel without losing identity
- [ ] User can confirm to proceed with switch
- [ ] Dialog not shown on initial wallet connection
- [ ] Privy state only cleared after user confirms

## Required Implementation

### Step 1: Create Confirmation Dialog Component

**File: `components/wallet/WalletSwitchConfirmation.tsx` (new file)**

```typescript
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface WalletSwitchConfirmationProps {
  isOpen: boolean;
  currentWalletName: string;
  nextWalletName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function WalletSwitchConfirmation({
  isOpen,
  currentWalletName,
  nextWalletName,
  onConfirm,
  onCancel,
  isLoading,
}: WalletSwitchConfirmationProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <div className="dialog-content">
        <h2>Switch Wallet?</h2>
        
        <p className="warning-text">
          Switching to <strong>{nextWalletName}</strong> will change your active account.
        </p>

        <div className="details">
          <p>This will:</p>
          <ul>
            <li>Disconnect from <strong>{currentWalletName}</strong></li>
            <li>Clear your authentication session</li>
            <li>Require re-login with {nextWalletName}</li>
            <li>Affect any active broadcasts or features</li>
          </ul>
        </div>

        <p className="info-text">
          Make sure you want to switch before confirming.
        </p>

        <div className="button-group">
          <Button 
            onClick={onCancel} 
            disabled={isLoading}
            variant="outline"
          >
            Cancel
          </Button>
          
          <Button 
            onClick={onConfirm} 
            disabled={isLoading}
            variant="destructive"
          >
            {isLoading ? "Switching..." : "Switch Wallet"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
```

### Step 2: Update Wallet Context

**File: `contexts/stellar-wallet-context.tsx` (modify)**

```typescript
import { WalletSwitchConfirmation } from "@/components/wallet/WalletSwitchConfirmation";

export function StellarWalletProvider({ children }: { children: React.ReactNode }) {
  const [activePublicKey, setActivePublicKey] = useState<string | null>(null);
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);
  const [pendingWallet, setPendingWallet] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const connect = async (wallet: string) => {
    // If already connected to different wallet, show confirmation
    if (activePublicKey && activePublicKey !== wallet) {
      setPendingWallet(wallet);
      setShowSwitchConfirm(true);
      return;
    }

    // First connection, proceed without confirmation
    await performWalletSwitch(wallet);
  };

  const performWalletSwitch = async (wallet: string) => {
    try {
      setIsLoading(true);

      // Set new wallet
      await walletKit.setWallet(wallet);
      const newPublicKey = await walletKit.getPublicKey();

      // Update app state BEFORE clearing Privy
      setActivePublicKey(newPublicKey);

      // Now clear Privy state (after confirmation)
      sessionStorage.removeItem("privy_user");
      sessionStorage.removeItem("privy_session");

      // Clear any user data tied to previous identity
      clearUserData();

      setShowSwitchConfirm(false);
      setPendingWallet(null);
    } catch (error) {
      console.error("Failed to switch wallet:", error);
      setShowSwitchConfirm(false);
      setPendingWallet(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSwitch = () => {
    if (pendingWallet) {
      performWalletSwitch(pendingWallet);
    }
  };

  const handleCancelSwitch = () => {
    setShowSwitchConfirm(false);
    setPendingWallet(null);
  };

  return (
    <StellarWalletContext.Provider value={{ activePublicKey, connect }}>
      <WalletSwitchConfirmation
        isOpen={showSwitchConfirm}
        currentWalletName={getCurrentWalletName(activePublicKey)}
        nextWalletName={pendingWallet ? getWalletName(pendingWallet) : ""}
        onConfirm={handleConfirmSwitch}
        onCancel={handleCancelSwitch}
        isLoading={isLoading}
      />
      {children}
    </StellarWalletContext.Provider>
  );
}
```

## Deeper Architectural Issues

### Beyond the Confirmation Dialog

The issue mentions:
> Beyond adding a confirmation dialog, this points at a deeper architectural gap: the app currently conflates connecting a wallet with switching the active account, with no concept of linking multiple wallets to a single StreamFi account.

**Current Architecture Problem:**
```
One StreamFi Account → One Wallet
Account === Wallet Identity
No separation between account and wallet
```

**Better Architecture Would Be:**
```
One StreamFi Account → Multiple Wallets
- Account is user identity
- Wallets are authentication methods
- Switch active wallet without losing account
- Maintain data across wallet switches
```

### Future Improvement: Multi-Wallet Support

**Data Model Changes Needed:**
```typescript
// Current (conflated)
User {
  id: string
  wallet: string // THE identity
  privy?: PrivySession
}

// Better (separated)
User {
  id: string // Account identity
  linkedWallets: Wallet[] // Can have multiple
  activeWallet: Wallet // Current signing key
  privySession?: PrivySession // Optional auth layer
}

Wallet {
  address: string
  type: "stellar" | "other"
  linkedAt: Date
  isPrimary: boolean
}
```

**Benefits:**
- User keeps account when switching wallets
- All stream data stays with account
- Followers tied to user, not wallet
- Tips don't disappear when switching
- Multi-chain support in future

## Testing Approach

### Unit Tests
```typescript
describe("Wallet Switch Confirmation", () => {
  it("should show confirmation when switching to different wallet", () => {
    // Test that dialog appears when activeWallet !== selectedWallet
  });

  it("should not show confirmation on initial connection", () => {
    // Test that first wallet connection skips dialog
  });

  it("should clear Privy only after user confirms", () => {
    // Test that sessionStorage not cleared until confirmation
  });

  it("should restore previous state if user cancels", () => {
    // Test that cancel doesn't change anything
  });
});
```

### Integration Tests
```typescript
describe("Wallet Switching Flow", () => {
  it("should maintain user data when canceling wallet switch", () => {
    // Select new wallet
    // Show dialog
    // Click cancel
    // Verify previous wallet still active
    // Verify user data unchanged
  });

  it("should successfully switch wallet after confirmation", () => {
    // Select new wallet
    // Click confirm
    // Wait for transition
    // Verify new wallet active
    // Verify old Privy session cleared
  });
});
```

## User Experience Flow

### Current (Dangerous)
```
Click "Connect Wallet B"
    ↓
Privy cleared immediately
    ↓
User confused, no undo
```

### Improved (Safe)
```
Click "Connect Wallet B"
    ↓
Confirmation Dialog Shows
    ├─ "Cancel" → No change
    └─ "Confirm" → Privy cleared
```

## Migration Path

### Phase 1: Add Confirmation (SHORT TERM)
1. Create confirmation dialog
2. Update wallet context to show dialog
3. Only clear state after confirmation
4. Deploy with UX improvement

### Phase 2: Better State Management (MEDIUM TERM)
1. Separate account identity from wallet
2. Persist account data across wallet switches
3. Allow linked wallets
4. Maintain user preferences per account

### Phase 3: Multi-Wallet Support (LONG TERM)
1. Allow multiple wallets per account
2. Easy wallet switching without logout
3. Fallback wallets if primary unavailable
4. Multi-chain support

## Error Handling

**Scenarios to Handle:**

1. **Network Error During Switch**
   - Dialog shows "Switching..."
   - Network error occurs
   - Dialog shows error message
   - User can retry or cancel

2. **Wallet Kit Failure**
   - Dialog shows error
   - Can cancel back to previous wallet
   - No partial state change

3. **Privy Session Clear Fails**
   - Warning shown to user
   - User aware of possible issues
   - Can manually clear storage if needed

## Security Considerations

- **Confirmation Required** - Intentional action, not accidental
- **Clear Communication** - User knows what they're doing
- **No Private Key Exposure** - Dialog never shows sensitive data
- **Session Cleanup** - Old auth tokens properly removed
- **Activity Logging** - Track wallet switches for audit

## Related Issues

- Issue #1696 - Main issue for wallet switching confirmation
- Related: Any account/wallet confusion reports

## Notes

- This is a **critical UX/security issue** - users can lose access
- Confirmation dialog is minimum fix, not complete solution
- Long-term: separate account identity from wallet choice
- Consider auto-logout for security during switch
- Add toast notification after successful switch
