import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { AvatarUploadModal } from "@/components/ui/avatar-upload-modal";
import ProfileModal from "@/components/explore/ProfileModal";
import { PROFILE_ICONS } from "@/lib/profile-icons";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock("@/contexts/stellar-wallet-context", () => ({
  useStellarWallet: () => ({
    publicKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  }),
}));

describe("AvatarUploadModal (#1733)", () => {
  const createObjectURLMock = jest.fn();
  const revokeObjectURLMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    let counter = 0;
    createObjectURLMock.mockImplementation(() => `blob:mock-url-${++counter}`);
    URL.createObjectURL = createObjectURLMock;
    URL.revokeObjectURL = revokeObjectURLMock;
  });

  it("selects a preset avatar and calls onSaveAvatar and onClose", () => {
    const onClose = jest.fn();
    const onSaveAvatar = jest.fn();

    render(
      <AvatarUploadModal
        isOpen={true}
        currentAvatar={PROFILE_ICONS[0]}
        onClose={onClose}
        onSaveAvatar={onSaveAvatar}
        avatarOptions={PROFILE_ICONS}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Select avatar option 2" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(onSaveAvatar).toHaveBeenCalledWith(PROFILE_ICONS[1]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("revokes object URLs on replacement, preset selection, and unmount (no leaks)", () => {
    const onClose = jest.fn();
    const onSaveAvatar = jest.fn();

    const { unmount } = render(
      <AvatarUploadModal
        isOpen={true}
        currentAvatar={PROFILE_ICONS[0]}
        onClose={onClose}
        onSaveAvatar={onSaveAvatar}
        avatarOptions={PROFILE_ICONS}
      />
    );

    const fileInput = screen.getByLabelText("Upload avatar image");

    const file1 = new File(["img1"], "avatar1.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file1] } });
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLMock).not.toHaveBeenCalled();

    // Selecting a second file revokes the first object URL
    const file2 = new File(["img2"], "avatar2.jpeg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file2] } });
    expect(createObjectURLMock).toHaveBeenCalledTimes(2);
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:mock-url-1");

    // Switching back to a preset revokes the second object URL
    fireEvent.click(
      screen.getByRole("button", { name: "Select avatar option 3" })
    );
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:mock-url-2");

    // Uploading another file and unmounting revokes it on cleanup
    const file3 = new File(["img3"], "avatar3.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file3] } });
    unmount();
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:mock-url-3");
  });

  it("rejects unsupported file types and oversized files with inline errors", () => {
    const onClose = jest.fn();
    const onSaveAvatar = jest.fn();

    render(
      <AvatarUploadModal
        isOpen={true}
        currentAvatar={PROFILE_ICONS[0]}
        onClose={onClose}
        onSaveAvatar={onSaveAvatar}
        maxSizeBytes={1024}
      />
    );

    const fileInput = screen.getByLabelText("Upload avatar image");

    const invalidTypeFile = new File(["pdf"], "doc.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(fileInput, { target: { files: [invalidTypeFile] } });
    expect(screen.getByRole("alert")).toHaveTextContent(
      /JPEG, PNG, GIF, or WebP/i
    );
    expect(createObjectURLMock).not.toHaveBeenCalled();

    const oversizedFile = new File([new Uint8Array(2048)], "large.png", {
      type: "image/png",
    });
    fireEvent.change(fileInput, { target: { files: [oversizedFile] } });
    expect(screen.getByRole("alert")).toHaveTextContent(
      /File size cannot exceed/i
    );
    expect(createObjectURLMock).not.toHaveBeenCalled();
  });

  it("closes when pressing Escape", () => {
    const onClose = jest.fn();
    render(
      <AvatarUploadModal
        isOpen={true}
        currentAvatar={PROFILE_ICONS[0]}
        onClose={onClose}
        onSaveAvatar={jest.fn()}
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("is integrated into the onboarding ProfileModal flow", () => {
    render(
      <ProfileModal
        isOpen={true}
        currentStep="profile"
        onClose={jest.fn()}
        onNextStep={jest.fn()}
        setIsProfileModalOpen={jest.fn()}
        mode="privy"
        privyEmail="newuser@example.com"
      />
    );

    const trigger = screen.getByRole("button", { name: /Choose Avatar/i });
    fireEvent.click(trigger);

    expect(
      screen.getByRole("dialog", { name: /Choose Your Avatar/i })
    ).toBeInTheDocument();
  });
});
