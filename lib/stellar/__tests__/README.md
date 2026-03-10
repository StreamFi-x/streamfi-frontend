# Stellar Payment Tests

## Security Notice

⚠️ **NEVER commit secret keys to the repository!**

This test suite uses environment variables to load testnet keys. Even though testnet keys have no real value, it's important to follow security best practices.

## Setup

1. **Get Testnet Accounts**
   - Visit [Stellar Laboratory](https://laboratory.stellar.org/#account-creator)
   - Generate two keypairs (one for viewer, one for creator)
   - Save the public and secret keys securely

2. **Fund Accounts**
   - Visit [Friendbot](https://friendbot.stellar.org)
   - Fund both accounts with testnet XLM

3. **Set Environment Variables**

   **Option A: Using .env.test file (Recommended)**

   ```bash
   # Copy the example file
   cp .env.test.example .env.test

   # Edit .env.test with your keys
   # .env.test is already in .gitignore
   ```

   **Option B: Export directly**

   ```bash
   export TEST_STELLAR_PUBLIC_KEY="GXXXXXXX..."
   export TEST_STELLAR_SECRET_KEY="SXXXXXXX..."
   export TEST_STELLAR_DESTINATION_KEY="GXXXXXXX..."
   ```

4. **Run Tests**

   ```bash
   # Load environment variables and run tests
   npx tsx lib/stellar/__tests__/payments.test.ts

   # Or with dotenv
   npx dotenv -e .env.test tsx lib/stellar/__tests__/payments.test.ts
   ```

## Environment Variables

| Variable                       | Description                          | Required                       |
| ------------------------------ | ------------------------------------ | ------------------------------ |
| `TEST_STELLAR_PUBLIC_KEY`      | Viewer's public key (sends tips)     | Yes                            |
| `TEST_STELLAR_SECRET_KEY`      | Viewer's secret key                  | For submission test            |
| `TEST_STELLAR_DESTINATION_KEY` | Creator's public key (receives tips) | Yes                            |
| `NEXT_PUBLIC_STELLAR_NETWORK`  | Network (testnet/mainnet)            | Optional (defaults to testnet) |

## Test Coverage

The test suite covers:

1. ✅ Module exports verification
2. ✅ TypeScript type definitions
3. ✅ Public key validation
4. ✅ XLM amount formatting
5. ✅ Network selection
6. ✅ Transaction building
7. ✅ Transaction submission (requires secret key)
8. ✅ Error handling

## Expected Output

```
🚀 Starting Stellar Payment Utility Tests

✅ Test 1: Module exports
✅ Test 2: TypeScript types defined
✅ Test 3: Public key validation
✅ Test 4: XLM amount formatting
✅ Test 5: Network selection
✅ Test 6: Build tip transaction
   ✅ Transaction built successfully!
   - Operations: 1
   - Memo: text - "StreamFi Tip"
   - Fee: 100
✅ Test 7: Submit transaction
   ✅ Transaction submitted successfully!
   - Hash: abc123...
   - Ledger: 12345

🎉 All tests completed!
```

## Troubleshooting

### Test 7 Skipped

If you see "SKIPPED: Set TEST_STELLAR_SECRET_KEY environment variable", you need to provide the secret key:

```bash
export TEST_STELLAR_SECRET_KEY="SXXXXXXX..."
```

### Account Not Found

Ensure your accounts are funded with Friendbot before running tests.

### Transaction Failed

Check that:

- Source account has sufficient balance (at least 11 XLM for a 10 XLM tip + fees + minimum balance)
- Destination account exists and is funded
- Network is set correctly (testnet)

## Security Best Practices

✅ **DO:**

- Use environment variables for secrets
- Add `.env.test` to `.gitignore`
- Use testnet keys for testing
- Rotate keys if accidentally committed

❌ **DON'T:**

- Hardcode secret keys in code
- Commit `.env.test` to repository
- Use mainnet keys for testing
- Share secret keys in public channels
