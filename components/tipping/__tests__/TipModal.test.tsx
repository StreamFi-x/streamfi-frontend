// @ts-nocheck
/* eslint-disable curly, eqeqeq, no-unused-vars */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TipModal } from "../TipModal";
import * as payments from "@/lib/stellar/payments";

jest.mock("@/lib/stellar/payments", () => ({
  MAX_TIP_AMOUNT_XLM: 10000,
  MIN_TIP_AMOUNT_XLM: 0.1,
  getFeeEstimateDetails: jest.fn(),
  FeeEstimateDetails: jest.fn(),
  buildTipTransaction: jest.fn(),
  submitTransaction: jest.fn(),
  hasInsufficientBalance: jest.fn(),
  checkAccountBalance: jest.fn(),
  getXLMPrice: jest.fn(),
  calculateFeeEstimate: jest.fn(() => 0.00001),
  getRecommendedFeeStroops: jest.fn(),
}));

const mockSignTransaction = jest.fn().mockResolvedValue({ signedTxXdr: "signed_xdr" });
const mockKit = { signTransaction: mockSignTransaction };
jest.mock("@/contexts/stellar-wallet-context", () => ({
  useStellarWallet: () => ({ kit: mockKit }),
}));

const mockFeeDetails = {
  xlm: 0.0005,
  stroops: 5000,
  isSurgePricing: false,
  isFallback: false,
};

describe("TipModal fee estimation and confirmation flow", () => {
  beforeEach(() => {
    (payments.getFeeEstimateDetails as jest.Mock).mockResolvedValue(mockFeeDetails);
    (payments.hasInsufficientBalance as jest.Mock).mockResolvedValue(false);
    (payments.checkAccountBalance as jest.Mock).mockResolvedValue({ status: "ok" });
    (payments.buildTipTransaction as jest.Mock).mockResolvedValue({ toXDR: () => "tx" });
    (payments.submitTransaction as jest.Mock).mockResolvedValue({ success: true, hash: "abc123" });
  });

  test("shows estimating state before fee resolves", async () => {
    (payments.getFeeEstimateDetails as jest.Mock).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockFeeDetails), 100))
    );
    render(
      <TipModal
        isOpen={true}
        onClose={() => {}}
        recipientUsername="alice"
        recipientPublicKey="GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        senderPublicKey="GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
      />
    );
    const amountInput = screen.getByPlaceholderText("0.00");
    fireEvent.change(amountInput, { target: { value: "1" } });
    // fee line should show Estimating... initially
    expect(screen.getByText("Estimated network fee")).toBeInTheDocument();
    expect(screen.getByText("Estimating...")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("0.0005000 XLM")).toBeInTheDocument());
  });

  test("live fee estimate shows distinct line item and total includes it", async () => {
    render(
      <TipModal
        isOpen={true}
        onClose={() => {}}
        recipientUsername="bob"
        recipientPublicKey="GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"
        senderPublicKey="GDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD"
      />
    );
    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "2" } });
    await waitFor(() => screen.getByText("0.0005000 XLM"));
    expect(screen.getByText(/Total/)).toBeInTheDocument();
    expect(screen.getByText("2.0005000 XLM")).toBeInTheDocument();
  });

  test("click Review Tip enters confirming step without signing", async () => {
    render(
      <TipModal
        isOpen={true}
        onClose={() => {}}
        recipientUsername="carol"
        recipientPublicKey="GEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE"
        senderPublicKey="GFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
      />
    );
    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "1" } });
    await waitFor(() => screen.getByText("0.0005000 XLM"));
    fireEvent.click(screen.getByRole("button", { name: /Review Tip/i }));
    await waitFor(() => screen.getByTestId("tip-confirmation-summary"));
    expect(screen.getByTestId("estimated-network-fee")).toHaveTextContent("0.0005000 XLM");
    expect(payments.buildTipTransaction).not.toHaveBeenCalled();
  });

  test("click Confirm & Sign builds transaction with fee and signs", async () => {
    render(
      <TipModal
        isOpen={true}
        onClose={() => {}}
        recipientUsername="dave"
        recipientPublicKey="GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG"
        senderPublicKey="GHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH"
      />
    );
    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "1" } });
    await waitFor(() => screen.getByText("0.0005000 XLM"));
    fireEvent.click(screen.getByRole("button", { name: /Review Tip/i }));
    await waitFor(() => screen.getByTestId("tip-confirmation-summary"));
    fireEvent.click(screen.getByRole("button", { name: /Confirm & Sign/i }));
    await waitFor(() => expect(payments.buildTipTransaction).toHaveBeenCalledWith(expect.objectContaining({ feeStroops: 5000 })));
    const { kit } = require("@/contexts/stellar-wallet-context").useStellarWallet();
    expect(kit.signTransaction).toHaveBeenCalled();
  });

  test("fallback notice displays when isFallback true", async () => {
    (payments.getFeeEstimateDetails as jest.Mock).mockResolvedValue({
      xlm: 0.0005,
      stroops: 5000,
      isSurgePricing: false,
      isFallback: true,
    });
    render(
      <TipModal
        isOpen={true}
        onClose={() => {}}
        recipientUsername="eve"
        recipientPublicKey="GIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII"
        senderPublicKey="GJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJ"
      />
    );
    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "1" } });
    await waitFor(() => screen.getByText("Live fee unavailable: using network base fee"));
  });
});
