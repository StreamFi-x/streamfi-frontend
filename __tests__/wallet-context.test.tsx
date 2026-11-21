import { act, render, screen } from "@testing-library/react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import {
  StellarWalletProvider,
  useStellarWallet,
} from "@/contexts/stellar-wallet-context";

jest.mock("@/lib/session-replay", () => ({
  sessionReplay: { addBreadcrumb: jest.fn(), recordFlowError: jest.fn() },
}));

let wallet: ReturnType<typeof useStellarWallet>;
function Probe() {
  wallet = useStellarWallet();
  return (
    <p>{wallet.publicKey ?? wallet.unavailableWalletId ?? "disconnected"}</p>
  );
}
const tree = (
  <StellarWalletProvider>
    <Probe />
  </StellarWalletProvider>
);

beforeEach(() => localStorage.clear());

it("hydrates the server markup without mismatch and restores a cached address", async () => {
  localStorage.setItem("stellar_auto_connect", "true");
  localStorage.setItem("stellar_address", "saved-address");
  const container = document.createElement("div");
  container.innerHTML = renderToString(tree);
  expect(container.textContent).toBe("disconnected");
  const recoverable = jest.fn();
  let root: Root | undefined;
  await act(async () => {
    root = hydrateRoot(container, tree, { onRecoverableError: recoverable });
  });
  expect(container.textContent).toBe("saved-address");
  expect(recoverable).not.toHaveBeenCalled();
  await act(async () => root?.unmount());
});

it("stores a successful connection and identifies an unavailable wallet independently of error wording", async () => {
  render(tree);
  jest
    .mocked(wallet.kit.getAddress)
    .mockResolvedValueOnce({ address: "connected-address" });
  await act(async () => wallet.connectWallet("freighter"));
  expect(localStorage.getItem("stellar_address")).toBe("connected-address");
  act(() => wallet.disconnect());

  jest
    .mocked(wallet.kit.getAddress)
    .mockRejectedValueOnce(new Error("Provider returned code 831"));
  jest
    .mocked(wallet.kit.getSupportedWallets)
    .mockResolvedValueOnce([{ id: "freighter", isAvailable: false }] as Awaited<
      ReturnType<typeof wallet.kit.getSupportedWallets>
    >);
  await act(async () => wallet.connectWallet("freighter"));
  expect(screen.getByText("freighter")).toBeInTheDocument();
  expect(wallet.isConnected).toBe(false);
});
