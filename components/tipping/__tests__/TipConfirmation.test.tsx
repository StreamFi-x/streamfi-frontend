import React from "react";
import { render, screen } from "@testing-library/react";
import { TipConfirmation } from "../TipConfirmation";

jest.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  motion: {
    div: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & {
      children?: React.ReactNode;
    }) => <div {...props}>{children}</div>,
  },
}));

describe("TipConfirmation (#1738)", () => {
  const sampleHash = "b".repeat(64);

  it("renders explicit in-progress confirmation UI while polling Stellar Horizon", () => {
    render(
      <TipConfirmation
        isOpen={true}
        onClose={jest.fn()}
        state="confirming"
        amount="10"
        recipientUsername="alice"
        txHash={sampleHash}
        confirmationProgress={{
          status: "polling",
          txHash: sampleHash,
          attempt: 3,
          maxAttempts: 30,
          elapsedMs: 4200,
        }}
      />
    );

    expect(screen.getByTestId("tip-confirmation-pending")).toBeInTheDocument();
    expect(screen.getByText(/Confirming on Stellar/i)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(
      screen.getByText(/Checking Stellar ledger \(attempt 3 of 30\)/i)
    ).toBeInTheDocument();
    expect(screen.getByText(sampleHash)).toBeInTheDocument();
  });

  it("renders clear success UI once confirmed on-chain", () => {
    render(
      <TipConfirmation
        isOpen={true}
        onClose={jest.fn()}
        state="success"
        amount="10"
        recipientUsername="alice"
        txHash={sampleHash}
      />
    );

    expect(screen.getByText(/Tip Sent Successfully!/i)).toBeInTheDocument();
    expect(screen.getByText(sampleHash)).toBeInTheDocument();
  });

  it("renders clear failure UI with error details and explorer link when confirmation fails", () => {
    render(
      <TipConfirmation
        isOpen={true}
        onClose={jest.fn()}
        state="error"
        amount="10"
        recipientUsername="alice"
        txHash={sampleHash}
        error={{
          message: "Transaction confirmation timed out on the Stellar network.",
          code: "timeout",
        }}
        onRetry={jest.fn()}
      />
    );

    expect(screen.getByText(/Transaction Failed/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Transaction confirmation timed out/i)
    ).toBeInTheDocument();
    expect(screen.getByText(sampleHash)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Try Again/i })
    ).toBeInTheDocument();
  });

  it("shows actionable recovery guidance when the wallet disconnected mid-transaction (#1695)", () => {
    render(
      <TipConfirmation
        isOpen={true}
        onClose={jest.fn()}
        state="error"
        amount="10"
        recipientUsername="alice"
        error={{
          message: "Wallet connection was lost during the transaction.",
          code: "wallet_disconnected",
        }}
        onRetry={jest.fn()}
      />
    );

    const guidance = screen.getByTestId("wallet-disconnect-guidance");
    expect(guidance).toHaveTextContent("wallet disconnected during this tip");
    expect(guidance).toHaveTextContent("Unlock or reconnect your wallet");
    expect(guidance).toHaveTextContent("No funds were sent");
  });
});
