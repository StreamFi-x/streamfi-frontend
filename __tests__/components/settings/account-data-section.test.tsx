import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import AccountDataSection from "@/components/settings/account-data/AccountDataSection";
import SettingsNavigation from "@/components/settings/SettingsNavigation";

const mockShowToast = jest.fn();

jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({
    user: {
      id: "user_123",
      username: "alice",
      wallet: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    },
  }),
}));

jest.mock("@/contexts/stellar-wallet-context", () => ({
  useStellarWallet: () => ({
    publicKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    privyWallet: null,
  }),
}));

jest.mock("@/components/ui/toast-provider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock("next/navigation", () => ({
  usePathname: () => "/settings/account",
}));

describe("AccountDataSection (#1732)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("exposes Account & Data tab in SettingsNavigation", () => {
    render(<SettingsNavigation />);
    const link = screen.getByRole("link", { name: "Account & Data" });
    expect(link).toHaveAttribute("href", "/settings/account");
  });

  it("initiates a personal data export and displays download link once ready", async () => {
    jest.useFakeTimers();

    (global.fetch as jest.Mock)
      // Initial GET /api/users/me/deletion
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deletion: null, graceDays: 30 }),
      })
      // POST /api/routes-f/account-data-export
      .mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({ export_id: "acct_exp_1", status: "queued" }),
      })
      // Poll GET /api/routes-f/account-data-export?export_id=acct_exp_1
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "ready",
          download_url:
            "/api/routes-f/account-data-export/download/acct_exp_1.zip",
          emailed_at: "2026-11-20T18:00:00.000Z",
        }),
      });

    render(<AccountDataSection />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Request Data Export/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: /Request Data Export/i })
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Your data export has been queued/i)
      ).toBeInTheDocument();
    });

    await act(async () => {
      jest.advanceTimersByTime(1100);
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Your data export is ready/i)
      ).toBeInTheDocument();
    });

    const downloadLink = screen.getByRole("link", {
      name: /Download Data Archive/i,
    });
    expect(downloadLink).toHaveAttribute(
      "href",
      "/api/routes-f/account-data-export/download/acct_exp_1.zip"
    );
  });

  it("surfaces an error when data export request fails", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deletion: null, graceDays: 30 }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "Export service unavailable" }),
      });

    render(<AccountDataSection />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Request Data Export/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: /Request Data Export/i })
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Export service unavailable"
      );
    });
  });

  it("requires explicit username confirmation before finalizing account deletion", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deletion: null, graceDays: 14 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          status: "pending",
          purgeAfter: "2026-12-04T00:00:00.000Z",
          alreadyPending: false,
        }),
      });

    render(<AccountDataSection />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Delete Account/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Delete Account/i }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", {
      name: /Confirm Account Deletion/i,
    });
    expect(confirmBtn).toBeDisabled();

    // Typing wrong username keeps button disabled
    const input = screen.getByLabelText(/Type/i);
    fireEvent.change(input, { target: { value: "wronguser" } });
    expect(confirmBtn).toBeDisabled();

    // Typing exact username enables confirmation
    fireEvent.change(input, { target: { value: "alice" } });
    expect(confirmBtn).toBeEnabled();

    fireEvent.change(screen.getByLabelText(/Reason for leaving/i), {
      target: { value: "Taking a break" },
    });

    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/users/me/deletion",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            confirm: "alice",
            reason: "Taking a break",
          }),
        })
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Account deletion is pending/i)
      ).toBeInTheDocument();
    });
  });

  it("allows cancelling an existing pending account deletion", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          deletion: {
            status: "pending",
            requested_at: "2026-11-20T00:00:00.000Z",
            purge_after: "2026-12-20T00:00:00.000Z",
            cancelled_at: null,
          },
          graceDays: 30,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "cancelled" }),
      });

    render(<AccountDataSection />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Cancel Account Deletion/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: /Cancel Account Deletion/i })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/users/me/deletion",
        expect.objectContaining({ method: "DELETE" })
      );
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Delete Account/i })
      ).toBeInTheDocument();
    });
  });

  it("closes the deletion confirmation modal when Escape is pressed", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ deletion: null, graceDays: 30 }),
    });

    render(<AccountDataSection />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Delete Account/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Delete Account/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("displays an error when data export polling reports failure", async () => {
    jest.useFakeTimers();

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deletion: null, graceDays: 30 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({ export_id: "acct_exp_fail", status: "queued" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "failed",
          error: "Archive generation failed",
        }),
      });

    render(<AccountDataSection />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Request Data Export/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: /Request Data Export/i })
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Your data export has been queued/i)
      ).toBeInTheDocument();
    });

    await act(async () => {
      jest.advanceTimersByTime(1100);
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Archive generation failed"
      );
    });
  });

  it("stops polling after max attempts and lets user manually check status", async () => {
    jest.useFakeTimers();

    const fetchMock = global.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deletion: null, graceDays: 30 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({ export_id: "acct_exp_slow", status: "queued" }),
      });

    for (let i = 0; i < 20; i++) {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "queued" }),
      });
    }

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "ready",
        download_url:
          "/api/routes-f/account-data-export/download/acct_exp_slow.zip",
      }),
    });

    render(<AccountDataSection />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Request Data Export/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: /Request Data Export/i })
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Your data export has been queued/i)
      ).toBeInTheDocument();
    });

    for (let i = 0; i < 20; i++) {
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
    }

    await waitFor(() => {
      expect(
        screen.getByText(/Your data export is still being prepared/i)
      ).toBeInTheDocument();
    });

    const checkStatusBtn = screen.getByRole("button", {
      name: /Check Status/i,
    });
    fireEvent.click(checkStatusBtn);

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Download Data Archive/i })
      ).toHaveAttribute(
        "href",
        "/api/routes-f/account-data-export/download/acct_exp_slow.zip"
      );
    });
  });

  it("surfaces API errors when account deletion submission fails", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deletion: null, graceDays: 30 }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: "Username confirmation mismatch" }),
      });

    render(<AccountDataSection />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Delete Account/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Delete Account/i }));
    fireEvent.change(screen.getByLabelText(/Type/i), {
      target: { value: "alice" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Confirm Account Deletion/i })
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Username confirmation mismatch"
      );
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("surfaces API errors when cancelling a pending deletion fails", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          deletion: {
            status: "pending",
            requested_at: "2026-11-20T00:00:00.000Z",
            purge_after: "2026-12-20T00:00:00.000Z",
            cancelled_at: null,
          },
          graceDays: 30,
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "Unable to cancel deletion right now" }),
      });

    render(<AccountDataSection />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Cancel Account Deletion/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: /Cancel Account Deletion/i })
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Unable to cancel deletion right now"
      );
    });
  });
});
