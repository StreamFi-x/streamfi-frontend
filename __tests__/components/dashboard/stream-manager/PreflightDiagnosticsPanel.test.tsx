/**
 * Tests for PreflightDiagnosticsPanel component
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PreflightDiagnosticsPanel from "@/components/dashboard/stream-manager/PreflightDiagnosticsPanel";

// Mock the hook
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

// Mock sonner toast
jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock UI components
jest.mock("@/components/ui/button", () => {
  return function MockButton({ children, ...props }: any) {
    return (
      <button {...props} data-testid="button">
        {children}
      </button>
    );
  };
});

const { useDiagnostics } = require("@/hooks/useDiagnostics");
const { toast } = require("sonner");

describe("PreflightDiagnosticsPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  describe("rendering", () => {
    it("renders the component", () => {
      render(<PreflightDiagnosticsPanel />);
      expect(screen.getByText("Pre-Flight Diagnostics")).toBeInTheDocument();
    });

    it("displays collapsible header", () => {
      render(<PreflightDiagnosticsPanel />);
      expect(screen.getByText("Test your stream settings before going live")).toBeInTheDocument();
    });

    it("is expanded by default", () => {
      render(<PreflightDiagnosticsPanel />);
      expect(screen.getByText("Bitrate (kbps)")).toBeInTheDocument();
    });
  });

  describe("collapsing/expanding", () => {
    it("collapses when header is clicked", () => {
      render(<PreflightDiagnosticsPanel />);

      const header = screen.getByText("Pre-Flight Diagnostics").closest("div");
      fireEvent.click(header!);

      expect(screen.queryByText("Bitrate (kbps)")).not.toBeInTheDocument();
    });

    it("expands when header is clicked again", () => {
      render(<PreflightDiagnosticsPanel />);

      const header = screen.getByText("Pre-Flight Diagnostics").closest("div");
      fireEvent.click(header!);
      expect(screen.queryByText("Bitrate (kbps)")).not.toBeInTheDocument();

      fireEvent.click(header!);
      expect(screen.getByText("Bitrate (kbps)")).toBeInTheDocument();
    });
  });

  describe("encoder settings form", () => {
    it("has bitrate input with default value", () => {
      render(<PreflightDiagnosticsPanel />);
      const bitrateInput = screen.getByPlaceholderText("5000") as HTMLInputElement;
      expect(bitrateInput.value).toBe("5000");
    });

    it("has resolution with default value", () => {
      render(<PreflightDiagnosticsPanel />);
      const resolutionInput = screen.getByPlaceholderText("1920x1080") as HTMLInputElement;
      expect(resolutionInput.value).toBe("1920x1080");
    });

    it("has keyframe interval input", () => {
      render(<PreflightDiagnosticsPanel />);
      const keyframeInput = screen.getByPlaceholderText("2000") as HTMLInputElement;
      expect(keyframeInput.value).toBe("2000");
    });

    it("allows changing bitrate", () => {
      render(<PreflightDiagnosticsPanel />);
      const bitrateInputs = screen.getAllByPlaceholderText("5000");
      const bitrateInput = bitrateInputs[0] as HTMLInputElement;

      fireEvent.change(bitrateInput, { target: { value: "6000" } });
      expect(bitrateInput.value).toBe("6000");
    });

    it("allows changing resolution with preset buttons", () => {
      render(<PreflightDiagnosticsPanel />);
      const button720p = screen.getByText("1280x720");

      fireEvent.click(button720p);

      const resolutionInputs = screen.getAllByPlaceholderText("1920x1080");
      const resolutionInput = resolutionInputs[0] as HTMLInputElement;
      expect(resolutionInput.value).toBe("1280x720");
    });

    it("has preset resolution buttons", () => {
      render(<PreflightDiagnosticsPanel />);
      expect(screen.getByText("1280x720")).toBeInTheDocument();
      expect(screen.getByText("1920x1080")).toBeInTheDocument();
      expect(screen.getByText("3840x2160")).toBeInTheDocument();
    });
  });

  describe("validation", () => {
    it("shows error for invalid bitrate (zero)", async () => {
      render(<PreflightDiagnosticsPanel />);
      const bitrateInputs = screen.getAllByDisplayValue("5000");
      const bitrateInput = bitrateInputs[0] as HTMLInputElement;

      fireEvent.change(bitrateInput, { target: { value: "0" } });
      const runButton = screen.getByText("Run Diagnostics");
      fireEvent.click(runButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining("must be between")
        );
      });
    });

    it("shows error for invalid resolution", async () => {
      render(<PreflightDiagnosticsPanel />);
      const resolutionInputs = screen.getAllByDisplayValue("1920x1080");
      const resolutionInput = resolutionInputs[0] as HTMLInputElement;

      fireEvent.change(resolutionInput, { target: { value: "invalid" } });
      const runButton = screen.getByText("Run Diagnostics");
      fireEvent.click(runButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("WIDTHxHEIGHT"));
      });
    });

    it("shows error for invalid keyframe interval", async () => {
      render(<PreflightDiagnosticsPanel />);
      const keyframeInputs = screen.getAllByDisplayValue("2000");
      const keyframeInput = keyframeInputs[0] as HTMLInputElement;

      fireEvent.change(keyframeInput, { target: { value: "0" } });
      const runButton = screen.getByText("Run Diagnostics");
      fireEvent.click(runButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("positive"));
      });
    });
  });

  describe("running diagnostics", () => {
    it("calls run function with encoder settings", async () => {
      const mockRun = jest.fn().mockResolvedValue(undefined);
      useDiagnostics.mockReturnValue({
        results: null,
        guidance: [],
        summary: "",
        isLoading: false,
        error: null,
        timestamp: null,
        run: mockRun,
        reset: jest.fn(),
      });

      render(<PreflightDiagnosticsPanel />);
      const runButton = screen.getByText("Run Diagnostics");
      fireEvent.click(runButton);

      await waitFor(() => {
        expect(mockRun).toHaveBeenCalledWith({
          bitrate: 5000,
          resolution: "1920x1080",
          keyframeIntervalMs: 2000,
        });
      });
    });

    it("shows loading state while running", () => {
      useDiagnostics.mockReturnValue({
        results: null,
        guidance: [],
        summary: "",
        isLoading: true,
        error: null,
        timestamp: null,
        run: jest.fn(),
        reset: jest.fn(),
      });

      render(<PreflightDiagnosticsPanel />);
      expect(screen.getByText("Running diagnostics...")).toBeInTheDocument();
    });

    it("disables inputs while running", () => {
      useDiagnostics.mockReturnValue({
        results: null,
        guidance: [],
        summary: "",
        isLoading: true,
        error: null,
        timestamp: null,
        run: jest.fn(),
        reset: jest.fn(),
      });

      render(<PreflightDiagnosticsPanel />);
      const bitrateInput = screen.getByDisplayValue("5000") as HTMLInputElement;
      expect(bitrateInput.disabled).toBe(true);
    });
  });

  describe("displaying results", () => {
    it("displays diagnostic results when available", () => {
      const mockResults = {
        bitrate: { target: 5000, actual: 5000, variance: 0, stability: "excellent" },
        frames: { total: 100, dropped: 0, dropRate: 0 },
        keyframes: { interval: 2000, expectedInterval: 2000, compliant: true },
        networkQuality: { latency: 25, jitter: 5, packetLoss: 0 },
        health: { status: "good", confidence: 0.95 },
        timestamp: new Date().toISOString(),
      };

      useDiagnostics.mockReturnValue({
        results: mockResults,
        guidance: [],
        summary: "Stream is ready!",
        isLoading: false,
        error: null,
        timestamp: mockResults.timestamp,
        run: jest.fn(),
        reset: jest.fn(),
      });

      render(<PreflightDiagnosticsPanel />);
      expect(screen.getByText("Stream is ready!")).toBeInTheDocument();
      expect(screen.getByText("good")).toBeInTheDocument();
      expect(screen.getByText("95%")).toBeInTheDocument();
    });

    it("displays metrics in grid", () => {
      const mockResults = {
        bitrate: { target: 5000, actual: 4900, variance: 2, stability: "good" },
        frames: { total: 100, dropped: 1, dropRate: 1 },
        keyframes: { interval: 2000, expectedInterval: 2000, compliant: true },
        networkQuality: { latency: 30, jitter: 5, packetLoss: 0 },
        health: { status: "good", confidence: 0.9 },
        timestamp: new Date().toISOString(),
      };

      useDiagnostics.mockReturnValue({
        results: mockResults,
        guidance: [],
        summary: "OK",
        isLoading: false,
        error: null,
        timestamp: mockResults.timestamp,
        run: jest.fn(),
        reset: jest.fn(),
      });

      render(<PreflightDiagnosticsPanel />);
      expect(screen.getByText("4900 kbps")).toBeInTheDocument();
      expect(screen.getByText("1.00%")).toBeInTheDocument();
      expect(screen.getByText("30ms")).toBeInTheDocument();
    });

    it("displays guidance items", () => {
      const mockResults = {
        bitrate: { target: 5000, actual: 5000, variance: 0, stability: "excellent" },
        frames: { total: 100, dropped: 0, dropRate: 0 },
        keyframes: { interval: 2000, expectedInterval: 2000, compliant: true },
        networkQuality: { latency: 25, jitter: 5, packetLoss: 0 },
        health: { status: "good", confidence: 0.95 },
        timestamp: new Date().toISOString(),
      };

      useDiagnostics.mockReturnValue({
        results: mockResults,
        guidance: [
          { message: "Bitrate is stable", severity: "info" },
          { message: "No dropped frames", severity: "info" },
        ],
        summary: "All good",
        isLoading: false,
        error: null,
        timestamp: mockResults.timestamp,
        run: jest.fn(),
        reset: jest.fn(),
      });

      render(<PreflightDiagnosticsPanel />);
      expect(screen.getByText("Bitrate is stable")).toBeInTheDocument();
      expect(screen.getByText("No dropped frames")).toBeInTheDocument();
    });
  });

  describe("error handling", () => {
    it("displays error message when present", () => {
      useDiagnostics.mockReturnValue({
        results: null,
        guidance: [{ message: "Service unavailable", severity: "warning" }],
        summary: "",
        isLoading: false,
        error: "Network error occurred",
        timestamp: null,
        run: jest.fn(),
        reset: jest.fn(),
      });

      render(<PreflightDiagnosticsPanel />);
      expect(screen.getByText("Network error occurred")).toBeInTheDocument();
      expect(
        screen.getByText("You can still proceed to go live, but your setup may have issues.")
      ).toBeInTheDocument();
    });
  });

  describe("UI accessibility and messaging", () => {
    it("includes tip message about non-blocking nature", () => {
      render(<PreflightDiagnosticsPanel />);
      expect(screen.getByText(/Diagnostics never prevent you from going live/)).toBeInTheDocument();
    });

    it("has helpful placeholder text", () => {
      render(<PreflightDiagnosticsPanel />);
      expect(screen.getByText(/Match your encoder's bitrate setting/)).toBeInTheDocument();
      expect(screen.getByText(/Typically 2000ms for 30fps/)).toBeInTheDocument();
    });
  });
});
