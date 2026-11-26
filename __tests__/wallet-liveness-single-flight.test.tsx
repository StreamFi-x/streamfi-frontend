/**
 * Regression coverage for wallet liveness checks (#1695).
 *
 * Focus and visibility events can fire in the same tick as the polling timer.
 * The provider must keep only one SDK lookup in flight.
 */
import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import {
  StellarWalletProvider,
  useStellarWallet,
} from "@/contexts/stellar-wallet-context";

jest.mock("@/lib/session-replay", () => ({
  sessionReplay: {
    addBreadcrumb: jest.fn(),
    recordFlowError: jest.fn(),
  },
}));

const mockAddress = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

let context: ReturnType<typeof useStellarWallet> | null = null;

function Consumer() {
  context = useStellarWallet();
  return <span data-testid="address">{context.publicKey ?? "none"}</span>;
}

describe("wallet liveness single-flight guard (#1695)", () => {
  beforeEach(() => {
    context = null;
    localStorage.clear();
    sessionStorage.clear();
    jest.clearAllMocks();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  it("collapses simultaneous focus and visibility checks into one getAddress call", async () => {
    localStorage.setItem("stellar_auto_connect", "true");
    localStorage.setItem("stellar_last_wallet", "freighter");
    localStorage.setItem("stellar_address", mockAddress);

    render(
      <StellarWalletProvider>
        <Consumer />
      </StellarWalletProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("address")).toHaveTextContent(mockAddress);
    });

    let resolveAddress!: (value: { address: string }) => void;
    const pending = new Promise<{ address: string }>((resolve) => {
      resolveAddress = resolve;
    });
    const getAddress = context!.kit.getAddress as jest.Mock;
    getAddress.mockReturnValue(pending);

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(getAddress).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveAddress({ address: mockAddress });
      await pending;
    });
  });
});
