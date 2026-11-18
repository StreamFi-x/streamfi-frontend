import React from "react";
import { render, act } from "@testing-library/react";
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

let latestContext: ReturnType<typeof useStellarWallet> | null = null;

function Consumer() {
  latestContext = useStellarWallet();
  return <div data-testid="wallet-status">{latestContext.status}</div>;
}

describe("StellarWalletProvider console logging hygiene (#1746)", () => {
  let logSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    latestContext = null;
    localStorage.clear();
    sessionStorage.clear();
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    debugSpy = jest.spyOn(console, "debug").mockImplementation(() => {});
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("does not log raw SDK error objects to browser console when modal closes or fails in non-development builds", async () => {
    render(
      <StellarWalletProvider>
        <Consumer />
      </StellarWalletProvider>
    );

    expect(latestContext).not.toBeNull();

    const rawSdkError = new Error("Internal SDK modal closed by user");
    (latestContext!.kit.openModal as jest.Mock).mockImplementationOnce(
      async ({ onClosed }: { onClosed: (err?: unknown) => void }) => {
        onClosed(rawSdkError);
      }
    );

    await act(async () => {
      await latestContext!.connect();
    });

    // NODE_ENV in Jest is "test" (not "development"), so no console output should appear
    expect(logSpy).not.toHaveBeenCalled();
    expect(debugSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(latestContext!.isConnecting).toBe(false);
  });

  it("does not leak raw SDK error objects to console when direct wallet connection fails", async () => {
    render(
      <StellarWalletProvider>
        <Consumer />
      </StellarWalletProvider>
    );

    const sdkErr = Object.assign(new Error("User rejected connection"), {
      internalSdkState: { secretToken: "xyz" },
    });
    (latestContext!.kit.getAddress as jest.Mock).mockRejectedValueOnce(sdkErr);

    await act(async () => {
      await latestContext!.connectWallet("freighter");
    });

    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(latestContext!.error).toBe(
      "Connection was rejected. Please try again."
    );
  });

  it("connects wallet and stores address cleanly on modal selection", async () => {
    render(
      <StellarWalletProvider>
        <Consumer />
      </StellarWalletProvider>
    );

    const testAddress =
      "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW";
    (latestContext!.kit.openModal as jest.Mock).mockImplementationOnce(
      async ({
        onWalletSelected,
      }: {
        onWalletSelected: (w: { id: string; name: string }) => Promise<void>;
      }) => {
        (latestContext!.kit.getAddress as jest.Mock).mockResolvedValueOnce({
          address: testAddress,
        });
        await onWalletSelected({ id: "freighter", name: "Freighter" });
      }
    );

    await act(async () => {
      await latestContext!.connect();
    });

    expect(latestContext!.publicKey).toBe(testAddress);
    expect(latestContext!.isConnected).toBe(true);
    expect(logSpy).not.toHaveBeenCalled();
  });
});
