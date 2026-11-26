import type { StellarNetwork } from "./config";

/**
 * Combined deployment/network guard (#1695).
 *
 * The older `MainnetGuardState` API and the newer `StellarNetworkGuardState`
 * API both remain exported: tipping and the wallet banner use the former, while
 * the wallet provider and API routes use the latter. Keeping one implementation
 * avoids the duplicate declarations that made this module unparseable.
 */
export type DeploymentContext =
  | "production"
  | "preview"
  | "staging"
  | "development"
  | "test"
  | "unknown";

export interface MainnetGuardState {
  network: "mainnet" | "testnet";
  deploymentContext: DeploymentContext;
  isMainnetInNonProd: boolean;
  isBlocked: boolean;
  warningMessage: string | null;
}

export interface MainnetGuardOptions {
  env?: Record<string, string | undefined>;
  hostname?: string;
}

export interface StellarNetworkGuardState extends MainnetGuardState {
  network: StellarNetwork;
  isNonProduction: boolean;
  isUnsafeMainnetConfig: boolean;
  isTransactionBlocked: boolean;
  overrideEnabled: boolean;
  reason: string | null;
}

export interface NetworkGuardOptions extends MainnetGuardOptions {
  network?: StellarNetwork;
}

const DEPLOYMENT_CONTEXTS: readonly DeploymentContext[] = [
  "production",
  "preview",
  "staging",
  "development",
  "test",
  "unknown",
];

function isDeploymentContext(value: unknown): value is DeploymentContext {
  return DEPLOYMENT_CONTEXTS.includes(value as DeploymentContext);
}

function isGuardOptions(
  value: unknown
): value is Pick<NetworkGuardOptions, "env" | "hostname"> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    ("env" in candidate && typeof candidate.env === "object") ||
    ("hostname" in candidate && typeof candidate.hostname === "string")
  );
}

export class MainnetBlockedError extends Error {
  readonly code = "MAINNET_BLOCKED" as const;
  readonly deploymentContext: DeploymentContext;
  readonly network: StellarNetwork = "mainnet";

  // Both constructor orders existed in the two merged implementations. Keep
  // them as overloads so callers from either API remain source-compatible.
  constructor(deploymentContext: DeploymentContext, message?: string);
  constructor(message: string, deploymentContext: DeploymentContext);
  constructor(
    first: DeploymentContext | string,
    second?: DeploymentContext | string
  ) {
    const deploymentContext = isDeploymentContext(first)
      ? first
      : isDeploymentContext(second)
        ? second
        : "unknown";
    const message = isDeploymentContext(first)
      ? typeof second === "string"
        ? second
        : undefined
      : first;

    super(
      message ??
        `Stellar mainnet transactions are blocked in ${deploymentContext} deployments.`
    );
    this.name = "MainnetBlockedError";
    this.deploymentContext = deploymentContext;
  }
}

export function isMainnetConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  const raw = env.NEXT_PUBLIC_STELLAR_NETWORK?.trim().toLowerCase();
  return raw === "mainnet" || raw === "pubnet" || raw === "public";
}

function parseConfiguredNetwork(
  env: Record<string, string | undefined>
): StellarNetwork {
  return isMainnetConfigured(env) ? "mainnet" : "testnet";
}

function normalizeAppContext(
  value: string | undefined
): DeploymentContext | null {
  const normalized = value?.trim().toLowerCase();
  switch (normalized) {
    case "production":
    case "prod":
      return "production";
    case "preview":
    case "stage":
      return "preview";
    case "staging":
      return "staging";
    case "development":
    case "dev":
      return "development";
    case "test":
      return "test";
    default:
      return null;
  }
}

export function getDeploymentContext(
  options?: Pick<NetworkGuardOptions, "env" | "hostname">
): DeploymentContext;
export function getDeploymentContext(
  env: Record<string, string | undefined>,
  hostname?: string
): DeploymentContext;
export function getDeploymentContext(
  first:
    | Record<string, string | undefined>
    | Pick<NetworkGuardOptions, "env" | "hostname"> = {},
  hostname?: string
): DeploymentContext {
  const options = isGuardOptions(first) ? first : null;
  const env = options
    ? (options.env ?? process.env)
    : (first as Record<string, string | undefined>);
  const resolvedHost = options ? options.hostname : hostname;

  const explicit =
    normalizeAppContext(env.VERCEL_ENV || env.NEXT_PUBLIC_VERCEL_ENV) ??
    normalizeAppContext(env.NEXT_PUBLIC_APP_ENV || env.APP_ENV);
  if (explicit) {
    return explicit;
  }

  const rawHost =
    resolvedHost !== undefined
      ? resolvedHost
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
      host.includes("-git-") ||
      host.endsWith(".vercel.app")
    ) {
      return "preview";
    }
    if (host.startsWith("staging.") || host.startsWith("stage.")) {
      return "staging";
    }
  }

  return normalizeAppContext(env.NODE_ENV) ?? "unknown";
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
  const isMainnetInNonProd = network === "mainnet" && isNonProduction;
  const overrideEnabled =
    (env.NEXT_PUBLIC_ALLOW_MAINNET_IN_NON_PROD ||
      env.NEXT_PUBLIC_ALLOW_NON_PROD_MAINNET ||
      ""
    )
      .trim()
      .toLowerCase() === "true";
  const isTransactionBlocked = isMainnetInNonProd && !overrideEnabled;

  let reason: string | null = null;
  if (isMainnetInNonProd) {
    reason = isTransactionBlocked
      ? `Stellar mainnet is configured in a non-production (${deploymentContext}) deployment. Real-funds transactions are blocked to prevent accidental mainnet execution. Set NEXT_PUBLIC_STELLAR_NETWORK=testnet for non-production environments.`
      : `Warning: Stellar mainnet is active in a non-production (${deploymentContext}) deployment with an explicit override enabled. Transactions use real funds.`;
  }

  return {
    network,
    deploymentContext,
    isMainnetInNonProd,
    isBlocked: isTransactionBlocked,
    warningMessage: reason,
    isNonProduction,
    isUnsafeMainnetConfig: isMainnetInNonProd,
    isTransactionBlocked,
    overrideEnabled,
    reason,
  };
}

export function getMainnetGuardState(
  options: MainnetGuardOptions = {}
): MainnetGuardState {
  const state = getStellarNetworkGuardState(options);
  return {
    network: state.network,
    deploymentContext: state.deploymentContext,
    isMainnetInNonProd: state.isMainnetInNonProd,
    isBlocked: state.isBlocked,
    warningMessage: state.warningMessage,
  };
}

export function assertMainnetAllowedForTransaction(
  network?: StellarNetwork,
  options: Pick<NetworkGuardOptions, "env" | "hostname"> = {}
): void {
  const env = options.env ?? process.env;
  const effectiveNetwork = network ?? parseConfiguredNetwork(env);
  if (effectiveNetwork !== "mainnet") return;

  const state = getStellarNetworkGuardState({
    ...options,
    network: effectiveNetwork,
  });
  if (state.isTransactionBlocked) {
    throw new MainnetBlockedError(
      state.reason ??
        `Stellar mainnet transactions are blocked in ${state.deploymentContext} deployments.`,
      state.deploymentContext
    );
  }
}
