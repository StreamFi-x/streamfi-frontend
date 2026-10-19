/**
 * Tests for StreamControls component - focusing on diagnostics integration
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import StreamControls from "@/components/dashboard/stream-manager/StreamControls";

// Mock dependencies
jest.mock("@/contexts/stellar-wallet-context", () => ({
  useStellarWallet: jest.fn().mockReturnValue({
    publicKey: "0x1234567890",
  }),
}));

jest.mock("@/hooks/useDiagnostics", () => ({
  useDiagnostics: jest.fn().mockReturnValue({
    results: null,
    guidance: [],
    summary: "",
    isLoading: false,
    error: null,
    timestamp: null,
    run: jest.fn(),
    reset: jest.fn(),
  }),
}));

jest.mock("@/components/dashboard/stream-manager/PreflightDiagnosticsPanel", () => {
  return function MockPanel() {
    return <div data-testid="diagnostics-panel">Diagnostics Panel</div>;
  };
});

jest.mock("@/components/ui/button", () => {
  return function MockButton({ children, ...props }: any) {
    return (
      <button {...props} data-testid="button">
        {children}
      </button>
    );
  };
});

jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock fetch
global.fetch = jest.fn();

const { useDiagnostics } = require("@/hooks/useDiagnostics");
const { useStellarWallet } = require("@/contexts/stellar-wallet-context");

describe("StreamControls - Diagnostics Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    useDiagnostics.mockReturnValue({
      results: null,
      guidance: [],
      summary: "",
      isLoading: false,
      error: null,
      timestamp: null,
      run: jest.fn(),
      reset: jest.fn(),
    });
  });

  describe("diagnostics button visibility", () => {
    it("shows diagnostics button when offline", () => {
      render(<StreamControls isLive={false} />);
      expect(screen.getByText(/Pre-Flight Diagnostics/)).toBeInTheDocument();
    });

    it("hides diagnostics button when live", () => {
      render(<StreamControls isLive={true} />);
      expect(screen.queryByText(/Pre-Flight Diagnostics/)).not.toBeInTheDocument();
    });
  });

  describe("diagnostics panel toggle", () => {
    it("shows panel when diagnostics button clicked", () => {
      render(<StreamControls isLive={false} />);
      const button = screen.getByText(/Run Pre-Flight Diagnostics/);
      fireEvent.click(button);
      expect(screen.getByTestId("diagnostics-panel")).toBeInTheDocument();
    });

    it("hides panel when button clicked again", () => {
      render(<StreamControls isLive={false} />);
      const button = screen.getByText(/Run Pre-Flight Diagnostics/);
      fireEvent.click(button);
      expect(screen.getByTestId("diagnostics-panel")).toBeInTheDocument();
      fireEvent.click(button);
      expect(screen.queryByTestId("diagnostics-panel")).not.toBeInTheDocument();
    });

    it("panel is hidden while stream is live", () => {
      render(<StreamControls isLive={false} />);
      const button = screen.getByText(/Run Pre-Flight Diagnostics/);
      fireEvent.click(button);
      expect(screen.getByTestId("diagnostics-panel")).toBeInTheDocument();

      // Change to live
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: "Stream started",
            streamData: {},
          })
        )
      );

      const startButton = screen.getByText("Start Stream");
      fireEvent.click(startButton);

      waitFor(() => {
        expect(screen.queryByTestId("diagnostics-panel")).not.toBeInTheDocument();
      });
    });
  });

  describe("diagnostics warning badge", () => {
    it("shows warning badge for marginal health", () => {
      useDiagnostics.mockReturnValue({
        results: {
          bitrate: { target: 5000, actual: 4400, variance: 12, stability: "marginal" },
          frames: { total: 100, dropped: 0, dropRate: 0 },
          keyframes: { interval: 2000, expectedInterval: 2000, compliant: true },
          networkQuality: { latency: 25, jitter: 5, packetLoss: 0 },
          health: { status: "marginal", confidence: 0.8 },
          timestamp: new Date().toISOString(),
        },
        guidance: [],
        summary: "Bitrate is marginal",
        isLoading: false,
        error: null,
        timestamp: new Date().toISOString(),
        run: jest.fn(),
        reset: jest.fn(),
      });

      render(<StreamControls isLive={false} />);
      expect(screen.getByText(/Stream Health: marginal/)).toBeInTheDocument();
      expect(screen.getByText("Bitrate is marginal")).toBeInTheDocument();
    });

    it("shows error badge for poor health", () => {
      useDiagnostics.mockReturnValue({
        results: {
          bitrate: { target: 5000, actual: 2500, variance: 50, stability: "poor" },
          frames: { total: 100, dropped: 10, dropRate: 10 },
          keyframes: { interval: 2000, expectedInterval: 2000, compliant: true },
          networkQuality: { latency: 25, jitter: 5, packetLoss: 0 },
          health: { status: "poor", confidence: 0.6 },
          timestamp: new Date().toISOString(),
        },
        guidance: [],
        summary: "Stream has issues",
        isLoading: false,
        error: null,
        timestamp: new Date().toISOString(),
        run: jest.fn(),
        reset: jest.fn(),
      });

      render(<StreamControls isLive={false} />);
      expect(screen.getByText(/Stream Health: poor/)).toBeInTheDocument();
      expect(screen.getByText("Stream has issues")).toBeInTheDocument();
    });

    it("does not show badge for good health", () => {
      useDiagnostics.mockReturnValue({
        results: {
          bitrate: { target: 5000, actual: 5000, variance: 0, stability: "excellent" },
          frames: { total: 100, dropped: 0, dropRate: 0 },
          keyframes: { interval: 2000, expectedInterval: 2000, compliant: true },
          networkQuality: { latency: 25, jitter: 5, packetLoss: 0 },
          health: { status: "good", confidence: 0.95 },
          timestamp: new Date().toISOString(),
        },
        guidance: [],
        summary: "All good",
        isLoading: false,
        error: null,
        timestamp: new Date().toISOString(),
        run: jest.fn(),
        reset: jest.fn(),
      });

      render(<StreamControls isLive={false} />);
      expect(screen.queryByText(/Stream Health/)).not.toBeInTheDocument();
    });

    it("badge has clickable link to show details", () => {
      useDiagnostics.mockReturnValue({
        results: {
          bitrate: { target: 5000, actual: 4400, variance: 12, stability: "marginal" },
          frames: { total: 100, dropped: 0, dropRate: 0 },
          keyframes: { interval: 2000, expectedInterval: 2000, compliant: true },
          networkQuality: { latency: 25, jitter: 5, packetLoss: 0 },
          health: { status: "marginal", confidence: 0.8 },
          timestamp: new Date().toISOString(),
        },
        guidance: [],
        summary: "Bitrate is marginal",
        isLoading: false,
        error: null,
        timestamp: new Date().toISOString(),
        run: jest.fn(),
        reset: jest.fn(),
      });

      render(<StreamControls isLive={false} />);
      const detailsLink = screen.getByText("View Details →");
      fireEvent.click(detailsLink);
      expect(screen.getByTestId("diagnostics-panel")).toBeInTheDocument();
    });
  });

  describe("non-blocking behavior", () => {
    it("allows starting stream despite poor diagnostics", async () => {
      useDiagnostics.mockReturnValue({
        results: {
          bitrate: { target: 5000, actual: 2500, variance: 50, stability: "poor" },
          frames: { total: 100, dropped: 10, dropRate: 10 },
          keyframes: { interval: 2000, expectedInterval: 2000, compliant: true },
          networkQuality: { latency: 25, jitter: 5, packetLoss: 0 },
          health: { status: "poor", confidence: 0.6 },
          timestamp: new Date().toISOString(),
        },
        guidance: [],
        summary: "Stream has issues",
        isLoading: false,
        error: null,
        timestamp: new Date().toISOString(),
        run: jest.fn(),
        reset: jest.fn(),
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: "Stream started",
            streamData: { isLive: true },
          })
        )
      );

      render(<StreamControls isLive={false} />);

      // Warning badge is shown but Start button is enabled
      expect(screen.getByText(/Stream Health: poor/)).toBeInTheDocument();

      const startButton = screen.getByText("Start Stream");
      expect(startButton).not.toBeDisabled();

      fireEvent.click(startButton);
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/streams/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: "0x1234567890" }),
        });
      });
    });

    it("start button is always enabled regardless of diagnostics", async () => {
      render(<StreamControls isLive={false} />);

      const startButton = screen.getByText("Start Stream");
      expect(startButton).not.toBeDisabled();
    });
  });

  describe("controls remain functional", () => {
    it("start stream button works normally", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: "Stream started",
            streamData: { isLive: true },
          })
        )
      );

      render(<StreamControls isLive={false} />);

      const startButton = screen.getByText("Start Stream");
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/streams/start",
          expect.any(Object)
        );
      });
    });

    it("stop stream button works when live", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: "Stream stopped",
          })
        )
      );

      render(<StreamControls isLive={true} />);

      const stopButton = screen.getByText("Stop Stream");
      fireEvent.click(stopButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/streams/start",
          expect.any(Object)
        );
      });
    });
  });

  describe("layout integration", () => {
    it("renders badge before stream controls when diagnostics shown", () => {
      useDiagnostics.mockReturnValue({
        results: {
          bitrate: { target: 5000, actual: 4400, variance: 12, stability: "marginal" },
          frames: { total: 100, dropped: 0, dropRate: 0 },
          keyframes: { interval: 2000, expectedInterval: 2000, compliant: true },
          networkQuality: { latency: 25, jitter: 5, packetLoss: 0 },
          health: { status: "marginal", confidence: 0.8 },
          timestamp: new Date().toISOString(),
        },
        guidance: [],
        summary: "Bitrate is marginal",
        isLoading: false,
        error: null,
        timestamp: new Date().toISOString(),
        run: jest.fn(),
        reset: jest.fn(),
      });

      const { container } = render(<StreamControls isLive={false} />);

      // Badge and controls should exist
      expect(screen.getByText(/Stream Health: marginal/)).toBeInTheDocument();
      expect(screen.getByText("Stream Controls")).toBeInTheDocument();
    });
  });
});
