"use client";
import { useEffect, useCallback, useState } from "react";
import type React from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { motion, AnimatePresence } from "framer-motion";
import profileImage from "@/public/Images/profile.png";
import Avatar from "@/public/icons/avatar.svg";
import VerificationPopup from "./popup";
import AvatarSelectionModal from "./avatar-modal";
import type {
  EditState,
  FormState,
  Platform,
  SocialLink,
  UIState,
} from "@/types/settings/profile";
import { ProfileHeader } from "./profile-header";
import { BasicSettingsSection } from "./basic-settings-section";

import { LanguageSection } from "./language-section";

import type { StaticImageData } from "next/image";
import { SocialLinksSection } from "./social-links-section";
import { SaveSection } from "./save-section";
import { useToast } from "@/components/ui/toast-provider";

export default function ProfileSettings() {
  const { user, isLoading, updateUserProfile } = useAuth();
  const avatarOptions = [Avatar, Avatar, Avatar, Avatar, Avatar];
  const { showToast } = useToast();

  const [avatar, setAvatar] = useState<StaticImageData | string | File>(
    profileImage
  );
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);

  const [usedPlatforms, setUsedPlatforms] = useState<Platform[]>([]);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const [formState, setFormState] = useState<FormState>({
    username: "",
    email: "",
    bio: "",
    wallet: "",
    socialLinkUrl: "",
    socialLinkTitle: "",
    language: "English",
  });

  // Edit state
  const [editState, setEditState] = useState<EditState>({
    editingLink: "",
    editingTitle: "",
    isEditing: false,
    editingIndex: null,
  });

  // UI state
  const [uiState, setUiState] = useState<UIState>({
    focusedInput: null,
    showVerificationPopup: false,
    showAvatarModal: false,
    showLanguageModal: false,
    isSaving: false,
    saveSuccess: false,
    saveError: "",
    duplicateUrlError: false,
  });

  const detectPlatformFromUrl = useCallback((url: string): Platform | null => {
    if (!url) return null;

    const domain = url.toLowerCase();
    if (domain.includes("instagram")) return "instagram";
    if (domain.includes("twitter") || domain.includes("x.com"))
      return "twitter";
    if (domain.includes("facebook") || domain.includes("fb.com"))
      return "facebook";
    if (domain.includes("youtube") || domain.includes("youtu.be"))
      return "youtube";
    if (domain.includes("telegram") || domain.includes("t.me"))
      return "telegram";
    if (domain.includes("discord")) return "discord";
    if (domain.includes("tiktok")) return "tiktok";
    return "other";
  }, []);

  // Convert backend social links format to frontend format
  const convertBackendSocialLinks = useCallback(
    (backendLinks: any): SocialLink[] => {
      if (!backendLinks) {
        return [];
      }

      try {
        // Handle both string and object formats
        const linksData =
          typeof backendLinks === "string"
            ? JSON.parse(backendLinks)
            : backendLinks;

        if (Array.isArray(linksData)) {
          // Handle array format (from types/user.ts SocialLink[])
          return linksData.map(link => ({
            url: link.socialLink || "",
            title: link.socialTitle || "Social Link",
            platform:
              detectPlatformFromUrl(link.socialLink || "") ||
              ("other" as Platform),
          }));
        } else if (typeof linksData === "object") {
          // Handle Record<string, string> format
          return Object.entries(linksData).map(([platform, url]) => ({
            url: url as string,
            title: platform.charAt(0).toUpperCase() + platform.slice(1),
            platform: platform as Platform,
          }));
        }
      } catch (error) {
        console.error("Error parsing social links:", error);
      }

      return [];
    },
    [detectPlatformFromUrl]
  );

  // Convert frontend social links format to backend format
  const convertToBackendFormat = useCallback(
    (frontendLinks: SocialLink[]): Record<string, string> => {
      // Convert to the format expected by the backend
      const backendFormat: Record<string, string> = {};
      frontendLinks.forEach(link => {
        // Use the platform as key and URL as value
        // If multiple links have same platform, the last one will overwrite the previous
        backendFormat[link.platform] = link.url;
      });
      return backendFormat;
    },
    []
  );

  useEffect(() => {
    const platforms = socialLinks.map(link => link.platform);
    setUsedPlatforms(platforms);
  }, [socialLinks]);

  // Initialize profile data
  useEffect(() => {
    if (user && !isInitialized) {
      console.log("Initializing profile with user data:", user);

      setFormState(prev => ({
        ...prev,
        username: user.username || "",
        email: user.email || "",
        bio: user.bio || "",
        wallet: user.wallet || "",
      }));

      if (user.avatar) {
        setAvatar(user.avatar);
      }

      // Handle social links
      if (user.socialLinks) {
        const convertedLinks = convertBackendSocialLinks(user.socialLinks);
        setSocialLinks(convertedLinks);
      } else if ((user as any).sociallinks) {
        const convertedLinks = convertBackendSocialLinks(
          (user as any).sociallinks
        );
        setSocialLinks(convertedLinks);
      }

      // Check email verification
      setIsEmailVerified(user.emailVerified || false);
      setIsInitialized(true);
    } else if (!user && !isLoading) {
      // Fallback to sessionStorage if no user in auth context
      try {
        const userData = sessionStorage.getItem("userData");
        if (userData && !isInitialized) {
          const parsedUserData = JSON.parse(userData);
          console.log("Using sessionStorage data:", parsedUserData);

          setFormState(prev => ({
            ...prev,
            username: parsedUserData.username || prev.username,
            email: parsedUserData.email || prev.email,
            bio: parsedUserData.bio || prev.bio,
            wallet: parsedUserData.wallet || prev.wallet,
          }));

          if (parsedUserData.avatar) {
            setAvatar(parsedUserData.avatar);
          }

          // Handle social links from sessionStorage
          if (parsedUserData.sociallinks) {
            const convertedLinks = convertBackendSocialLinks(
              parsedUserData.sociallinks
            );
            setSocialLinks(convertedLinks);
          } else if (parsedUserData.socialLinks) {
            const convertedLinks = convertBackendSocialLinks(
              parsedUserData.socialLinks
            );
            setSocialLinks(convertedLinks);
          }

          setIsEmailVerified(parsedUserData.emailverified || false);
          setIsInitialized(true);
        }
      } catch (error) {
        console.error("Error parsing user data from sessionStorage:", error);
        showToast("Error loading profile data", "error");
      }
    }
  }, [user, isLoading, isInitialized, convertBackendSocialLinks, showToast]);

  const generateDefaultTitle = useCallback(
    (platform: Platform): string => {
      const existingCount = socialLinks.filter(
        link => link.platform === platform
      ).length;

      const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);

      return existingCount > 0
        ? `${platformName} ${existingCount + 1}`
        : platformName;
    },
    [socialLinks]
  );

  const validateAndIdentifyLink = useCallback(
    (url: string, title: string): SocialLink | null => {
      const urlRegex =
        /^(https?:\/\/)?(www\.)?([a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+)(\/[^\s]*)?$/;

      if (!urlRegex.test(url)) {
        return null;
      }

      const domainMatch = url.match(
        /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z0-9-]+)/
      );
      const domain = domainMatch ? domainMatch[1].toLowerCase() : "";

      if (domain.includes("instagram")) {
        const platform = "instagram";
        return {
          url,
          title: title || generateDefaultTitle(platform),
          platform,
        };
      } else if (domain.includes("twitter") || domain.includes("x.com")) {
        const platform = "twitter";
        return {
          url,
          title: title || generateDefaultTitle(platform),
          platform,
        };
      } else if (domain.includes("facebook") || domain.includes("fb.com")) {
        const platform = "facebook";
        return {
          url,
          title: title || generateDefaultTitle(platform),
          platform,
        };
      } else if (domain.includes("youtube") || domain.includes("youtu.be")) {
        const platform = "youtube";
        return {
          url,
          title: title || generateDefaultTitle(platform),
          platform,
        };
      } else if (domain.includes("telegram") || domain.includes("t.me")) {
        const platform = "telegram";
        return {
          url,
          title: title || generateDefaultTitle(platform),
          platform,
        };
      } else if (domain.includes("discord")) {
        const platform = "discord";
        return {
          url,
          title: title || generateDefaultTitle(platform),
          platform,
        };
      } else if (domain.includes("tiktok")) {
        const platform = "tiktok";
        return {
          url,
          title: title || generateDefaultTitle(platform),
          platform,
        };
      } else {
        return { url, title: title || "Other", platform: "other" };
      }
    },
    [generateDefaultTitle]
  );

  const languages = [
    "English",
    "Spanish",
    "French",
    "German",
    "Portuguese",
    "Russian",
    "Chinese",
    "Japanese",
  ];

  if (isLoading || !isInitialized) {
    return (
      <div className="min-h-screen bg-secondary text-foreground flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl mb-4">Loading...</h2>
          <p className="text-muted-foreground">
            Please wait while we load your profile.
          </p>
        </div>
      </div>
    );
  }

  const updateFormField = (field: keyof FormState, value: string) => {
    setFormState(prev => ({ ...prev, [field]: value }));

    if (field === "socialLinkUrl") {
      setUiState(prev => ({ ...prev, duplicateUrlError: false }));
    }
  };

  const updateUiState = (updates: Partial<UIState>) => {
    setUiState(prev => ({ ...prev, ...updates }));
  };

  const isDuplicateUrl = (url: string, excludeIndex?: number): boolean => {
    return socialLinks.some(
      (link, index) =>
        (excludeIndex === undefined || index !== excludeIndex) &&
        link.url.toLowerCase() === url.toLowerCase()
    );
  };

  const handleVerificationComplete = (code: string) => {
    console.log("Verifying code:", code);

    if (code === "123456") {
      // Mock verification
      setIsEmailVerified(true);
      updateUiState({ showVerificationPopup: false });
    }
  };

  const handleAvatarClick = () => {
    updateUiState({ showAvatarModal: true });
  };

  const handleSaveAvatar = (newAvatar: string | StaticImageData | File) => {
    setAvatar(newAvatar);
  };

  const handleLanguageSelect = (selectedLanguage: string) => {
    updateFormField("language", selectedLanguage);
    updateUiState({ showLanguageModal: false });
  };

  const handleSaveChanges = async () => {
    updateUiState({ isSaving: true, saveError: "", saveSuccess: false });

    try {
      // Convert social links to backend format
      const socialLinksObj = convertToBackendFormat(socialLinks);

      // Prepare avatar data if it's a File/Blob
      let avatarData: string | File | undefined;
      if (typeof avatar === "string" && avatar !== profileImage.src) {
        avatarData = avatar;
      } else if (avatar instanceof File) {
        avatarData = avatar;
      }

      const success = await updateUserProfile({
        username: formState.username,
        bio: formState.bio,
        socialLinks: socialLinksObj,
        avatar: avatarData,
      });

      if (success) {
        showToast("Profile updated successfully!", "success");
        updateUiState({ saveSuccess: true });

        // Update local state to reflect changes
        if (user) {
          const updatedUser = {
            ...user,
            username: formState.username,
            bio: formState.bio,
            socialLinks: socialLinksObj,
            avatar: typeof avatar === "string" ? avatar : user.avatar,
          };

          // Update sessionStorage
          sessionStorage.setItem("userData", JSON.stringify(updatedUser));
        }
      } else {
        showToast("Failed to save changes. Please try again.", "error");
        updateUiState({ saveError: "Failed to save changes" });
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      showToast("An unexpected error occurred.", "error");
      updateUiState({ saveError: "An unexpected error occurred" });
    } finally {
      updateUiState({ isSaving: false });
    }
  };

  return (
    <div className="min-h-screen bg-secondary text-foreground pb-8">
      <div className="mx-auto max-w-8xl">
        {/* Avatar Section */}
        <ProfileHeader avatar={avatar} onAvatarClick={handleAvatarClick} />

        {/* Basic Settings Section */}
        <BasicSettingsSection
          formState={formState}
          updateFormField={updateFormField}
          updateUiState={updateUiState}
          uiState={uiState}
        />

        {/* Social Links Section */}
        <SocialLinksSection
          socialLinks={socialLinks}
          setSocialLinks={setSocialLinks}
          formState={formState}
          updateFormField={updateFormField}
          editState={editState}
          setEditState={setEditState}
          uiState={uiState}
          updateUiState={updateUiState}
          isDuplicateUrl={isDuplicateUrl}
          validateAndIdentifyLink={validateAndIdentifyLink}
        />

        {/* Language Section */}
        <LanguageSection
          formState={formState}
          updateUiState={updateUiState}
          uiState={uiState}
          languages={languages}
          handleLanguageSelect={handleLanguageSelect}
        />

        {/* Save Button */}
        <SaveSection uiState={uiState} handleSaveChanges={handleSaveChanges} />
      </div>

      {/* Modals */}
      <AnimatePresence>
        {uiState.showAvatarModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <AvatarSelectionModal
              currentAvatar={avatar}
              onClose={() => updateUiState({ showAvatarModal: false })}
              onSaveAvatar={handleSaveAvatar}
              avatarOptions={avatarOptions}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {uiState.showVerificationPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <VerificationPopup
              email={formState.email}
              onClose={() => updateUiState({ showVerificationPopup: false })}
              onVerify={handleVerificationComplete}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
