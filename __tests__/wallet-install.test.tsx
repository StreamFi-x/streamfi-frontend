import { fireEvent, render, screen } from "@testing-library/react";
import ConnectWalletModal from "@/components/connectWallet";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("@/hooks/usePrivyAuth", () => ({
  usePrivyAuth: () => ({ ready: true, authenticated: false }),
}));
jest.mock("@/lib/session-replay", () => ({
  sessionReplay: { addBreadcrumb: jest.fn() },
}));
jest.mock("@/contexts/stellar-wallet-context", () => ({
  useStellarWallet: jest.fn(),
}));

it("shows the install link for an unavailable wallet with a differently worded error", async () => {
  const state = {
    isConnected: false,
    isLoading: false,
    isConnecting: false,
    connectWallet: jest.fn().mockResolvedValue(undefined),
    error: null as string | null,
    unavailableWalletId: null as string | null,
  };
  jest
    .mocked(useStellarWallet)
    .mockImplementation(() => state as ReturnType<typeof useStellarWallet>);
  const modal = (
    <ConnectWalletModal isModalOpen setIsModalOpen={jest.fn()} walletsOnly />
  );
  const { rerender } = render(modal);
  fireEvent.click(screen.getByRole("button", { name: /Freighter/i }));
  expect(state.connectWallet).toHaveBeenCalledWith("freighter");
  state.error = "Provider returned code 831";
  state.unavailableWalletId = "freighter";
  rerender(
    <ConnectWalletModal isModalOpen setIsModalOpen={jest.fn()} walletsOnly />
  );
  expect(
    await screen.findByRole("link", { name: "Install Freighter" })
  ).toHaveAttribute("href", "https://freighter.app/");
});
