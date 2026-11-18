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

describe("TipModal Accessibility (#1830)", () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    recipientUsername: "streamer123",
    recipientPublicKey: "GBVOL67TMUQBQLW7WNWOUWVX2G2CTRBHB23D3GOMTMVO4EXAMPLE123",
    senderPublicKey: "GA2C5RFPE6GCKMY3US5PAB6UZLKIGAHWKXX2G2CTRBHB23D3GOMTMVO4",
  };

  it("associates the custom amount input with helper text constraint and exposes currency unit", async () => {
    await act(async () => {
      render(<TipModal {...defaultProps} />);
    });

    const input = screen.getByRole("textbox", { name: /custom tip amount in xlm/i });
    expect(input).toBeInTheDocument();

    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toContain("custom-amount-max-helper");

    const helperText = document.getElementById("custom-amount-max-helper");
    expect(helperText).toBeInTheDocument();
    expect(helperText).toHaveTextContent(/Max: 1,000 XLM/i);
    expect(input).toHaveAttribute("aria-invalid", "false");
  });

  it("dynamically updates aria-describedby and aria-invalid when a validation error occurs", async () => {
    await act(async () => {
      render(<TipModal {...defaultProps} />);
    });

    const input = screen.getByRole("textbox", { name: /custom tip amount in xlm/i });

    await act(async () => {
      fireEvent.change(input, { target: { value: "0.05" } });
    });

    const sendButton = screen.getByRole("button", { name: /send tip/i });
    await act(async () => {
      fireEvent.click(sendButton);
    });

    const errorMessage = await screen.findByRole("alert");
    expect(errorMessage).toBeInTheDocument();
    expect(errorMessage).toHaveAttribute("id", "custom-amount-error");
    expect(errorMessage).toHaveAttribute("aria-live", "polite");

    expect(input).toHaveAttribute("aria-invalid", "true");
    const updatedDescribedBy = input.getAttribute("aria-describedby");
    expect(updatedDescribedBy).toContain("custom-amount-max-helper");
    expect(updatedDescribedBy).toContain("custom-amount-error");
  });
});
