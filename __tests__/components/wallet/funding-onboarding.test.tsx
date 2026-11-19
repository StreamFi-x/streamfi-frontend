/**
 * #1424 end to end in the browser environment: funding status → wizard →
 * Transak → pending → funded, plus deferral/re-entry and the failure paths.
 * Only the external boundaries are stubbed (the Transak SDK, the wallet
 * context and the status endpoint); the state machine and useTransak are real.
 */
const mockListeners = new Map<string, (payload: unknown) => void>();
const mockInit = jest.fn();
jest.mock("@transak/transak-sdk", () => {
  const EVENTS = {
    TRANSAK_ORDER_CREATED: "TRANSAK_ORDER_CREATED",
    TRANSAK_ORDER_SUCCESSFUL: "TRANSAK_ORDER_SUCCESSFUL",
    TRANSAK_ORDER_FAILED: "TRANSAK_ORDER_FAILED",
    TRANSAK_ORDER_CANCELLED: "TRANSAK_ORDER_CANCELLED",
    TRANSAK_WIDGET_CLOSE: "TRANSAK_WIDGET_CLOSE",
  };
  class Transak {
    static EVENTS = EVENTS;
    static on = (event: string, cb: (payload: unknown) => void) =>
      mockListeners.set(event, cb);
    init = mockInit;
    close = jest.fn();
    cleanup = jest.fn();
  }
  return { Transak };
});
let mockPrivyWallet: object | null = { wallet: "x" };
jest.mock("@/contexts/stellar-wallet-context", () => ({
  useStellarWallet: () => ({ privyWallet: mockPrivyWallet }),
}));
jest.mock("next/navigation", () => ({ usePathname: () => "/explore" }));

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig, useSWRConfig } from "swr";
import { resetTransakListenersForTests } from "@/hooks/useTransak";
import { FundingOnboardingProvider } from "@/components/wallet/funding/FundingOnboardingProvider";
import { FundWalletEntry } from "@/components/wallet/funding/FundWalletEntry";

const WALLET = `G${"CUSTODIAL".padEnd(55, "A")}`;
const UNFUNDED = {
  walletType: "custodial",
  address: WALLET,
  activated: false,
  balance: "0",
  eligible: true,
};
const FUNDED = {
  ...UNFUNDED,
  activated: true,
  balance: "20.0000000",
  eligible: false,
};

let status: object = UNFUNDED;
let revalidate: () => Promise<unknown> = async () => undefined;

function Capture() {
  const { mutate } = useSWRConfig();
  revalidate = () => mutate("/api/wallet/funding-status");
  return null;
}

function renderApp() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <FundingOnboardingProvider>
        <FundWalletEntry />
        <Capture />
      </FundingOnboardingProvider>
    </SWRConfig>
  );
}

function emit(event: string, payload: unknown = { status: { id: "order-1" } }) {
  act(() => mockListeners.get(event)?.(payload));
}

async function goToTransak(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText("You have a StreamFi wallet");
  await user.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByText("What is XLM?")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByText("How to add funds")).toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Add funds with Transak" })
  );
  await waitFor(() => expect(mockInit).toHaveBeenCalledTimes(1));
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_TRANSAK_API_KEY = "sentinel-transak-key";
  mockPrivyWallet = { wallet: WALLET };
  status = UNFUNDED;
  window.localStorage.clear();
  resetTransakListenersForTests();
  mockListeners.clear();
  mockInit.mockClear();
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => status,
  })) as unknown as typeof fetch;
});

it("guides a new custodial user to funding and only says funded once the balance shows it", async () => {
  const user = userEvent.setup();
  renderApp();
  await goToTransak(user);

  // The wizard steps aside while Transak's own window is open.
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  );

  emit("TRANSAK_ORDER_SUCCESSFUL");
  emit("TRANSAK_WIDGET_CLOSE", undefined);
  expect(
    await screen.findByText("Your purchase is on its way")
  ).toBeInTheDocument();
  expect(screen.queryByText("Your wallet is funded")).not.toBeInTheDocument();
  expect(screen.getByText(/You do not need to buy again/)).toBeInTheDocument();
  // No way to start a second purchase while this one is pending.
  expect(
    screen.queryByRole("button", { name: /Transak|Try again/ })
  ).not.toBeInTheDocument();
  expect(screen.getByText("Funding pending")).toBeInTheDocument();

  // The balance still shows nothing: still pending.
  await act(revalidate);
  expect(screen.getByText("Your purchase is on its way")).toBeInTheDocument();

  status = FUNDED;
  await act(revalidate);
  expect(await screen.findByText("Your wallet is funded")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Done" }));
  expect(screen.queryByText("Funding pending")).not.toBeInTheDocument();
  expect(screen.queryByText("Fund your wallet")).not.toBeInTheDocument();
});

it("keeps a pending purchase across a reload", async () => {
  const user = userEvent.setup();
  const { unmount } = renderApp();
  await goToTransak(user);
  emit("TRANSAK_ORDER_CREATED");
  emit("TRANSAK_WIDGET_CLOSE", undefined);
  await screen.findByText("Your purchase is on its way");
  unmount();

  renderApp();
  expect(await screen.findByText("Funding pending")).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("'Maybe later' closes the wizard and leaves a way back in", async () => {
  const user = userEvent.setup();
  renderApp();
  await screen.findByText("You have a StreamFi wallet");
  await user.click(screen.getByRole("button", { name: "Maybe later" }));

  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  );
  const entry = screen.getByText("Fund your wallet");
  await user.click(entry);
  expect(
    await screen.findByText("You have a StreamFi wallet")
  ).toBeInTheDocument();
});

it("does not prompt again on the next visit after deferring, but keeps the entry point", async () => {
  const user = userEvent.setup();
  const { unmount } = renderApp();
  await screen.findByText("You have a StreamFi wallet");
  await user.click(screen.getByRole("button", { name: "Maybe later" }));
  unmount();

  renderApp();
  expect(await screen.findByText("Fund your wallet")).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("treats closing Transak before ordering as abandoned and offers to continue", async () => {
  const user = userEvent.setup();
  renderApp();
  await goToTransak(user);
  emit("TRANSAK_WIDGET_CLOSE", undefined);

  expect(await screen.findByText("No purchase was made")).toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Continue with Transak" })
  );
  await waitFor(() => expect(mockInit).toHaveBeenCalledTimes(2));
});

it("explains a failed order without inventing a reason, and shows other ways to fund", async () => {
  const user = userEvent.setup();
  renderApp();
  await goToTransak(user);
  emit("TRANSAK_ORDER_FAILED");
  emit("TRANSAK_WIDGET_CLOSE", undefined);

  expect(
    await screen.findByText("Your purchase did not go through")
  ).toBeInTheDocument();
  expect(screen.getByText(/StreamFi cannot change them/)).toBeInTheDocument();
  expect(screen.getByTestId("wallet-address")).toHaveTextContent(WALLET);
  expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
});

it("says so when Transak cannot be opened", async () => {
  delete process.env.NEXT_PUBLIC_TRANSAK_API_KEY;
  const user = userEvent.setup();
  renderApp();
  await screen.findByText("You have a StreamFi wallet");
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.click(
    screen.getByRole("button", { name: "Add funds with Transak" })
  );
  expect(
    await screen.findByText("Adding funds is not available right now")
  ).toBeInTheDocument();
});

it("never targets a funded custodial wallet", async () => {
  status = FUNDED;
  renderApp();
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  await act(async () => undefined);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByText("Fund your wallet")).not.toBeInTheDocument();
});

it("never targets a connected (non-custodial) wallet", async () => {
  status = { walletType: "external", address: WALLET, eligible: false };
  renderApp();
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  await act(async () => undefined);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByText("Fund your wallet")).not.toBeInTheDocument();
});

it("does not even ask for a status without a Google (custodial-capable) sign-in", async () => {
  mockPrivyWallet = null;
  renderApp();
  await act(async () => undefined);
  expect(global.fetch).not.toHaveBeenCalled();
});
