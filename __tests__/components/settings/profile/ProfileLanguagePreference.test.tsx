import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProfileSettings from "@/components/settings/profile/profile-page";

jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: jest.fn(),
}));
jest.mock("@/hooks/useUserPreferences", () => ({
  useUserPreferences: jest.fn(),
}));
jest.mock("@/components/ui/toast-provider", () => ({
  useToast: jest.fn(),
}));
jest.mock("@/components/settings/profile/profile-header", () => ({
  ProfileHeader: () => null,
}));
jest.mock("@/components/settings/profile/basic-settings-section", () => ({
  BasicSettingsSection: () => null,
}));
jest.mock("@/components/settings/profile/social-links-section", () => ({
  SocialLinksSection: () => null,
}));
jest.mock("@/components/settings/profile/save-section", () => ({
  SaveSection: ({
    handleSaveChanges,
    uiState,
  }: {
    handleSaveChanges: () => void;
    uiState: { saveError: string };
  }) => (
    <>
      {uiState.saveError && <p>{uiState.saveError}</p>}
      <button type="button" onClick={handleSaveChanges}>
        Save profile
      </button>
    </>
  ),
}));

const { useAuth } = require("@/components/auth/auth-provider");
const { useUserPreferences } = require("@/hooks/useUserPreferences");
const { useToast } = require("@/components/ui/toast-provider");

describe("profile language preference", () => {
  const updateUserProfile = jest.fn();
  const updatePreferences = jest.fn();
  const showToast = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({
      user: {
        username: "creator",
        email: "creator@example.com",
        bio: "",
        wallet: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        emailVerified: true,
      },
      isLoading: false,
      updateUserProfile,
    });
    useUserPreferences.mockReturnValue({
      preferences: { language: "es" },
      isLoading: false,
      error: undefined,
      update: updatePreferences,
    });
    useToast.mockReturnValue({ showToast });
    updateUserProfile.mockResolvedValue({ success: true });
    updatePreferences.mockResolvedValue({ language: "fr" });
  });

  it("loads the saved language code and persists a changed code with profile Save", async () => {
    render(<ProfileSettings />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Select language" })
      ).toHaveTextContent("Spanish");
    });

    fireEvent.click(screen.getByRole("button", { name: "Select language" }));
    fireEvent.click(screen.getByRole("button", { name: "French" }));
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => {
      expect(updatePreferences).toHaveBeenCalledWith({ language: "fr" });
    });
    expect(updateUserProfile).toHaveBeenCalledWith(
      expect.not.objectContaining({ language: expect.anything() })
    );
  });

  it("does not show overall success if the language write fails after profile save", async () => {
    updatePreferences.mockRejectedValue(new Error("preference write failed"));

    render(<ProfileSettings />);
    await waitFor(() =>
      expect(screen.getByText("Spanish")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "Select language" }));
    fireEvent.click(screen.getByRole("button", { name: "French" }));
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Profile was updated, but the language preference could not be saved."
        )
      ).toBeInTheDocument();
    });
    expect(showToast).toHaveBeenCalledWith(
      "Profile was updated, but the language preference could not be saved.",
      "error"
    );
    expect(showToast).not.toHaveBeenCalledWith(
      "Profile updated successfully!",
      "success"
    );
  });
});
