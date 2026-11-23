import type { PlaywrightTestConfig } from "@playwright/test";

/**
 * Dummy values only. Every off-box dependency is stubbed with page.route()
 * in tests/e2e/fixtures.ts, so PR runs need no real credentials.
 */
export const E2E_ENV: Record<string, string> = {
  // Privy validates length only on the client. 25 chars keeps the provider
  // from throwing before our page.route() stubs take over.
  NEXT_PUBLIC_PRIVY_APP_ID: "cl12345678901234567890123",
  NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100",
  NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
  NEXT_PUBLIC_STELLAR_HORIZON_URL: "https://horizon-testnet.stellar.org",
  NEXT_PUBLIC_DEV_MODE: "false",
  POSTGRES_URL: "postgres://e2e:e2e@127.0.0.1:5432/e2e",
  // Next 16 stops dev once to show an agent upgrade nudge. CI mode plus an
  // explicit policy makes it record telemetry and continue without stopping.
  CI: "true",
  __NEXT_AGENT_UPGRADE: "security",
};

export function webServer(port: number) {
  return {
    command: `npm run dev -- --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: E2E_ENV,
  };
}

/** Freeze the rendering environment so screenshots and flows stay stable. */
export const deterministicUse: PlaywrightTestConfig["use"] = {
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  reducedMotion: "reduce",
  colorScheme: "dark",
};
