import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CategoryDetailPage from "@/app/browse/category/[title]/page";

jest.mock("next/navigation", () => ({
  useParams: () => ({ title: "gaming" }),
  useSearchParams: () => new URLSearchParams(),
}));

const mockStreams = [
  {
    id: "stream-1",
    username: "user1",
    avatar: null,
    playbackId: "pb-1",
    title: "Alpha Stream",
    description: "test stream",
    category: "gaming",
    tags: ["game"],
    thumbnail: null,
    viewerCount: 10,
    totalViews: 50,
    isFollowing: false,
    streamStartedAt: "2026-11-20T10:00:00Z",
  },
  {
    id: "stream-2",
    username: "user2",
    avatar: null,
    playbackId: "pb-2",
    title: "Beta Stream",
    description: "test stream 2",
    category: "gaming",
    tags: ["game"],
    thumbnail: null,
    viewerCount: 500,
    totalViews: 1000,
    isFollowing: false,
    streamStartedAt: "2026-11-23T10:00:00Z",
  },
];

jest.mock("swr", () => ({
  __esModule: true,
  default: () => ({
    data: { streams: mockStreams },
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

jest.mock("@/components/shared/profile/StreamCard", () => {
  return function DummyStreamCard({ title, viewCount }: any) {
    return <div data-testid="stream-card" data-title={title} data-views={viewCount}>{title} - {viewCount}</div>;
  };
});

describe("CategoryDetailPage Sort Selection (#1869)", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "cat-1",
        title: "gaming",
        description: "Gaming category",
        thumbnailUrl: "/thumb.png",
        tags: ["game"],
      }),
    } as any);
  });

  it("sorts streams by viewer count when selectedSort is 'viewers'", async () => {
    render(<CategoryDetailPage />);

    await waitFor(() => {
      const cards = screen.getAllByTestId("stream-card");
      expect(cards.length).toBe(2);
      // Under default/recommended or viewers, higher viewer stream (Beta Stream: 500) comes before Alpha Stream (10)
      expect(cards[0]).toHaveAttribute("data-title", "Beta Stream");
      expect(cards[1]).toHaveAttribute("data-title", "Alpha Stream");
    });
  });
});
