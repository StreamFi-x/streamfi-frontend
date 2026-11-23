import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { UserPreferencesForm } from "@/components/settings/UserPreferencesForm";
import { getDefaultPreferences } from "@/lib/notifications/preferences";

jest.mock("@/hooks/useUserPreferences", () => ({
  useUserPreferences: jest.fn(),
}));
jest.mock("@/hooks/useNotificationPreferences", () => ({
  useNotificationPreferences: jest.fn(),
}));
jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

const { useUserPreferences } = require("@/hooks/useUserPreferences");
const {
  useNotificationPreferences,
} = require("@/hooks/useNotificationPreferences");
const mockUpdateUserPreferences = jest.fn();
const mockUpdateNotificationPreferences = jest.fn();

describe("UserPreferencesForm notification settings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useUserPreferences.mockReturnValue({
      preferences: {
        user_id: "user",
        stream_quality: "auto",
        theme: "dark",
        language: "en",
        chat_font_size: "medium",
        show_timestamps: false,
        updated_at: "",
      },
      isLoading: false,
      update: mockUpdateUserPreferences,
    });
    useNotificationPreferences.mockReturnValue({
      preferences: getDefaultPreferences("user"),
      isLoading: false,
      error: undefined,
      update: mockUpdateNotificationPreferences,
    });
    mockUpdateNotificationPreferences.mockResolvedValue(
      getDefaultPreferences("user")
    );
  });

  it("writes the legacy clip control to the canonical notification preference", async () => {
    render(<UserPreferencesForm />);
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Notify when someone clips your stream",
      })
    );

    await waitFor(() => {
      expect(mockUpdateNotificationPreferences).toHaveBeenCalledWith({
        notify_clip_created: false,
      });
    });
    expect(mockUpdateUserPreferences).not.toHaveBeenCalled();
  });

  it("offers the same stable language codes as profile settings", () => {
    render(<UserPreferencesForm />);

    expect(screen.getByRole("option", { name: "Russian" })).toHaveValue("ru");
    expect(screen.getByRole("option", { name: "English" })).toHaveValue("en");
  });
});
