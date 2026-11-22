import React from "react";
import { render, screen } from "@testing-library/react";
import { MainnetSafetyBanner } from "@/components/wallet/MainnetSafetyBanner";
import { TipModal } from "@/components/tipping/TipModal";

jest.mock("@/contexts/stellar-wallet-context", () => ({
  useStellarWallet: () => ({
    kit: { signTransaction: jest.fn() },
    address: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    publicKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    isConnected: true,
    status: "connected",
    connect: jest.fn(),
    connectWallet: jest.fn(),
    disconnect: jest.fn(),
    isLoading: false,
    isConnecting: false,
    error: null,
    privyWallet: null,
  }),
}));

jest.mock("@/lib/stellar/payments", () => ({
  buildTipTransaction: jest.fn(),
  submitTransaction: jest.fn(),
  hasInsufficientBalance: jest.fn(),
  checkAccountBalance: jest.fn(),
  AccountNotFundedError: class AccountNotFundedError extends Error {},
  getXLMPrice: jest.fn().mockResolvedValue(0.1),
  calculateFeeEstimate: jest.fn().mockReturnValue(0.00001),
  getRecommendedFeeStroops: jest.fn().mockResolvedValue(100),
  MAX_TIP_AMOUNT_XLM: 100000,
  MIN_TIP_AMOUNT_XLM: 0.1,
}));

jest.mock("@/lib/session-replay", () => ({
  sessionReplay: {
    addBreadcrumb: jest.fn(),
    recordFlowError: jest.fn(),
  },
}));

describe("MainnetSafetyBanner & TipModal mainnet guard", () => {
import { render, screen, fireEvent } from "@testing-library/react";

jest.mock("@creit.tech/stellar-wallets-kit", () => ({
  WalletNetwork: { PUBLIC: "PUBLIC", TESTNET: "TESTNET" },
  FREIGHTER_ID: "freighter",
  allowAllModules: jest.fn(() => []),
  StellarWalletsKit: jest.fn().mockImplementation(() => ({
    openModal: jest.fn(),
    setWallet: jest.fn(),
    getAddress: jest.fn().mockResolvedValue({ address: "" }),
    signTransaction: jest.fn(),
  })),
}));

jest.mock("@/lib/stellar/payments", () => {
  const actual = jest.requireActual("@/lib/stellar/payments");
  return {
    ...actual,
    getXLMPrice: jest.fn().mockResolvedValue(0.1),
    getRecommendedFeeStroops: jest.fn().mockResolvedValue(100),
    hasInsufficientBalance: jest.fn().mockResolvedValue(false),
    checkAccountBalance: jest.fn().mockResolvedValue({ status: "ok" }),
  };
});

import { StellarWalletProvider } from "@/contexts/stellar-wallet-context";
import { MainnetSafetyBanner } from "@/components/wallet/MainnetSafetyBanner";
import { TipModal } from "@/components/tipping/TipModal";
import { getStellarNetworkGuardState } from "@/lib/stellar/network-guard";

const VALID_SENDER = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const VALID_RECIPIENT =
  "GBBD47UZM2HV4D6HY4NS242OR5Q5JIHTIGIVQ5I37OP7EZ7YJAKEQXL";

describe("MainnetSafetyBanner and TipModal safety guard (#1716)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("renders nothing in production + mainnet or preview + testnet", () => {
    const { rerender } = render(
      <MainnetSafetyBanner
        guardOptions={{
          env: {
            VERCEL_ENV: "production",
            NEXT_PUBLIC_STELLAR_NETWORK: "mainnet",
          },
        }}
      />
    );
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it("renders nothing in production + mainnet or preview + testnet", () => {
    const prodGuard = getStellarNetworkGuardState({
      env: { VERCEL_ENV: "production", NEXT_PUBLIC_STELLAR_NETWORK: "mainnet" },
      hostname: "www.streamfi.media",
    });
    const { rerender } = render(<MainnetSafetyBanner guardState={prodGuard} />);
    expect(
      screen.queryByTestId("mainnet-safety-banner")
    ).not.toBeInTheDocument();

    rerender(
      <MainnetSafetyBanner
        guardOptions={{
          env: {
            VERCEL_ENV: "preview",
            NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
          },
        }}
      />
    );
    const previewTestnetGuard = getStellarNetworkGuardState({
      env: { VERCEL_ENV: "preview", NEXT_PUBLIC_STELLAR_NETWORK: "testnet" },
      hostname: "streamfi-git-pr.vercel.app",
    });
    rerender(<MainnetSafetyBanner guardState={previewTestnetGuard} />);
    expect(
      screen.queryByTestId("mainnet-safety-banner")
    ).not.toBeInTheDocument();
  });

  it("renders an unmistakable alert banner and blocks TipModal when preview points to mainnet", () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = "preview";
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "mainnet";

    render(
      <>
  it("renders an unmistakable alert banner and disables TipModal when preview points to mainnet", () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = "preview";
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "mainnet";
    const onError = jest.fn();

    render(
      <StellarWalletProvider>
        <MainnetSafetyBanner />
        <TipModal
          isOpen={true}
          onClose={jest.fn()}
          recipientUsername="creator"
          recipientPublicKey="GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
          senderPublicKey="GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
        />
      </>
    );

    const banner = screen.getByTestId("mainnet-safety-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/MAINNET TRANSACTIONS BLOCKED/i);
    expect(banner).toHaveTextContent(/preview/i);

    const modalAlert = screen.getByTestId("tip-modal-mainnet-blocked");
    expect(modalAlert).toBeInTheDocument();
    expect(modalAlert).toHaveTextContent(/blocked/i);

    const sendButton = screen.getByRole("button", { name: /send tip/i });
    expect(sendButton).toBeDisabled();
  });

  it("renders a warning banner even when transaction blocking is overridden", () => {
    render(
      <MainnetSafetyBanner
        guardOptions={{
          env: {
            VERCEL_ENV: "preview",
            NEXT_PUBLIC_STELLAR_NETWORK: "mainnet",
            NEXT_PUBLIC_ALLOW_NON_PROD_MAINNET: "true",
          },
        }}
      />
    );

    const banner = screen.getByTestId("mainnet-safety-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/WARNING: STELLAR MAINNET ACTIVE/i);
          recipientPublicKey={VALID_RECIPIENT}
          senderPublicKey={VALID_SENDER}
          onError={onError}
        />
      </StellarWalletProvider>
    );

    const banner = screen.getByTestId("mainnet-safety-banner");
    expect(banner).toHaveAttribute("role", "alert");
    expect(banner).toHaveTextContent(
      /MAINNET SAFETY GUARD ACTIVE - REAL TRANSACTIONS BLOCKED/i
    );
    expect(banner).toHaveTextContent(/preview/i);
    expect(banner).toHaveTextContent(/NEXT_PUBLIC_STELLAR_NETWORK=testnet/i);

    const modalAlert = screen.getByTestId("tip-modal-mainnet-blocked");
    expect(modalAlert).toHaveTextContent(/Mainnet Tipping Blocked/i);

    const amountInput = screen.getByPlaceholderText("0.00");
    expect(amountInput).toBeDisabled();

    const sendButton = screen.getByRole("button", { name: /send tip/i });
    expect(sendButton).toBeDisabled();

    fireEvent.click(sendButton);
    expect(onError).not.toHaveBeenCalled();
  });

  it("renders a loud warning banner even when override is enabled", () => {
    const overrideGuard = getStellarNetworkGuardState({
      env: {
        VERCEL_ENV: "preview",
        NEXT_PUBLIC_STELLAR_NETWORK: "mainnet",
        NEXT_PUBLIC_ALLOW_MAINNET_IN_NON_PROD: "true",
      },
      hostname: "",
    });

    render(<MainnetSafetyBanner guardState={overrideGuard} />);

    const banner = screen.getByTestId("mainnet-safety-banner");
    expect(banner).toHaveTextContent(
      /WARNING: STELLAR MAINNET ACTIVE IN NON-PRODUCTION ENVIRONMENT/i
    );
    expect(banner).toHaveTextContent(/override enabled/i);
  });
});
