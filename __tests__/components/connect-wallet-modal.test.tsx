import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ConnectWalletModal from "@/components/connectWallet";
import { WALLET_CONNECT_ID } from "@/lib/stellar/walletconnect";

const mockConnectWallet = jest.fn();
let mockWalletState = {
  isConnected: false,
  isLoading: false,
  isConnecting: false,
  connectWallet: mockConnectWallet,
  error: null as string | null,
  isWalletConnectAvailable: true,
  pendingWalletSwitch: null,
};

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/contexts/stellar-wallet-context", () => ({
  useStellarWallet: () => mockWalletState,
}));

jest.mock("@/hooks/usePrivyAuth", () => ({
  usePrivyAuth: () => ({
    signInWithGoogle: jest.fn(),
    ready: true,
    authenticated: false,
  }),
}));

describe("ConnectWalletModal mobile QR flow (#1742)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWalletState = {
      isConnected: false,
      isLoading: false,
      isConnecting: false,
      connectWallet: mockConnectWallet,
      error: null,
      isWalletConnectAvailable: true,
      pendingWalletSwitch: null,
    };
  });

  it("renders Mobile Wallet (QR Code) option and initiates WalletConnect on click", () => {
    render(
      <ConnectWalletModal isModalOpen={true} setIsModalOpen={jest.fn()} />
    );

    const qrButton = screen.getByRole("button", {
      name: /Mobile Wallet \(QR Code\)/i,
    });
    expect(qrButton).toBeInTheDocument();

    fireEvent.click(qrButton);
    expect(mockConnectWallet).toHaveBeenCalledWith(WALLET_CONNECT_ID);
  });

  it("shows configuration hint when WalletConnect project ID is missing", () => {
    mockWalletState.isWalletConnectAvailable = false;

    render(
      <ConnectWalletModal isModalOpen={true} setIsModalOpen={jest.fn()} />
    );

    expect(
      screen.getByText(/Requires WalletConnect project ID configuration/i)
    ).toBeInTheDocument();
  });
});
