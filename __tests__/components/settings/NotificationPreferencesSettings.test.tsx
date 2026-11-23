import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import NotificationSettings from "@/components/settings/notifications/NotificationSettings";
import { getDefaultPreferences } from "@/lib/notifications/preferences";

jest.mock("@privy-io/react-auth", () => ({
  usePrivy: () => ({ user: { id: "did:privy:test" }, authenticated: true }),
}));
jest.mock("@/hooks/useNotificationPreferences", () => ({
  useNotificationPreferences: jest.fn(),
}));

const {
  useNotificationPreferences,
} = require("@/hooks/useNotificationPreferences");
const mockUpdate = jest.fn();

describe("notification settings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useNotificationPreferences.mockReturnValue({
      preferences: getDefaultPreferences(
        "c0110000-0000-4000-8000-000000000001"
      ),
      isLoading: false,
      error: undefined,
      update: mockUpdate,
    });
    mockUpdate.mockResolvedValue(getDefaultPreferences("user"));
  });

  it("saves the clip-created setting using the canonical preference key", async () => {
    render(<NotificationSettings />);
    fireEvent.click(
      screen.getByRole("button", { name: /In-app Notifications/ })
    );
    fireEvent.click(screen.getByRole("switch", { name: "Clips Created" }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({
        notify_clip_created: false,
      });
    });
  });

  it("shows an error when saving a global unsubscribe fails", async () => {
    mockUpdate.mockRejectedValue(new Error("save failed"));

    render(<NotificationSettings />);
    fireEvent.click(
      screen.getByRole("button", { name: /Unsubscribe from all notifications/ })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to update notification preferences."
    );
  });
});
