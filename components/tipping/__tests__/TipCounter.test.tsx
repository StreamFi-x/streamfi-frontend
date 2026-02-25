import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { TipCounter } from "../TipCounter";
import useSWR from "swr";

// Mock useSWR
jest.mock("swr", () => ({
    __esModule: true,
    default: jest.fn(),
    mutate: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

// Mock formatDistanceToNow
jest.mock("date-fns", () => ({
    formatDistanceToNow: jest.fn(() => "2 hours ago"),
}));

describe("TipCounter Component", () => {
    const mockStats = {
        totalReceived: "100.5000000",
        totalCount: 1500,
        lastTipAt: "2026-02-23T20:00:00Z",
        stellarPublicKey: "GABC12345678",
    };

    const mockPriceResponse = {
        data: { amount: "0.12" }
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (useSWR as jest.Mock).mockReturnValue({
            data: mockStats,
            error: null,
            isLoading: false,
            mutate: jest.fn(),
        });
        (global.fetch as jest.Mock).mockImplementation((url) => {
            if (typeof url === 'string' && url.includes("coinbase")) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockPriceResponse),
                });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ success: true }),
            });
        });
    });

    it("renders correctly in default variant", async () => {
        await act(async () => {
            render(<TipCounter username="testuser" variant="default" />);
        });

        expect(screen.getByText("100.5000000")).toBeInTheDocument();
        expect(screen.getByText("1.5K Tips")).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.getByText(/\$12\.06/, { exact: false })).toBeInTheDocument();
        });
    });

    it("renders correctly in compact variant", async () => {
        await act(async () => {
            render(<TipCounter username="testuser" variant="compact" />);
        });

        expect(screen.getByText("100.5000000")).toBeInTheDocument();
        expect(screen.getByText("1.5K tips")).toBeInTheDocument();
    });

    it("renders correctly in large variant", async () => {
        await act(async () => {
            render(<TipCounter username="testuser" variant="large" />);
        });

        expect(screen.getByText("Earnings Overview")).toBeInTheDocument();
        expect(screen.getByText("100.5000000")).toBeInTheDocument();
        expect(screen.getByText("1.5K")).toBeInTheDocument();
        expect(screen.getByText("Last tip received 2 hours ago")).toBeInTheDocument();
    });

    it("shows skeleton loading state", async () => {
        (useSWR as jest.Mock).mockReturnValue({
            data: null,
            error: null,
            isLoading: true,
        });

        await act(async () => {
            render(<TipCounter username="testuser" />);
        });
        expect(screen.queryByText("Total Received")).not.toBeInTheDocument();
    });

    it("shows error state", async () => {
        (useSWR as jest.Mock).mockReturnValue({
            data: undefined,
            error: new Error("API Error"),
            isLoading: false,
            mutate: jest.fn(),
        });

        await act(async () => {
            render(<TipCounter username="testuser" />);
        });
        expect(screen.getByText("API Error")).toBeInTheDocument();
    });

    it("shows empty state when no tips received", async () => {
        (useSWR as jest.Mock).mockReturnValue({
            data: { totalReceived: "0", totalCount: 0, stellarPublicKey: "G123" },
            error: null,
            isLoading: false,
        });

        await act(async () => {
            render(<TipCounter username="testuser" />);
        });
        expect(screen.getByText("No tips received yet.")).toBeInTheDocument();
    });

    it("handles copy to clipboard", async () => {
        const mockClipboard = {
            writeText: jest.fn(),
        };
        Object.assign(navigator, {
            clipboard: mockClipboard,
        });

        await act(async () => {
            render(<TipCounter username="testuser" variant="default" />);
        });

        const copyButton = screen.getByText("Copy Address");
        await act(async () => {
            fireEvent.click(copyButton);
        });

        expect(mockClipboard.writeText).toHaveBeenCalledWith("GABC12345678");
    });

    it("handles manual refresh", async () => {
        const mockMutate = jest.fn();
        (useSWR as jest.Mock).mockReturnValue({
            data: mockStats,
            error: null,
            isLoading: false,
            mutate: mockMutate,
        });

        await act(async () => {
            render(<TipCounter username="testuser" showRefreshButton={true} />);
        });

        const refreshButton = screen.getByRole("button", { name: /refresh stats/i });

        await act(async () => {
            fireEvent.click(refreshButton);
        });

        expect(global.fetch).toHaveBeenCalledWith(
            "/api/tips/refresh-total",
            expect.objectContaining({
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: "testuser" }),
            })
        );
        expect(mockMutate).toHaveBeenCalled();
    });

    it("calculates USD correctly", async () => {
        await act(async () => {
            render(<TipCounter username="testuser" variant="default" />);
        });

        await waitFor(() => {
            expect(screen.getByText(/\$12\.06/, { exact: false })).toBeInTheDocument();
        });
    });
});
