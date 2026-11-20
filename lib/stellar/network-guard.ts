import type { StellarNetwork } from "./config";

export type DeploymentContext =
  "production" | "preview" | "staging" | "development" | "test" | "unknown";

export interface StellarNetworkGuardState {
  network: StellarNetwork;
  deploymentContext: DeploymentContext;
  isNonProduction: boolean;
  isUnsafeMainnetConfig: boolean;
  isTransactionBlocked: boolean;
  overrideEnabled: boolean;
  reason: string | null;
}

export interface NetworkGuardOptions {
  env?: Record<string, string | undefined>;
  hostname?: string;
  network?: StellarNetwork;
}

export class MainnetBlockedError extends Error {
  readonly code = "MAINNET_BLOCKED" as const;
  readonly deploymentContext: DeploymentContext;
  readonly network: StellarNetwork = "mainnet";

  constructor(message: string, deploymentContext: DeploymentContext) {
    super(message);
    this.name = "MainnetBlockedError";
    this.deploymentContext = deploymentContext;
  }
}

function parseConfiguredNetwork(
  env: Record<string, string | undefined>
): StellarNetwork {
  const raw = env.NEXT_PUBLIC_STELLAR_NETWORK?.trim().toLowerCase();
  if (raw === "mainnet" || raw === "pubnet") {
    return "mainnet";
  }
  return "testnet";
}

function normalizeAppContext(
  value: string | undefined
): DeploymentContext | null {
  const normalized = value?.trim().toLowerCase();
  switch (normalized) {
    case "production":
      return "production";
    case "preview":
      return "preview";
    case "staging":
      return "staging";
    case "development":
      return "development";
    case "test":
      return "test";
    default:
      return null;
  }
}

export function getDeploymentContext(
  options: Pick<NetworkGuardOptions, "env" | "hostname"> = {}
): DeploymentContext {
  const env = options.env ?? process.env;

  // 1. Explicit Vercel deployment context (Vercel sets NODE_ENV=production on previews)
  const vercelContext = normalizeAppContext(
    env.VERCEL_ENV || env.NEXT_PUBLIC_VERCEL_ENV
  );
  if (vercelContext) {
    return vercelContext;
  }

  // 2. Explicit app-level deployment context
  const appContext = normalizeAppContext(
    env.NEXT_PUBLIC_APP_ENV || env.APP_ENV
  );
  if (appContext) {
    return appContext;
  }

  // 3. Browser / request hostname heuristics
  const rawHost =
    options.hostname !== undefined
      ? options.hostname
      : typeof window !== "undefined"
        ? window.location.hostname
        : "";
  const host = rawHost.trim().toLowerCase();

  if (host) {
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]" ||
      host.endsWith(".local")
    ) {
      return "development";
    }
    if (
      host.startsWith("preview.") ||
      host.startsWith("pr-") ||
      host.includes("-git-")
    ) {
      return "preview";
    }
    if (host.startsWith("staging.") || host.startsWith("stage.")) {
      return "staging";
    }
  }

  // 4. Node runtime fallback
  const nodeContext = normalizeAppContext(env.NODE_ENV);
  if (nodeContext) {
    return nodeContext;
  }

  return "unknown";
}

export function isNonProductionDeployment(context: DeploymentContext): boolean {
  return (
    context === "preview" ||
    context === "staging" ||
    context === "development" ||
    context === "test"
  );
}

export function getStellarNetworkGuardState(
  options: NetworkGuardOptions = {}
): StellarNetworkGuardState {
  const env = options.env ?? process.env;
  const network = options.network ?? parseConfiguredNetwork(env);
  const deploymentContext = getDeploymentContext(options);
  const isNonProduction = isNonProductionDeployment(deploymentContext);
  const isUnsafeMainnetConfig = network === "mainnet" && isNonProduction;
  const overrideEnabled =
    (env.NEXT_PUBLIC_ALLOW_MAINNET_IN_NON_PROD || "").trim().toLowerCase() ===
    "true";
  const isTransactionBlocked = isUnsafeMainnetConfig && !overrideEnabled;

  let reason: string | null = null;
  if (isUnsafeMainnetConfig) {
    reason = isTransactionBlocked
      ? `Stellar mainnet is configured in a non-production (${deploymentContext}) deployment. Real-funds transactions are blocked to prevent accidental mainnet execution. Set NEXT_PUBLIC_STELLAR_NETWORK=testnet for non-production environments.`
      : `Warning: Stellar mainnet is active in a non-production (${deploymentContext}) deployment with an explicit override enabled. Transactions use real funds.`;
  }

  return {
    network,
    deploymentContext,
    isNonProduction,
    isUnsafeMainnetConfig,
    isTransactionBlocked,
    overrideEnabled,
    reason,
  };
}

export function assertMainnetAllowedForTransaction(
  network?: StellarNetwork,
  options: Pick<NetworkGuardOptions, "env" | "hostname"> = {}
): void {
  const state = getStellarNetworkGuardState({
    ...options,
    network,
  });

  if (state.isTransactionBlocked) {
    throw new MainnetBlockedError(
      state.reason ??
        `Stellar mainnet transactions are blocked in ${state.deploymentContext} deployments.`,
      state.deploymentContext
    );
  }
}
