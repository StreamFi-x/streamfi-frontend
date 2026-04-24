# TipModal Component

A React component for handling Stellar tip transactions with a complete UI flow.

## Features

- ✅ Preset amount buttons (1, 5, 10, 25 XLM)
- ✅ Custom amount input with validation
- ✅ Real-time USD conversion via Coinbase API
- ✅ Transaction fee estimation
- ✅ Balance validation
- ✅ Full transaction flow (build → sign → submit)
- ✅ Multiple transaction states with UI feedback
- ✅ Error handling with retry functionality
- ✅ Responsive and accessible design
- ✅ Integration with Stellar Wallets Kit

## Installation

The component requires the following dependencies (already included in package.json):

```json
{
  "@stellar/stellar-sdk": "^14.5.0",
  "@creit.tech/stellar-wallets-kit": "^1.5.0",
  "@radix-ui/react-dialog": "^1.1.14",
  "@radix-ui/react-avatar": "^1.1.10"
}
```

## Environment Variables

Add these to your `.env.local` file:

```bash
# Stellar Network Configuration
NEXT_PUBLIC_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_STELLAR_NETWORK=testnet  # or "public" for mainnet
```

For production/mainnet:

```bash
NEXT_PUBLIC_STELLAR_HORIZON_URL=https://horizon.stellar.org
NEXT_PUBLIC_STELLAR_NETWORK=public
```

## Usage

### Basic Example

```tsx
import { TipModal } from "@/components/tipping";

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Send Tip</button>

      <TipModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        recipientUsername="alice"
        recipientPublicKey="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
        senderPublicKey="GYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY"
      />
    </>
  );
}
```

### Props

| Prop                 | Type     | Required | Description                               |
| -------------------- | -------- | -------- | ----------------------------------------- |
| `isOpen`             | boolean  | Yes      | Controls modal visibility                 |
| `onClose`            | function | Yes      | Callback when modal is closed             |
| `recipientUsername`  | string   | Yes      | Display name of the recipient             |
| `recipientPublicKey` | string   | Yes      | Stellar public key of the recipient       |
| `recipientAvatar`    | string   | No       | URL to recipient's avatar image           |
| `senderPublicKey`    | string   | Yes      | Stellar public key of the sender (tipper) |

### Transaction States

The component handles the following states:

1. **idle** - Initial state, user can input amount
2. **building** - Constructing the transaction
3. **signing** - Waiting for wallet signature
4. **submitting** - Sending transaction to network
5. **success** - Transaction completed successfully
6. **error** - Transaction failed

## Testing

A test page is available at `/test-tip` for testing the component:

1. Install Freighter wallet extension
2. Create a testnet account and fund it via [Stellar Laboratory](https://laboratory.stellar.org/#account-creator?network=test)
3. Navigate to `/test-tip` in your browser
4. Enter your sender and recipient public keys
5. Test the tipping flow

## Utility Functions

The component uses the following utility functions from `@/lib/stellar/payments`:

### `buildTipTransaction(senderPublicKey, recipientPublicKey, amount, memo?)`

Builds a Stellar payment transaction.

**Parameters:**

- `senderPublicKey` (string) - Sender's public key
- `recipientPublicKey` (string) - Recipient's public key
- `amount` (string) - Amount in XLM
- `memo` (string, optional) - Transaction memo (max 28 characters)

**Returns:** Promise<string> - Transaction XDR

### `submitTransaction(xdr, publicKey)`

Signs and submits a transaction to the Stellar network.

**Parameters:**

- `xdr` (string) - Transaction XDR
- `publicKey` (string) - Signer's public key

**Returns:** Promise<{hash: string, success: boolean}>

### `getXLMPrice()`

Fetches current XLM to USD price from Coinbase API.

**Returns:** Promise<number> - Price in USD

### `hasInsufficientBalance(publicKey, amount)`

Checks if account has sufficient balance for transaction.

**Parameters:**

- `publicKey` (string) - Account public key
- `amount` (string) - Amount to check

**Returns:** Promise<boolean>

### `calculateFeeEstimate()`

Calculates the transaction fee.

**Returns:** number - Fee in XLM

## Error Handling

The component handles various error scenarios:

- **User declined** - User rejected the transaction in wallet
- **Insufficient balance** - Not enough XLM to complete transaction
- **Timeout** - Transaction took too long
- **Invalid amount** - Amount is invalid or too small
- **Network errors** - Connection or API failures

Each error displays a user-friendly message with retry option.

## Accessibility

- Keyboard navigation support
- ARIA labels for screen readers
- Focus trap when modal is open
- ESC key to close modal
- Disabled state for form elements during processing

## Integration with Stellar Wallets Kit

The component integrates with Stellar Wallets Kit and supports:

- Freighter
- xBull
- Albedo
- Rabet

The wallet connection should be handled separately (e.g., in an auth context). This component only handles the transaction signing.

## Future Enhancements

Potential improvements (not included in current implementation):

- [ ] Optional memo/message field
- [ ] Transaction history
- [ ] Custom fee selection
- [ ] Multi-asset support (not just XLM)
- [ ] Recurring tips
- [ ] Tip templates/favorites

## License

Part of the StreamFi project.
