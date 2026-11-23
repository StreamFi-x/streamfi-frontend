import { render, screen } from "@testing-library/react";
import StreamPreview from "@/components/dashboard/stream-manager/StreamPreview";

jest.mock("@/contexts/stellar-wallet-context", () => ({
  useStellarWallet: () => ({ publicKey: null, privyWallet: null }),
}));
jest.mock("@/hooks/useStreamData", () => ({
  useStreamData: () => ({ streamData: null, isLoading: false }),
}));
jest.mock("@/hooks/useChat", () => ({
  useChat: () => ({ messages: [], sendMessage: jest.fn(), isSending: false }),
}));
jest.mock("@/components/MuxPlayerLazy", () => () => null);

describe("StreamPreview settings action", () => {
  it("does not render a settings button when no preview settings panel exists", () => {
    render(<StreamPreview />);

    expect(
      screen.queryByRole("button", { name: /settings/i })
    ).not.toBeInTheDocument();
  });
});
