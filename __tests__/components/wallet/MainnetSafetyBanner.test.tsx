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
    expect(
      screen.queryByTestId("mainnet-safety-banner")
    ).not.toBeInTheDocument();
  });

  it("renders an unmistakable alert banner and blocks TipModal when preview points to mainnet", () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = "preview";
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "mainnet";

    render(
      <>
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
  });
});
