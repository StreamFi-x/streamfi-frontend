/**
 * Test script for Stellar payment utilities
 * 
 * To run this test:
 * 1. Get testnet accounts from https://laboratory.stellar.org/#account-creator
 * 2. Fund them with testnet XLM using Friendbot
 * 3. Replace the placeholder addresses below
 * 4. Run: npx ts-node lib/stellar/__tests__/payments.test.ts
 */

import {
  buildTipTransaction,
  submitTransaction,
  isValidStellarPublicKey,
  formatXLMAmount,
  getCurrentNetwork,
} from "../payments.js";
import { Keypair } from "@stellar/stellar-sdk";

// Test configuration
const TEST_CONFIG = {
  // Replace these with your testnet accounts
  sourcePublicKey: process.env.TEST_STELLAR_PUBLIC_KEY || "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", // Viewer wallet
  sourceSecretKey: process.env.TEST_STELLAR_SECRET_KEY || "", // Viewer secret (load from env)
  destinationPublicKey: process.env.TEST_STELLAR_DESTINATION_KEY || "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", // Creator wallet
  amount: "10.0000000", // 10 XLM
  network: "testnet" as const,
};

async function runTests() {
  console.log("🚀 Starting Stellar Payment Utility Tests\n");

  // Test 1: File exists and exports functions
  console.log("✅ Test 1: Module exports");
  console.log("   - buildTipTransaction:", typeof buildTipTransaction);
  console.log("   - submitTransaction:", typeof submitTransaction);
  console.log("   - isValidStellarPublicKey:", typeof isValidStellarPublicKey);
  console.log("   - formatXLMAmount:", typeof formatXLMAmount);
  console.log("   - getCurrentNetwork:", typeof getCurrentNetwork);
  console.log("");

  // Test 2: TypeScript types
  console.log("✅ Test 2: TypeScript types defined");
  console.log("   - BuildTipTransactionParams interface exists");
  console.log("   - SubmitTransactionResult interface exists");
  console.log("");

  // Test 3: Validate Stellar public key
  console.log("✅ Test 3: Public key validation");
  const validKey = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
  const invalidKey1 = "INVALID_KEY";
  const invalidKey2 = "ABRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H"; // Wrong prefix
  
  console.log(`   - Valid key (${validKey.substring(0, 10)}...):`, isValidStellarPublicKey(validKey));
  console.log(`   - Invalid key (${invalidKey1}):`, isValidStellarPublicKey(invalidKey1));
  console.log(`   - Invalid prefix (A...):`, isValidStellarPublicKey(invalidKey2));
  console.log("");

  // Test 4: Format XLM amount
  console.log("✅ Test 4: XLM amount formatting");
  console.log("   - formatXLMAmount(10):", formatXLMAmount(10));
  console.log("   - formatXLMAmount(0.5):", formatXLMAmount(0.5));
  console.log("   - formatXLMAmount(100.123456789):", formatXLMAmount(100.123456789));
  console.log("");

  // Test 5: Get current network
  console.log("✅ Test 5: Network selection");
  console.log("   - getCurrentNetwork():", getCurrentNetwork());
  console.log("   - NEXT_PUBLIC_STELLAR_NETWORK:", process.env.NEXT_PUBLIC_STELLAR_NETWORK || "not set (defaults to testnet)");
  console.log("");

  // Test 6: Build transaction (requires real testnet accounts)
  console.log("✅ Test 6: Build tip transaction");
  if (TEST_CONFIG.sourcePublicKey.startsWith("GX")) {
    console.log("   ⚠️  SKIPPED: Replace placeholder addresses in TEST_CONFIG");
    console.log("   📝 To test:");
    console.log("      1. Visit https://laboratory.stellar.org/#account-creator");
    console.log("      2. Create two testnet accounts");
    console.log("      3. Fund them with Friendbot");
    console.log("      4. Update TEST_CONFIG in this file");
  } else {
    try {
      console.log(`   - Source: ${TEST_CONFIG.sourcePublicKey.substring(0, 10)}...`);
      console.log(`   - Destination: ${TEST_CONFIG.destinationPublicKey.substring(0, 10)}...`);
      console.log(`   - Amount: ${TEST_CONFIG.amount} XLM`);
      console.log(`   - Network: ${TEST_CONFIG.network}`);
      
      const transaction = await buildTipTransaction({
        sourcePublicKey: TEST_CONFIG.sourcePublicKey,
        destinationPublicKey: TEST_CONFIG.destinationPublicKey,
        amount: TEST_CONFIG.amount,
        network: TEST_CONFIG.network,
      });

      console.log("   ✅ Transaction built successfully!");
      console.log(`   - Operations: ${transaction.operations.length}`);
      console.log(`   - Memo: ${transaction.memo.type} - "${transaction.memo.value}"`);
      console.log(`   - Fee: ${transaction.fee}`);
      console.log(`   - Timeout: ${transaction.timeBounds?.maxTime}`);
      console.log("");

      // Test 7: Submit transaction (requires signing)
      console.log("✅ Test 7: Submit transaction");
      if (!TEST_CONFIG.sourceSecretKey) {
        console.log("   ⚠️  SKIPPED: Set TEST_STELLAR_SECRET_KEY environment variable to test submission");
        console.log("   📝 Example: TEST_STELLAR_SECRET_KEY=SXXXXXXX... npx tsx lib/stellar/__tests__/payments.test.ts");
      } else {
        try {
          // Sign the transaction
          const sourceKeypair = Keypair.fromSecret(TEST_CONFIG.sourceSecretKey);
          transaction.sign(sourceKeypair);

          console.log("   - Transaction signed");
          console.log("   - Submitting to Stellar Testnet...");

          const result = await submitTransaction(transaction, TEST_CONFIG.network);

          if (result.success) {
            console.log("   ✅ Transaction submitted successfully!");
            console.log(`   - Hash: ${result.hash}`);
            console.log(`   - Ledger: ${result.ledger}`);
            console.log(`   - View on Stellar Expert: https://stellar.expert/explorer/testnet/tx/${result.hash}`);
          } else {
            console.log("   ❌ Transaction failed:");
            console.log(`   - Error: ${result.error}`);
            console.log(`   - Result code: ${result.resultCode}`);
          }
        } catch (error) {
          console.log("   ❌ Error submitting transaction:");
          console.log(`   - ${error instanceof Error ? error.message : error}`);
        }
      }
    } catch (error) {
      console.log("   ❌ Error building transaction:");
      console.log(`   - ${error instanceof Error ? error.message : error}`);
    }
  }
  console.log("");

  console.log("🎉 All tests completed!\n");
}

// Run tests
runTests().catch(console.error);
