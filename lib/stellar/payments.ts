import * as StellarSdk from "@stellar/stellar-sdk";
import {
  StellarWalletsKit,
  WalletNetwork,
  ISupportedWallet,
  FREIGHTER_ID,
  FreighterModule,
  xBullModule,
} from "@creit.tech/stellar-wallets-kit";

// Stellar network configuration
const HORIZON_URL = process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL || "https://horizon-testnet.stellar.org";
const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_STELLAR_NETWORK === "public"
  ? StellarSdk.Networks.PUBLIC
  : StellarSdk.Networks.TESTNET;

// Initialize Stellar server
const server = new StellarSdk.Horizon.Server(HORIZON_URL);

/**
 * Get the Stellar Wallets Kit instance
 */
export function getStellarWalletsKit(): StellarWalletsKit {
  const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK === "public"
    ? WalletNetwork.PUBLIC
    : WalletNetwork.TESTNET;

  return new StellarWalletsKit({
    network,
    selectedWalletId: FREIGHTER_ID,
    modules: [new FreighterModule(), new xBullModule()],
  });
}

/**
 * Get account details from Stellar network
 */
export async function getAccount(publicKey: string) {
  try {
    return await server.loadAccount(publicKey);
  } catch (error) {
    console.error("Error loading account:", error);
    throw new Error("Failed to load account. Please ensure the account exists and is funded.");
  }
}

/**
 * Get the minimum balance required for an account
 */
export async function getMinimumBalance(): Promise<number> {
  try {
    const ledger = await server.ledgers().order("desc").limit(1).call();
    const baseReserve = ledger.records[0].base_reserve_in_stroops;
    // Minimum balance = (2 + number of entries) * base reserve
    // For a basic account: 2 * base reserve
    return (2 * Number(baseReserve)) / 10000000; // Convert stroops to XLM
  } catch (error) {
    console.error("Error getting minimum balance:", error);
    return 1; // Default minimum balance
  }
}

/**
 * Build a tip transaction
 */
export async function buildTipTransaction(
  senderPublicKey: string,
  recipientPublicKey: string,
  amount: string,
  memo?: string
): Promise<string> {
  try {
    // Validate amount
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new Error("Invalid amount. Must be a positive number.");
    }

    // Load sender account
    const sourceAccount = await getAccount(senderPublicKey);

    // Build transaction
    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: recipientPublicKey,
          asset: StellarSdk.Asset.native(),
          amount: amount,
        })
      )
      .setTimeout(180); // 3 minutes timeout

    // Add memo if provided
    if (memo && memo.trim()) {
      transaction.addMemo(StellarSdk.Memo.text(memo.slice(0, 28))); // Max 28 characters
    }

    const builtTransaction = transaction.build();
    return builtTransaction.toXDR();
  } catch (error) {
    console.error("Error building transaction:", error);
    throw error;
  }
}

/**
 * Sign and submit a transaction using Stellar Wallets Kit
 */
export async function submitTransaction(
  xdr: string,
  publicKey: string
): Promise<{
  hash: string;
  success: boolean;
}> {
  try {
    const kit = getStellarWalletsKit();

    // Sign the transaction
    const { signedTxXdr } = await kit.signTransaction(xdr, {
      address: publicKey,
      networkPassphrase: NETWORK_PASSPHRASE,
    });

    // Submit to network
    const response = await server.submitTransaction(
      StellarSdk.TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE) as StellarSdk.Transaction
    );

    return {
      hash: response.hash,
      success: response.successful,
    };
  } catch (error) {
    console.error("Error submitting transaction:", error);
    throw error;
  }
}

/**
 * Validate if an account has sufficient balance for a transaction
 */
export async function hasInsufficientBalance(
  publicKey: string,
  amount: string
): Promise<boolean> {
  try {
    const account = await getAccount(publicKey);
    const balance = parseFloat(
      account.balances.find((b: StellarSdk.Horizon.HorizonApi.BalanceLine) => b.asset_type === "native")?.balance || "0"
    );
    const minimumBalance = await getMinimumBalance();
    const requiredAmount = parseFloat(amount) + parseFloat(StellarSdk.BASE_FEE) / 10000000; // Add fee

    return balance - requiredAmount < minimumBalance;
  } catch (error) {
    console.error("Error checking balance:", error);
    return true; // Assume insufficient balance on error
  }
}

/**
 * Get current XLM to USD price from Coinbase API
 */
export async function getXLMPrice(): Promise<number> {
  try {
    const response = await fetch("https://api.coinbase.com/v2/prices/XLM-USD/spot");
    const data = await response.json();
    return parseFloat(data.data.amount);
  } catch (error) {
    console.error("Error fetching XLM price:", error);
    return 0; // Return 0 if price fetch fails
  }
}

/**
 * Calculate transaction fee estimate
 */
export function calculateFeeEstimate(): number {
  // BASE_FEE is in stroops (1 XLM = 10,000,000 stroops)
  return parseFloat(StellarSdk.BASE_FEE) / 10000000;
}
