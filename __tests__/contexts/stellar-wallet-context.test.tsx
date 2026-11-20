import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import {
  StellarWalletProvider,
  useStellarWallet,
} from "@/contexts/stellar-wallet-context";
import { WALLET_CONNECT_ID } from "@/lib/stellar/walletconnect";

const mockWalletAddress =
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const mockMobileAddress =
  "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB222";

function WalletHarness({
  onKitReady,
}: {
  onKitReady?: (ctx: ReturnType<typeof useStellarWallet>) => void;
}) {
  const ctx = useStellarWallet();
  React.useEffect(() => {
    onKitReady?.(ctx);
  }, [ctx, onKitReady]);

  return (
    <div>
      <span data-testid="address">{ctx.publicKey ?? "none"}</span>
      <span data-testid="wallet-id">{ctx.activeWalletId ?? "none"}</span>
      <span data-testid="privy">{ctx.privyWallet?.email ?? "none"}</span>
      <span data-testid="wc-available">
        {String(ctx.isWalletConnectAvailable)}
      </span>
      <span data-testid="error">{ctx.error ?? "none"}</span>
      <button onClick={() => void ctx.connectWallet("freighter")}>
        Connect Freighter
      </button>
      <button onClick={() => void ctx.connectMobileWallet()}>
        Connect Mobile QR
      </button>
      <button onClick={() => void ctx.connect()}>Open Kit Modal</button>
      <button onClick={() => ctx.disconnect()}>Disconnect</button>
    </div>
  );
}

describe("StellarWalletProvider (#1742 & #1743)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: "test-wc-project-id",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("Privy session clearing confirmation (#1743)", () => {
    it("does not silently clear Privy session on wallet switch and preserves it if cancelled", async () => {
      sessionStorage.setItem(
        "privy_user",
        JSON.stringify({
          id: "u1",
          privyId: "did:privy:1",
          username: "googleuser",
          email: "user@example.com",
          avatar: null,
          wallet: null,
          displayName: "Google User",
        })
      );
      sessionStorage.setItem("username", "googleuser");

      let latestCtx!: ReturnType<typeof useStellarWallet>;
      render(
        <StellarWalletProvider>
          <WalletHarness
            onKitReady={ctx => {
              latestCtx = ctx;
            }}
          />
        </StellarWalletProvider>
      );

      (latestCtx.kit.getAddress as jest.Mock).mockResolvedValueOnce({
        address: mockWalletAddress,
      });

      fireEvent.click(screen.getByText("Connect Freighter"));

      // Confirmation modal must appear
      await waitFor(() => {
        expect(
          screen.getByRole("dialog", {
            name: /Clear Privy Session & Switch Wallet/i,
          })
        ).toBeInTheDocument();
      });

      // Privy session MUST still be intact before confirmation
      expect(sessionStorage.getItem("privy_user")).not.toBeNull();
      expect(sessionStorage.getItem("username")).toBe("googleuser");
      expect(screen.getByTestId("privy")).toHaveTextContent("user@example.com");
      expect(screen.getByTestId("address")).toHaveTextContent("none");

      // Cancel preserves Privy session completely
      fireEvent.click(
        screen.getByRole("button", { name: /Keep Current Session/i })
      );

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
      expect(sessionStorage.getItem("privy_user")).not.toBeNull();
      expect(sessionStorage.getItem("username")).toBe("googleuser");
      expect(screen.getByTestId("privy")).toHaveTextContent("user@example.com");
      expect(screen.getByTestId("address")).toHaveTextContent("none");
    });

    it("clears Privy session and activates new wallet only after explicit confirmation", async () => {
      sessionStorage.setItem(
        "privy_user",
        JSON.stringify({
          id: "u1",
          privyId: "did:privy:1",
          username: "googleuser",
          email: "user@example.com",
          avatar: null,
          wallet: null,
          displayName: "Google User",
        })
      );
      sessionStorage.setItem("username", "googleuser");

      let latestCtx!: ReturnType<typeof useStellarWallet>;
      render(
        <StellarWalletProvider>
          <WalletHarness
            onKitReady={ctx => {
              latestCtx = ctx;
            }}
          />
        </StellarWalletProvider>
      );

      (latestCtx.kit.getAddress as jest.Mock).mockResolvedValueOnce({
        address: mockWalletAddress,
      });

      fireEvent.click(screen.getByText("Connect Freighter"));

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /^Switch Wallet$/i }));

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });

      expect(sessionStorage.getItem("privy_user")).toBeNull();
      expect(sessionStorage.getItem("username")).toBeNull();
      expect(screen.getByTestId("privy")).toHaveTextContent("none");
      expect(screen.getByTestId("address")).toHaveTextContent(
        mockWalletAddress
      );
      expect(localStorage.getItem("stellar_address")).toBe(mockWalletAddress);
    });

    it("connects immediately without warning when no Privy session is active", async () => {
      let latestCtx!: ReturnType<typeof useStellarWallet>;
      render(
        <StellarWalletProvider>
          <WalletHarness
            onKitReady={ctx => {
              latestCtx = ctx;
            }}
          />
        </StellarWalletProvider>
      );

      (latestCtx.kit.getAddress as jest.Mock).mockResolvedValueOnce({
        address: mockWalletAddress,
      });

      fireEvent.click(screen.getByText("Connect Freighter"));

      await waitFor(() => {
        expect(screen.getByTestId("address")).toHaveTextContent(
          mockWalletAddress
        );
      });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("QR code mobile wallet connection flow (#1742)", () => {
    it("registers WalletConnect module and connects mobile wallet via QR bridge", async () => {
      let latestCtx!: ReturnType<typeof useStellarWallet>;
      render(
        <StellarWalletProvider>
          <WalletHarness
            onKitReady={ctx => {
              latestCtx = ctx;
            }}
          />
        </StellarWalletProvider>
      );

      expect(screen.getByTestId("wc-available")).toHaveTextContent("true");

      (latestCtx.kit.getAddress as jest.Mock).mockResolvedValueOnce({
        address: mockMobileAddress,
      });

      fireEvent.click(screen.getByText("Connect Mobile QR"));

      await waitFor(() => {
        expect(latestCtx.kit.setWallet).toHaveBeenCalledWith(WALLET_CONNECT_ID);
        expect(screen.getByTestId("address")).toHaveTextContent(
          mockMobileAddress
        );
        expect(screen.getByTestId("wallet-id")).toHaveTextContent(
          WALLET_CONNECT_ID
        );
      });

      // Supports signing transactions over the active WalletConnect session
      (latestCtx.kit.signTransaction as jest.Mock).mockResolvedValueOnce({
        signedTxXdr: "AAAA_SIGNED_XDR",
      });
      const signed = await latestCtx.kit.signTransaction("AAAA_UNSIGNED_XDR");
      expect(signed.signedTxXdr).toBe("AAAA_SIGNED_XDR");
    });

    it("retries briefly when WalletConnect client is still initializing", async () => {
      let latestCtx!: ReturnType<typeof useStellarWallet>;
      render(
        <StellarWalletProvider>
          <WalletHarness
            onKitReady={ctx => {
              latestCtx = ctx;
            }}
          />
        </StellarWalletProvider>
      );

      (latestCtx.kit.getAddress as jest.Mock)
        .mockRejectedValueOnce(new Error("WalletConnect is not running yet"))
        .mockResolvedValueOnce({ address: mockMobileAddress });

      fireEvent.click(screen.getByText("Connect Mobile QR"));

      await waitFor(
        () => {
          expect(screen.getByTestId("address")).toHaveTextContent(
            mockMobileAddress
          );
        },
        { timeout: 3000 }
      );
    });

    it("shows a clear error if WalletConnect project ID is not configured", async () => {
      delete process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

      render(
        <StellarWalletProvider>
          <WalletHarness />
        </StellarWalletProvider>
      );

      expect(screen.getByTestId("wc-available")).toHaveTextContent("false");

      fireEvent.click(screen.getByText("Connect Mobile QR"));

      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent(
          /NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID/i
        );
      });
    });

    it("disconnects cleanly when mobile wallet terminates the WalletConnect session", async () => {
      let latestCtx!: ReturnType<typeof useStellarWallet>;
      render(
        <StellarWalletProvider>
          <WalletHarness
            onKitReady={ctx => {
              latestCtx = ctx;
            }}
          />
        </StellarWalletProvider>
      );

      (latestCtx.kit.getAddress as jest.Mock).mockResolvedValueOnce({
        address: mockMobileAddress,
      });

      fireEvent.click(screen.getByText("Connect Mobile QR"));

      await waitFor(() => {
        expect(screen.getByTestId("address")).toHaveTextContent(
          mockMobileAddress
        );
      });

      // Trigger onSessionDeleted callback registered on the WalletConnectModule
      const wcModule = (
        latestCtx.kit as unknown as {
          modules: Array<{
            productId?: string;
            wcParams?: { onSessionDeleted?: (id: string) => void };
          }>;
        }
      ).modules.find(m => m.productId === WALLET_CONNECT_ID);
      expect(wcModule?.wcParams?.onSessionDeleted).toBeDefined();

      act(() => {
        wcModule?.wcParams?.onSessionDeleted?.("topic-123");
      });

      await waitFor(() => {
        expect(screen.getByTestId("address")).toHaveTextContent("none");
        expect(localStorage.getItem("stellar_address")).toBeNull();
      });
    });
  });
});
