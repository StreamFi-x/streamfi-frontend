import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { TipModal } from "@/components/tipping/TipModal";

jest.mock("@/contexts/stellar-wallet-context", () => ({
  useStellarWallet: () => ({
    walletState: {
      address: "GA2C5RFPE6GCKMY3US5PAB6UZLKIGAHWKXX2G2CTRBHB23D3GOMTMVO4",
      isConnected: true,
    },
    connect: jest.fn(),
    disconnect: jest.fn(),
  }),
}));

jest.mock("@/lib/stellar/payments", () => ({
  buildTipTransaction: jest.fn(),
  submitTransaction: jest.fn(),
  hasInsufficientBalance: jest.fn().mockResolvedValue(false),
  checkAccountBalance: jest.fn().mockResolvedValue({ status: "funded" }),
  AccountNotFundedError: class AccountNotFundedError extends Error {},
  getXLMPrice: jest.fn().mockResolvedValue(0.12),
  calculateFeeEstimate: jest.fn().mockReturnValue(100),
  getRecommendedFeeStroops: jest.fn().mockResolvedValue(100),
  MAX_TIP_AMOUNT_XLM: 1000,
  MIN_TIP_AMOUNT_XLM: 0.1,
}));

jest.mock("@stellar/stellar-sdk", () => ({
  TransactionBuilder: jest.fn(),
  Networks: { TESTNET: "Test SDF Network ; September 2015", PUBLIC: "Public Global Stellar Network ; September 2015" },
}));

jest.mock("@creit.tech/stellar-wallets-kit", () => ({
  WalletNetwork: { TESTNET: "testnet", PUBLIC: "public" },
}));

jest.mock("@/lib/session-replay", () => ({
  sessionReplay: {
    addBreadcrumb: jest.fn(),
    recordFlowError: jest.fn(),
  },
}));

beforeAll(() => {
  global.fetch = jest.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ quote_token: "test", quoted_rate: 1, quoted_xlm_amount: 1, expires_at: "" }),
    })
  ) as jest.Mock;
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe("TipModal Send Button Validation (#1829)", () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    recipientUsername: "streamer123",
    recipientPublicKey: "GBVOL67TMUQBQLW7WNWOUWVX2G2CTRBHB23D3GOMTMVO4EXAMPLE1234",
    senderPublicKey: "GA2C5RFPE6GCKMY3US5PAB6UZLKIGAHWKXX2G2CTRBHB23D3GOMTMVO4",
  };

  it("keeps send button disabled when input is empty", async () => {
    await act(async () => {
      render(<TipModal {...defaultProps} />);
    });

    const sendButton = screen.getByRole("button", { name: /send.*tip/i });
    expect(sendButton).toBeDisabled();
  });

  it("keeps send button disabled for non-positive or incomplete values (bare zero, lone dot, leading zeros)", async () => {
    await act(async () => {
      render(<TipModal {...defaultProps} />);
    });

    const input = screen.getByRole("textbox");
    const sendButton = screen.getByRole("button", { name: /send.*tip/i });

    // Bare zero "0"
    await act(async () => {
      fireEvent.change(input, { target: { value: "0" } });
    });
    expect(sendButton).toBeDisabled();

    // Lone decimal point "."
    await act(async () => {
      fireEvent.change(input, { target: { value: "." } });
    });
    expect(sendButton).toBeDisabled();

    // "0.00"
    await act(async () => {
      fireEvent.change(input, { target: { value: "0.00" } });
    });
    expect(sendButton).toBeDisabled();

    // "000"
    await act(async () => {
      fireEvent.change(input, { target: { value: "000" } });
    });
    expect(sendButton).toBeDisabled();
  });

  it("keeps send button disabled when amount is below MIN_TIP_AMOUNT or above MAX_TIP_AMOUNT", async () => {
    await act(async () => {
      render(<TipModal {...defaultProps} />);
    });

    const input = screen.getByRole("textbox");
    const sendButton = screen.getByRole("button", { name: /send.*tip/i });

    // Below min (0.05 < 0.1)
    await act(async () => {
      fireEvent.change(input, { target: { value: "0.05" } });
    });
    expect(sendButton).toBeDisabled();

    // Above max (1001 > 1000)
    await act(async () => {
      fireEvent.change(input, { target: { value: "1001" } });
    });
    expect(sendButton).toBeDisabled();
  });

  it("enables send button when a valid amount is entered", async () => {
    await act(async () => {
      render(<TipModal {...defaultProps} />);
    });

    const input = screen.getByRole("textbox");
    const sendButton = screen.getByRole("button", { name: /send.*tip/i });

    await act(async () => {
      fireEvent.change(input, { target: { value: "5" } });
    });
    expect(sendButton).toBeEnabled();
  });
});
