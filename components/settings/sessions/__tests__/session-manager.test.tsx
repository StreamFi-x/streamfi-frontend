import { render, screen, waitFor } from "@testing-library/react";
import SessionManager from "../session-manager";

describe("SessionManager", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        sessions: [
          { id: "current", device_hint: "Safari on macOS", location: "Unknown location", last_seen_at: new Date().toISOString(), ip_address: null, is_current: true },
          { id: "other", device_hint: "Chrome on Windows", location: "Paris, France", last_seen_at: new Date().toISOString(), ip_address: "203.0.113.x", is_current: false },
        ],
        nextCursor: null,
      }),
    }) as jest.Mock;
  });

  it("distinguishes the current device and provides revocation for another device", async () => {
    render(<SessionManager />);
    await waitFor(() => expect(screen.getByText("This device")).toBeInTheDocument());
    expect(screen.getByText("Paris, France · 203.0.113.x")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign out Safari on macOS" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out Chrome on Windows" })).toBeInTheDocument();
  });
});