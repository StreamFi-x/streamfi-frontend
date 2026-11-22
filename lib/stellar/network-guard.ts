export type DeploymentContext =
  "production" | "preview" | "development" | "test" | "unknown";

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

export class MainnetBlockedError extends Error {
  readonly code = "MAINNET_BLOCKED_IN_NON_PROD";
  readonly deploymentContext: DeploymentContext;

  constructor(deploymentContext: DeploymentContext, message?: string) {
    super(
      message ??
        `Stellar mainnet transactions are blocked in non-production (${deploymentContext}) deployments. Set NEXT_PUBLIC_STELLAR_NETWORK=testnet for non-production environments.`
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

function normalizeDeploymentEnv(
  value: string | undefined
): DeploymentContext | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "production" || normalized === "prod") {
    return "production";
  }
  if (
    normalized === "preview" ||
    normalized === "staging" ||
    normalized === "stage"
  ) {
    return "preview";
  }
  if (normalized === "development" || normalized === "dev") {
    return "development";
  }
  if (normalized === "test") {
    return "test";
  }
  return null;
}

export function getDeploymentContext(
  env: Record<string, string | undefined> = process.env,
  hostname?: string
): DeploymentContext {
  // Prefer explicit Vercel / app deployment environment variables
  const explicit =
    normalizeDeploymentEnv(env.NEXT_PUBLIC_VERCEL_ENV) ??
    normalizeDeploymentEnv(env.VERCEL_ENV) ??
    normalizeDeploymentEnv(env.NEXT_PUBLIC_APP_ENV) ??
    normalizeDeploymentEnv(env.APP_ENV);

  if (explicit) {
    return explicit;
  }

  // Infer from browser hostname if available
  const resolvedHost =
    hostname ??
    (typeof window !== "undefined" ? window.location?.hostname : undefined);

  if (resolvedHost) {
    const lowerHost = resolvedHost.toLowerCase();
    if (
      lowerHost === "localhost" ||
      lowerHost === "127.0.0.1" ||
      lowerHost.endsWith(".local")
    ) {
      return "development";
    }
    if (lowerHost.endsWith(".vercel.app")) {
      return "preview";
    }
  }

  const nodeEnv = normalizeDeploymentEnv(env.NODE_ENV);
  if (nodeEnv) {
    return nodeEnv;
  }

  return "unknown";
}

export function getMainnetGuardState(
  options: MainnetGuardOptions = {}
): MainnetGuardState {
  const env = options.env ?? process.env;
  const network: "mainnet" | "testnet" = isMainnetConfigured(env)
    ? "mainnet"
    : "testnet";
  const deploymentContext = getDeploymentContext(env, options.hostname);

  const isMainnetInNonProd =
    network === "mainnet" && deploymentContext !== "production";

  const allowOverride =
    env.NEXT_PUBLIC_ALLOW_NON_PROD_MAINNET?.trim().toLowerCase() === "true";

  const isBlocked = isMainnetInNonProd && !allowOverride;

  let warningMessage: string | null = null;
  if (isMainnetInNonProd) {
    warningMessage = isBlocked
      ? `Stellar mainnet is configured in a non-production (${deploymentContext}) deployment. Real-funds transactions are blocked to prevent accidental mainnet execution. Set NEXT_PUBLIC_STELLAR_NETWORK=testnet for non-production environments.`
      : `WARNING: Stellar mainnet is active in a non-production (${deploymentContext}) deployment with transaction blocking overridden. Real funds are at risk.`;
  }

  return {
    network,
    deploymentContext,
    isMainnetInNonProd,
    isBlocked,
    warningMessage,
  };
}

export function assertMainnetAllowedForTransaction(
  network: "testnet" | "mainnet",
  options: MainnetGuardOptions = {}
): void {
  if (network !== "mainnet") {
    return;
  }

  const env = options.env ?? process.env;
  const deploymentContext = getDeploymentContext(env, options.hostname);
  const allowOverride =
    env.NEXT_PUBLIC_ALLOW_NON_PROD_MAINNET?.trim().toLowerCase() === "true";

  if (deploymentContext !== "production" && !allowOverride) {
    throw new MainnetBlockedError(deploymentContext);
  }
}
