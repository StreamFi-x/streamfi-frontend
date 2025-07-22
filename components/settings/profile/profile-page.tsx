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

import { bgClasses, textClasses, combineClasses } from "@/lib/theme-classes";
import type { StaticImageData } from "next/image";
import { SocialLinksSection } from "./social-links-section";
import { SaveSection } from "./save-section";

export default function ProfileSettings() {
  const { user, isLoading, updateUserProfile } = useAuth();
console.log("User in ProfileSettings:", user);
  const avatarOptions = [Avatar, Avatar, Avatar, Avatar, Avatar];

  const [avatar, setAvatar] = useState<StaticImageData | string>(profileImage);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [usedPlatforms, setUsedPlatforms] = useState<Platform[]>([]);
  const [isEmailVerified, setIsEmailVerified] = useState(false);

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

  useEffect(() => {
    const platforms = socialLinks.map((link) => link.platform);
    setUsedPlatforms(platforms);
  }, [socialLinks]);

  useEffect(() => {
    if (user) {
      setFormState((prev) => ({
        ...prev,
        username: user.username || "",
        email: user.email || "",
        bio: user.bio || "",
        wallet: user.wallet || "",
      }));

      if (user.avatar) {
        setAvatar(user.avatar);
      }
    } else {
      // If no user in auth context, try to get from sessionStorage
      try {
        const userData = sessionStorage.getItem("userData");
        if (userData) {
          const parsedUserData = JSON.parse(userData);

          setFormState((prev) => ({
            ...prev,
            username: parsedUserData.username || prev.username,
            email: parsedUserData.email || prev.email,
            bio: parsedUserData.bio || prev.bio,
            wallet: parsedUserData.wallet || prev.wallet,
          }));

          if (parsedUserData.avatar) {
            setAvatar(parsedUserData.avatar);
          }

          // If there are social links in the user data, set them
          if (
            parsedUserData.sociallinks &&
            Array.isArray(parsedUserData.sociallinks)
          ) {
            setSocialLinks(parsedUserData.sociallinks);
          }
        }
      } catch (error) {
        console.error("Error parsing user data from sessionStorage:", error);
      }
    }
  }, [user]);

  const generateDefaultTitle = useCallback(
    (platform: Platform): string => {
      const existingCount = socialLinks.filter(
        (link) => link.platform === platform,
      ).length;

      const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);

      return existingCount > 0
        ? `${platformName} ${existingCount + 1}`
        : platformName;
    },
    [socialLinks],
  );

  const validateAndIdentifyLink = useCallback(
    (url: string, title: string): SocialLink | null => {
      const urlRegex =
        /^(https?:\/\/)?(www\.)?([a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+)(\/[^\s]*)?$/;

      if (!urlRegex.test(url)) {
        return null;
      }

      const domainMatch = url.match(
        /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z0-9-]+)/,
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
    [generateDefaultTitle],
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

  if (isLoading) {
    return (
      <div
        className={combineClasses(
          "min-h-screen",
          bgClasses.secondary,
          textClasses.primary,
          "flex items-center justify-center",
        )}
      >
        <div className="text-center">
          <h2 className="text-xl mb-4">Loading...</h2>
          <p className={textClasses.tertiary}>
            Please wait while we load your profile.
          </p>
        </div>
      </div>
    );
  }

  const updateFormField = (field: keyof FormState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));

    if (field === "socialLinkUrl") {
      setUiState((prev) => ({ ...prev, duplicateUrlError: false }));
    }
  };

  const updateUiState = (updates: Partial<UIState>) => {
    setUiState((prev) => ({ ...prev, ...updates }));
  };

  const isDuplicateUrl = (url: string, excludeIndex?: number): boolean => {
    return socialLinks.some(
      (link, index) =>
        (excludeIndex === undefined || index !== excludeIndex) &&
        link.url.toLowerCase() === url.toLowerCase(),
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

  const handleSaveAvatar = (
    newAvatar: React.SetStateAction<string | StaticImageData>,
  ) => {
    setAvatar(newAvatar);
  };

  const handleLanguageSelect = (selectedLanguage: string) => {
    updateFormField("language", selectedLanguage);
    updateUiState({ showLanguageModal: false });
  };

  const handleSaveChanges = async () => {
    updateUiState({ isSaving: true, saveError: "", saveSuccess: false });

    try {
      // Convert social links array to object format for API
      const socialLinksObj: Record<string, string> = {};
      socialLinks.forEach((link) => {
        socialLinksObj[link.platform] = link.url;
      });

      // Update user profile
      const success = await updateUserProfile({
        username: formState.username,
        bio: formState.bio,
        socialLinks: socialLinksObj,
      });

      if (success) {
        updateUiState({ saveSuccess: true });
      } else {
        updateUiState({ saveError: "Failed to save changes" });
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      updateUiState({ saveError: "An unexpected error occurred" });
    } finally {
      updateUiState({ isSaving: false });
    }
  };

  return (
    <div
      className={combineClasses(
        "min-h-screen",
        bgClasses.secondary,
        textClasses.primary,
        "pb-8",
      )}
    >
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
