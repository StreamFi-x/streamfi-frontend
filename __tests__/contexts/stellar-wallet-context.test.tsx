import { act, render, screen } from "@testing-library/react";
import {
  StellarWalletProvider,
  useStellarWallet,
} from "@/contexts/stellar-wallet-context";
import { sessionReplay } from "@/lib/session-replay";

function WalletHarness() {
  const wallet = useStellarWallet();
  return (
    <div>
      <span data-testid="status">{wallet.status}</span>
      <span data-testid="address">{wallet.address ?? "none"}</span>
      <span data-testid="error">{wallet.error ?? "none"}</span>
      <button onClick={() => void wallet.connect()}>open-modal</button>
      <button onClick={() => void wallet.connectWallet("freighter")}>
        connect-freighter
      </button>
      <button onClick={() => wallet.disconnect()}>disconnect</button>
    </div>
  );
}

const NODE_ENV_KEY = "NODE_ENV";

function setNodeEnv(value: string) {
  process.env[NODE_ENV_KEY] = value;
}

describe("StellarWalletProvider console logging hygiene (#1746)", () => {
  const originalNodeEnv = process.env[NODE_ENV_KEY];
  let logSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    sessionReplay.clearBreadcrumbs();
    logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
    debugSpy = jest.spyOn(console, "debug").mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    setNodeEnv(originalNodeEnv ?? "test");
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("emits zero console logs when the wallet modal closes with a raw SDK error object in production", async () => {
    setNodeEnv("production");
    const rawSdkModalError = {
      code: -4,
      message: "Modal closed by user",
      internalTransportFrame: { rpcToken: "internal-sdk-detail" },
    };

    let capturedKit: {
      openModal: jest.Mock;
    } | null = null;

    function KitInspector() {
      const { kit } = useStellarWallet();
      capturedKit = kit as unknown as { openModal: jest.Mock };
      return null;
    }

    render(
      <StellarWalletProvider>
        <KitInspector />
        <WalletHarness />
      </StellarWalletProvider>
    );

    capturedKit!.openModal.mockImplementationOnce(
      async ({ onClosed }: { onClosed: (err: unknown) => void }) => {
        onClosed(rawSdkModalError);
      }
    );

    await act(async () => {
      screen.getByText("open-modal").click();
    });

    expect(screen.getByTestId("status")).toHaveTextContent("disconnected");
    expect(logSpy).not.toHaveBeenCalled();
    expect(debugSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    const closeCrumb = sessionReplay
      .getBreadcrumbs()
      .find(b => b.message === "Wallet selection modal closed");
    expect(closeCrumb?.data).toEqual({ error: "Modal closed by user" });
  });

  it("emits zero console output on modal open failure, direct connect failure, and auto-connect failure in production", async () => {
    setNodeEnv("production");
    jest.useFakeTimers();

    localStorage.setItem("stellar_auto_connect", "true");
    localStorage.setItem("stellar_last_wallet", "freighter");

    let capturedKit: {
      openModal: jest.Mock;
      getAddress: jest.Mock;
    } | null = null;

    function KitInspector() {
      const { kit } = useStellarWallet();
      capturedKit = kit as unknown as {
        openModal: jest.Mock;
        getAddress: jest.Mock;
      };
      return null;
    }

    render(
      <StellarWalletProvider>
        <KitInspector />
        <WalletHarness />
      </StellarWalletProvider>
    );

    const rawAutoConnectError = Object.assign(
      new Error("Extension bridge unavailable"),
      { sdkInternalState: "raw-extension-frame" }
    );
    capturedKit!.getAddress.mockRejectedValueOnce(rawAutoConnectError);

    // Trigger delayed auto-connect (800ms)
    await act(async () => {
      jest.advanceTimersByTime(850);
      await Promise.resolve();
    });

    // Trigger openModal failure
    const rawModalException = Object.assign(new Error("Modal init crashed"), {
      sdkPayload: { internalKey: "hidden" },
    });
    capturedKit!.openModal.mockRejectedValueOnce(rawModalException);

    await act(async () => {
      screen.getByText("open-modal").click();
      await Promise.resolve();
    });
    expect(screen.getByTestId("error")).toHaveTextContent(
      "Failed to connect wallet"
    );

    // Trigger direct connectWallet failure
    const rawDirectConnectError = Object.assign(
      new Error("User rejected request"),
      { rawExtensionResponse: { internalId: 99 } }
    );
    capturedKit!.getAddress.mockRejectedValueOnce(rawDirectConnectError);

    await act(async () => {
      const connectPromise = (async () => {
        screen.getByText("connect-freighter").click();
      })();
      jest.advanceTimersByTime(150);
      await connectPromise;
      await Promise.resolve();
    });

    expect(screen.getByTestId("error")).toHaveTextContent(
      "Connection was rejected. Please try again."
    );
    expect(logSpy).not.toHaveBeenCalled();
    expect(debugSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("never passes raw SDK error objects to console even in development mode", async () => {
    setNodeEnv("development");

    const rawSdkError = Object.assign(new Error("Modal dismissed"), {
      internalSdkSecret: "must-never-appear-in-console",
    });

    let capturedKit: { openModal: jest.Mock } | null = null;

    function KitInspector() {
      const { kit } = useStellarWallet();
      capturedKit = kit as unknown as { openModal: jest.Mock };
      return null;
    }

    render(
      <StellarWalletProvider>
        <KitInspector />
        <WalletHarness />
      </StellarWalletProvider>
    );

    capturedKit!.openModal.mockImplementationOnce(
      async ({ onClosed }: { onClosed: (err: unknown) => void }) => {
        onClosed(rawSdkError);
      }
    );

    await act(async () => {
      screen.getByText("open-modal").click();
    });

    expect(logSpy).not.toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalledTimes(1);
    expect(debugSpy).toHaveBeenCalledWith("[StellarWallet] Modal closed", {
      reason: "Modal dismissed",
    });
    const serializedArgs = JSON.stringify(debugSpy.mock.calls);
    expect(serializedArgs).not.toContain("must-never-appear-in-console");
  });
});
