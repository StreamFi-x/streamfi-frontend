import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CategoryDetailPage from "@/app/browse/category/[title]/page";
import { toast } from "sonner";

jest.mock("next/navigation", () => ({
  useParams: () => ({ title: "gaming" }),
}));

jest.mock("swr", () => ({
  __esModule: true,
  default: () => ({
    data: { streams: [] },
    isLoading: false,
    error: null,
  }),
}));

jest.mock("@/contexts/stellar-wallet-context", () => ({
  useStellarWallet: () => ({
    address: null,
    isConnected: false,
  }),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
  },
}));

describe("CategoryDetailPage Follow Button (#1870)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "cat-1",
        title: "Gaming",
        description: "Gaming category description",
        thumbnailUrl: "/gaming.png",
        tags: ["action", "rpg"],
      }),
    } as any);
  });

  it("renders Follow button and toggles state with notification on click", async () => {
    render(<CategoryDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("gaming");
    });

    const followButton = screen.getByRole("button", { name: /Follow category/i });
    expect(followButton).toHaveTextContent("Follow");

    // Click to follow
    fireEvent.click(followButton);

    expect(followButton).toHaveTextContent("Following");
    expect(toast.success).toHaveBeenCalledWith("Following gaming");

    // Click to unfollow
    fireEvent.click(followButton);

    expect(followButton).toHaveTextContent("Follow");
    expect(toast.success).toHaveBeenCalledWith("Unfollowed gaming");
  });
});
