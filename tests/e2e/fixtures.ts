import type { Page, Route } from "@playwright/test";

/** Static testnet identities. No real funds, no real key material. */
export const E2E_WALLET =
  "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ";
export const E2E_RECIPIENT =
  "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ";

export interface StubOptions {
  /** Whether /api/users/wallet/<address> should find a registered user. */
  isRegistered?: () => boolean;
  /** Whether /api/streams/key should report an existing stream. */
  hasStream?: boolean;
}

async function json(
  route: Route,
  status: number,
  body: unknown
): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

/**
 * Make the app believe a wallet is already connected. The wallet context
 * restores from localStorage synchronously on mount (see
 * contexts/stellar-wallet-context.tsx), so no extension is needed for the UI
 * state under test.
 */
export async function seedConnectedWallet(
  page: Page,
  username?: string
): Promise<void> {
  await page.addInitScript(
    ({ address, name }) => {
      localStorage.setItem("stellar_address", address);
      localStorage.setItem("stellar_auto_connect", "true");
      localStorage.setItem("stellar_last_wallet", "freighter");
      if (name) {
        sessionStorage.setItem("username", name);
      }
    },
    { address: E2E_WALLET, name: username ?? null }
  );
}

/** Stub every off-box dependency the flows touch. Nothing hits a real network. */
export async function stubExternalServices(
  page: Page,
  options: StubOptions = {}
): Promise<void> {
  const isRegistered = options.isRegistered ?? (() => true);

  await page.route("https://api.coingecko.com/**", route =>
    json(route, 200, { stellar: { usd: 0.12 } })
  );

  await page.route("https://horizon-testnet.stellar.org/**", route => {
    const url = route.request().url();
    if (url.includes("/accounts/")) {
      const accountId =
        url.split("/accounts/")[1]?.split(/[/?#]/)[0] ?? E2E_WALLET;
      return json(route, 200, {
        id: accountId,
        account_id: accountId,
        sequence: "12345",
        subentry_count: 0,
        thresholds: {
          low_threshold: 0,
          med_threshold: 0,
          high_threshold: 0,
        },
        flags: {},
        balances: [{ asset_type: "native", balance: "1000.0000000" }],
        signers: [],
        data: {},
      });
    }
    if (url.includes("/transactions")) {
      return json(route, 200, { hash: "e2e-tip-hash", ledger: 12345 });
    }
    return json(route, 200, {});
  });

  await page.route("**/api/auth/wallet-session", route =>
    json(route, 200, { ok: true })
  );

  await page.route("**/api/users/wallet/**", route =>
    isRegistered()
      ? json(route, 200, {
          user: {
            id: "e2e-user",
            username: "e2e-creator",
            wallet: E2E_WALLET,
            email: "creator@example.test",
          },
        })
      : json(route, 404, { error: "User not found" })
  );

  await page.route("**/api/users/register", route =>
    json(route, 200, {
      user: { id: "e2e-user", username: "e2e-creator", wallet: E2E_WALLET },
    })
  );

  await page.route("**/api/streams/key**", route =>
    json(route, 200, {
      hasStream: options.hasStream ?? false,
      streamData: null,
    })
  );

  await page.route("**/api/streams/create", route =>
    json(route, 200, {
      message: "Stream created",
      streamData: {
        streamId: "e2e-stream",
        playbackId: "e2e-playback",
        streamKey: "e2e-stream-key",
        rtmpUrl: "rtmp://global-live.mux.com:5222/app",
        title: "e2e-creator Stream",
        isActive: false,
        persistent: true,
      },
    })
  );

  await page.route("**/api/streams/live**", route =>
    json(route, 200, {
      streams: [
        {
          id: "e2e-stream",
          username: "e2e-creator",
          avatar: null,
          playbackId: "e2e-playback",
          title: "Visual baseline stream",
          description: "A stable stream card for screenshots",
          category: "Development",
          tags: ["stellar", "streaming"],
          thumbnail: null,
          viewerCount: 42,
          totalViews: 4200,
          isFollowing: false,
          streamStartedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    })
  );
}
