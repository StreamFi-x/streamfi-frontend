import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import ConnectWalletModal from "../connectWallet";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockConnectWallet = jest.fn();
const mockGetSupportedWallets = jest.fn();
const mockKit = { getSupportedWallets: mockGetSupportedWallets };

jest.mock("@/contexts/stellar-wallet-context", () => ({
  useStellarWallet: () => ({
    kit: mockKit,
    isConnected: false,
    isLoading: false,
    isConnecting: false,
    connectWallet: mockConnectWallet,
    error: null,
  }),
}));

jest.mock("@/hooks/usePrivyAuth", () => ({
  usePrivyAuth: () => ({
    signInWithGoogle: jest.fn(),
    ready: true,
    authenticated: false,
  }),
}));

jest.mock("@/lib/session-replay", () => ({
  sessionReplay: {
    addBreadcrumb: jest.fn(),
    recordFlowError: jest.fn(),
  },
}));

describe("ConnectWalletModal (#1739 & #1740)", () => {
  const originalNetwork = process.env.NEXT_PUBLIC_STELLAR_NETWORK;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSupportedWallets.mockResolvedValue([]);
    delete (window as unknown as Record<string, unknown>).freighterApi;
    delete (window as unknown as Record<string, unknown>).xBullSDK;
  });

  afterEach(() => {
    if (originalNetwork === undefined) {
      delete process.env.NEXT_PUBLIC_STELLAR_NETWORK;
    } else {
      process.env.NEXT_PUBLIC_STELLAR_NETWORK = originalNetwork;
    }
    delete (window as unknown as Record<string, unknown>).freighterApi;
    delete (window as unknown as Record<string, unknown>).xBullSDK;
  });

  it("displays the active Stellar Testnet indicator in the connect wallet modal (#1739)", () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";
    render(
      <ConnectWalletModal isModalOpen={true} setIsModalOpen={jest.fn()} />
    );

    const badge = screen.getByTestId("stellar-network-badge");
    expect(badge).toHaveAttribute("data-network", "testnet");
    expect(badge).toHaveTextContent(/Stellar Testnet/i);
  });

  it("proactively distinguishes installed, web, and not-installed wallets before any click (#1740)", async () => {
    (window as unknown as Record<string, unknown>).freighterApi = {};

    render(
      <ConnectWalletModal isModalOpen={true} setIsModalOpen={jest.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByTestId("wallet-option-freighter")).toHaveAttribute(
        "data-wallet-status",
        "installed"
      );
    });

    const freighterRow = screen.getByTestId("wallet-option-freighter");
    expect(freighterRow).toHaveTextContent("Installed");

    const albedoRow = screen.getByTestId("wallet-option-albedo");
    expect(albedoRow).toHaveAttribute("data-wallet-status", "web");
    expect(albedoRow).toHaveTextContent("Web");

    const xbullRow = screen.getByTestId("wallet-option-xbull");
    expect(xbullRow).toHaveAttribute("data-wallet-status", "not_installed");
    expect(xbullRow).toHaveTextContent("Not installed");
    expect(screen.getByRole("link", { name: "Install xBull" })).toHaveAttribute(
      "href",
      "https://xbull.app/"
    );
  });
});
