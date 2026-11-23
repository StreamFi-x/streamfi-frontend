import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import UserManagementPanel from "@/components/admin/UserManagementPanel";
import ReportReviewPanel from "@/components/admin/ReportReviewPanel";
import FeatureFlagsPanel from "@/components/admin/FeatureFlagsPanel";
import AdminSidebar from "@/components/admin/AdminSidebar";

const mockMutate = jest.fn();

jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
  useSWRConfig: () => ({ mutate: mockMutate }),
}));

jest.mock("next/navigation", () => ({
  usePathname: () => "/admin/users",
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={String(props.alt ?? "")} src={String(props.src ?? "")} />
  ),
}));

jest.mock("@/components/settings/privacy-and-security/step-up-dialog", () => ({
  __esModule: true,
  default: ({
    action,
    onApproved,
    onCancel,
  }: {
    action: string | null;
    resourceId: string;
    onApproved: (challengeId: string, action: string) => void;
    onCancel: () => void;
  }) =>
    action ? (
      <div data-testid="step-up-dialog">
        <button
          type="button"
          onClick={() => onApproved("challenge-123", action)}
        >
          Approve Step-Up
        </button>
        <button type="button" onClick={onCancel}>
          Cancel Step-Up
        </button>
      </div>
    ) : null,
}));

import useSWR from "swr";

const useSWRMock = useSWR as jest.Mock;

describe("Issue #1731: Admin Dashboard UI components", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  describe("AdminSidebar", () => {
    it("renders navigation items for Analytics, Users, Moderation, Categories, Feature Flags, Audit Log, and Session Replays", () => {
      render(<AdminSidebar isCollapsed={false} onToggle={jest.fn()} />);

      expect(screen.getByText("Analytics")).toBeInTheDocument();
      expect(screen.getByText("Users")).toBeInTheDocument();
      expect(screen.getByText("Moderation")).toBeInTheDocument();
      expect(screen.getByText("Categories")).toBeInTheDocument();
      expect(screen.getByText("Feature Flags")).toBeInTheDocument();
      expect(screen.getByText("Audit Log")).toBeInTheDocument();
      expect(screen.getByText("Session Replays")).toBeInTheDocument();
    });
  });

  describe("UserManagementPanel", () => {
    const sampleUsers = [
      {
        id: "user-1",
        username: "creator_one",
        avatar: null,
        email: "creator1@streamfi.media",
        is_live: true,
        is_banned: false,
        ban_reason: null,
        deleted_at: null,
        created_at: "2026-09-01T00:00:00.000Z",
        total_views: 1420,
      },
      {
        id: "user-2",
        username: "banned_user",
        avatar: null,
        email: "banned@streamfi.media",
        is_live: false,
        is_banned: true,
        ban_reason: "Spamming chat",
        deleted_at: null,
        created_at: "2026-08-15T00:00:00.000Z",
        total_views: 15,
      },
      {
        id: "user-3",
        username: "deleting_user",
        avatar: null,
        email: null,
        is_live: false,
        is_banned: false,
        ban_reason: null,
        deleted_at: "2026-09-10T00:00:00.000Z",
        created_at: "2026-07-01T00:00:00.000Z",
        total_views: 0,
      },
    ];

    beforeEach(() => {
      useSWRMock.mockImplementation((key: string | null) => {
        if (key && key.startsWith("/api/admin/users/deletions")) {
          return {
            data: {
              deletions: [
                {
                  id: "del-1",
                  user_id: "user-3",
                  username: "deleting_user",
                  status: "failed",
                  requested_at: "2026-09-10T00:00:00.000Z",
                  requested_by_type: "admin",
                  requested_by: "admin-1",
                  reason: "Terms violation",
                  purge_after: "2026-10-10T00:00:00.000Z",
                  legal_hold: false,
                  legal_hold_reason: null,
                  attempts: 5,
                  completed_steps: [],
                  last_error: "custodial wallet holds funds",
                  purged_at: null,
                },
              ],
            },
            isLoading: false,
          };
        }
        return {
          data: { users: sampleUsers, page: 1, limit: 20 },
          isLoading: false,
        };
      });
    });

    it("renders user list with status badges, ban reasons, and view counts", () => {
      render(<UserManagementPanel />);

      expect(screen.getByText("@creator_one")).toBeInTheDocument();
      expect(screen.getByText("creator1@streamfi.media")).toBeInTheDocument();
      expect(screen.getByText("1,420")).toBeInTheDocument();
      expect(screen.getByText("@banned_user")).toBeInTheDocument();
      expect(screen.getByText("Spamming chat")).toBeInTheDocument();
      expect(screen.getByText("Pending deletion")).toBeInTheDocument();
    });

    it("bans a user with step-up challenge verification via PATCH /api/admin/users/[userId]", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

      render(<UserManagementPanel />);

      fireEvent.click(screen.getByLabelText("Ban @creator_one"));
      expect(screen.getByText("Ban @creator_one?")).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText("Reason (optional)"), {
        target: { value: "Abusive stream content" },
      });
      fireEvent.click(screen.getByText("Ban User"));

      // Step-up dialog appears
      fireEvent.click(screen.getByText("Approve Step-Up"));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/admin/users/user-1",
          expect.objectContaining({
            method: "PATCH",
            headers: expect.objectContaining({
              "x-step-up-challenge": "challenge-123",
            }),
            body: JSON.stringify({
              action: "ban",
              reason: "Abusive stream content",
            }),
          })
        );
      });
    });

    it("cancels pending deletion via DELETE /api/admin/users/[userId]/deletion", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

      render(<UserManagementPanel />);

      fireEvent.click(
        screen.getByLabelText("Cancel deletion for @deleting_user")
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/admin/users/user-3/deletion",
          { method: "DELETE" }
        );
      });
    });

    it("switches to Deletion Queue and supports legal hold and retry purge actions", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      });

      render(<UserManagementPanel />);

      fireEvent.click(screen.getByText("Deletion Queue"));

      expect(screen.getByText("@deleting_user")).toBeInTheDocument();
      expect(
        screen.getByText("custodial wallet holds funds")
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /Legal Hold/i }));
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/admin/users/user-3/deletion",
          expect.objectContaining({
            method: "PATCH",
          })
        );
      });

      fireEvent.click(screen.getByRole("button", { name: /Retry Purge/i }));
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/admin/users/user-3/deletion",
          expect.objectContaining({
            method: "PATCH",
            body: JSON.stringify({ action: "retry" }),
          })
        );
      });
    });
  });

  describe("ReportReviewPanel", () => {
    const sampleStreamReports = [
      {
        id: "sr-1",
        reporter_id: "rep-1",
        is_anonymous: false,
        priority: "expedited",
        stream_id: "stream-99",
        streamer: "flagged_streamer",
        reason: "harassment",
        details: "Targeted harassment in live stream",
        status: "pending",
        created_at: "2026-09-20T12:00:00.000Z",
      },
    ];

    const sampleBugReports = [
      {
        id: "br-1",
        reporter_id: "rep-2",
        category: "Wallet Connection",
        description: "Freighter popup fails to resolve on Safari",
        severity: "critical",
        status: "pending",
        created_at: "2026-09-21T12:00:00.000Z",
      },
    ];

    beforeEach(() => {
      useSWRMock.mockImplementation((key: string | null) => {
        if (!key) {
          return { data: undefined, isLoading: false };
        }
        if (key === "/api/admin/reports/stream/sr-1") {
          return {
            data: {
              report: sampleStreamReports[0],
              flags: [
                {
                  signal: "volume_spike",
                  detail: { reportsInWindow: 14 },
                  created_at: "2026-09-20T12:00:00.000Z",
                },
              ],
            },
            isLoading: false,
          };
        }
        if (key.startsWith("/api/admin/reports/stream")) {
          return {
            data: { reports: sampleStreamReports, page: 1, limit: 20 },
            isLoading: false,
          };
        }
        if (key.startsWith("/api/admin/reports/bug")) {
          return {
            data: { reports: sampleBugReports, page: 1, limit: 20 },
            isLoading: false,
          };
        }
        return { data: undefined, isLoading: false };
      });
    });

    it("renders stream reports, displays expedited audit signals in detail view, and updates report status", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

      render(<ReportReviewPanel />);

      expect(screen.getByText("@flagged_streamer")).toBeInTheDocument();

      // Open detail modal
      fireEvent.click(screen.getByText("@flagged_streamer"));

      expect(
        screen.getByText("Targeted harassment in live stream")
      ).toBeInTheDocument();
      expect(screen.getByText("volume_spike")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Mark Reviewed"));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/admin/reports/stream/sr-1",
          expect.objectContaining({
            method: "PATCH",
            body: JSON.stringify({ status: "reviewed" }),
          })
        );
      });
    });

    it("switches to Bug Reports tab and resolves a bug report via PATCH /api/admin/reports/bug/[reportId]", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

      render(<ReportReviewPanel />);

      fireEvent.click(screen.getByText("Bug Reports"));

      expect(screen.getByText("Wallet Connection")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Resolve"));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/admin/reports/bug/br-1",
          expect.objectContaining({
            method: "PATCH",
            body: JSON.stringify({ status: "resolved" }),
          })
        );
      });
    });
  });

  describe("FeatureFlagsPanel", () => {
    beforeEach(() => {
      useSWRMock.mockReturnValue({
        data: {
          flags: [
            {
              key: "low_latency_player",
              description: "Enable Mux low-latency playback",
              enabled: true,
              rollout_percentage: 50,
              allowed_user_ids: [],
            },
          ],
        },
        isLoading: false,
      });
    });

    it("renders feature flags and toggles flag state via PATCH /api/admin/feature-flags", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flag: {} }),
      });

      render(<FeatureFlagsPanel />);

      expect(screen.getByText("low_latency_player")).toBeInTheDocument();
      expect(
        screen.getByText("Enable Mux low-latency playback")
      ).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText("Toggle low_latency_player"));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/admin/feature-flags",
          expect.objectContaining({
            method: "PATCH",
            body: JSON.stringify({
              key: "low_latency_player",
              enabled: false,
            }),
          })
        );
      });
    });
  });
});
