"use client";
import { motion, AnimatePresence } from "framer-motion";
import type React from "react";

import Image from "next/image";
import {
  Edit2,
  Trash2,
  Check,
  X,
  Instagram,
  Facebook,
  Twitch,
  Youtube,
  Twitter,
} from "lucide-react";

import type {
  FormState,
  EditState,
  UIState,
  SocialLink,
  Platform,
} from "@/types/settings/profile";

// Import social media icons
import InstagramIcon from "@/public/Images/instagram.svg";
import TwitterIcon from "@/public/Images/twitter.svg";
import FacebookIcon from "@/public/Images/facebook.svg";
import YoutubeIcon from "@/public/Images/youtube copy.svg";
import TelegramIcon from "@/public/Images/telegram.svg";
import DiscordIcon from "@/public/Images/discord.svg";
import TikTokIcon from "@/public/Images/tiktok.svg";

interface SocialLinksSectionProps {
  socialLinks: SocialLink[];
  setSocialLinks: React.Dispatch<React.SetStateAction<SocialLink[]>>;
  formState: FormState;
  updateFormField: (field: keyof FormState, value: string) => void;
  editState: EditState;
  setEditState: React.Dispatch<React.SetStateAction<EditState>>;
  uiState: UIState;
  updateUiState: (updates: Partial<UIState>) => void;
  isDuplicateUrl: (url: string, excludeIndex?: number) => boolean;
  validateAndIdentifyLink: (url: string, title: string) => SocialLink | null;
}

export function SocialLinksSection({
  socialLinks,
  setSocialLinks,
  formState,
  updateFormField,
  editState,
  setEditState,
  uiState,
  updateUiState,
  isDuplicateUrl,
  validateAndIdentifyLink,
}: SocialLinksSectionProps) {
  const getInputStyle = (inputName: string) => {
    return `w-full bg-input rounded-lg px-4 py-3 text-sm font-medium outline-none ${
      uiState.focusedInput === inputName
        ? "border border-purple-600"
        : "border border-transparent"
    } transition-all duration-200`;
  };

  const getSocialIcon = (platform: Platform) => {
    switch (platform) {
      case "instagram":
        return (
          <Image
            src={InstagramIcon || "/placeholder.svg"}
            alt="Instagram"
            width={20}
            height={20}
          />
        );
      case "twitter":
        return (
          <Image
            src={TwitterIcon || "/placeholder.svg"}
            alt="X (Twitter)"
            width={20}
            height={20}
          />
        );
      case "facebook":
        return (
          <Image
            src={FacebookIcon || "/placeholder.svg"}
            alt="Facebook"
            width={20}
            height={20}
          />
        );
      case "youtube":
        return (
          <Image
            src={YoutubeIcon || "/placeholder.svg"}
            alt="YouTube"
            width={20}
            height={20}
          />
        );
      case "telegram":
        return (
          <Image
            src={TelegramIcon || "/placeholder.svg"}
            alt="Telegram"
            width={20}
            height={20}
          />
        );
      case "discord":
        return (
          <Image
            src={DiscordIcon || "/placeholder.svg"}
            alt="Discord"
            width={20}
            height={20}
          />
        );
      case "tiktok":
        return (
          <Image
            src={TikTokIcon || "/placeholder.svg"}
            alt="TikTok"
            width={20}
            height={20}
          />
        );
      default:
        return (
          <div className="w-5 h-5 bg-gray-600 rounded-full flex items-center justify-center">
            <span className="text-xs text-white">🔗</span>
          </div>
        );
    }
  };

  const detectPlatformFromUrl = (url: string): Platform | null => {
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
  };

  const handleAddSocialLink = () => {
    const { socialLinkUrl, socialLinkTitle } = formState;

    if (socialLinkUrl && socialLinks.length < 5) {
      if (isDuplicateUrl(socialLinkUrl)) {
        updateUiState({ duplicateUrlError: true });
        return;
      }

      const validatedLink = validateAndIdentifyLink(
        socialLinkUrl,
        socialLinkTitle
      );

      if (validatedLink) {
        // Check if platform already exists
        const existingPlatformIndex = socialLinks.findIndex(
          link => link.platform === validatedLink.platform
        );

        if (existingPlatformIndex !== -1) {
          // Replace the existing link for this platform
          const newLinks = [...socialLinks];
          newLinks[existingPlatformIndex] = validatedLink;
          setSocialLinks(newLinks);
        } else {
          // Add new link
          setSocialLinks([...socialLinks, validatedLink]);
        }

        updateFormField("socialLinkUrl", "");
        updateFormField("socialLinkTitle", "");
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && formState.socialLinkUrl) {
      e.preventDefault();
      handleAddSocialLink();
    }
  };

  const handleEditLink = (index: number) => {
    const linkToEdit = socialLinks[index];
    setEditState({
      editingLink: linkToEdit.url,
      editingTitle: linkToEdit.title,
      isEditing: true,
      editingIndex: index,
    });

    const newLinks = [...socialLinks];
    newLinks[index] = { ...linkToEdit, isEditing: true };
    setSocialLinks(newLinks);
  };

  const handleUpdateLink = () => {
    const { editingLink, editingTitle, editingIndex } = editState;

    if (editingIndex === null) return;

    const validatedLink = validateAndIdentifyLink(editingLink, editingTitle);

    if (validatedLink) {
      // Check if the updated URL is a duplicate of another link (not the one being edited)
      if (isDuplicateUrl(editingLink, editingIndex)) {
        updateUiState({ duplicateUrlError: true });
        return;
      }

      // Check if the platform already exists in another link (not the one being edited)
      const existingPlatformIndex = socialLinks.findIndex(
        (link, index) =>
          index !== editingIndex && link.platform === validatedLink.platform
      );

      if (existingPlatformIndex !== -1) {
        // Replace the existing link for this platform
        const newLinks = [...socialLinks];
        newLinks[existingPlatformIndex] = validatedLink;
        // Remove the link being edited
        newLinks.splice(editingIndex, 1);
        setSocialLinks(newLinks);
      } else {
        // Update the link normally
        const newLinks = [...socialLinks];
        newLinks[editingIndex] = validatedLink;
        setSocialLinks(newLinks);
      }

      // Reset edit state
      setEditState({
        editingLink: "",
        editingTitle: "",
        isEditing: false,
        editingIndex: null,
      });
    }
  };

  const handleCancelEdit = () => {
    const { editingIndex } = editState;

    if (editingIndex === null) return;

    const newLinks = [...socialLinks];
    newLinks[editingIndex] = { ...newLinks[editingIndex], isEditing: false };
    setSocialLinks(newLinks);

    setEditState({
      editingLink: "",
      editingTitle: "",
      isEditing: false,
      editingIndex: null,
    });
  };

  const handleDeleteLink = (index: number) => {
    setSocialLinks(socialLinks.filter((_, i) => i !== index));
  };

  return (
    <motion.div
      className="bg-card border border-border shadow-sm rounded-lg p-4 mb-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h2 className="text-foreground text-xl font-medium mb-1">Social Links</h2>
      <div className="flex flex-wrap items-center sm:gap-2 gap-3 mb-6">
        <p className="text-muted-foreground text-xs sm:text-sm">
          Add up to 5 social media links to showcase your online presence.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <Instagram className="w-4 h-4" />
          <Facebook className="w-4 h-4" />
          <Twitch className="w-4 h-4" />
          <Youtube className="w-4 h-4" />
          <Twitter className="w-4 h-4" />
        </div>
      </div>

      <div className="mb-6">
        <label className="block mb-2 text-sm">Link Title</label>
        <motion.input
          type="text"
          value={formState.socialLinkTitle}
          onChange={e => updateFormField("socialLinkTitle", e.target.value)}
          onFocus={() => updateUiState({ focusedInput: "socialLinkTitle" })}
          onBlur={() => updateUiState({ focusedInput: null })}
          placeholder="e.g. Facebook, Twitter, etc."
          className={getInputStyle("socialLinkTitle")}
          style={{
            outlineWidth: 0,
            boxShadow: "none",
            marginBottom: "1rem",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        />

        <label className="block mb-2 text-sm">Link URL</label>
        <div className="relative mb-1">
          <motion.input
            type="text"
            value={formState.socialLinkUrl}
            onChange={e => updateFormField("socialLinkUrl", e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() =>
              updateUiState({
                focusedInput: "socialLinkUrl",
                duplicateUrlError: false,
              })
            }
            onBlur={() => updateUiState({ focusedInput: null })}
            placeholder="https://www.discord.com/username"
            className={`${getInputStyle("socialLinkUrl")} pr-32`}
            style={{ outlineWidth: 0, boxShadow: "none" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, delay: 0.1 }}
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex gap-2">
            <AnimatePresence>
              {formState.socialLinkUrl && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                >
                  {getSocialIcon(
                    detectPlatformFromUrl(formState.socialLinkUrl) || "other"
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Error message for duplicate URL */}
        <AnimatePresence>
          {uiState.duplicateUrlError && (
            <motion.p
              className="text-red-600 dark:text-red-400 text-xs mt-1 mb-2"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              This URL has already been added. Please use a different URL.
            </motion.p>
          )}
        </AnimatePresence>

        <div className="flex justify-end mt-2">
          <motion.button
            onClick={handleAddSocialLink}
            disabled={socialLinks.length >= 5 || !formState.socialLinkUrl}
            className="bg-purple-600 hover:bg-purple-800 text-white dark:text-white px-6 py-2 rounded-md transition text-sm disabled:opacity-50"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, delay: 0.2 }}
          >
            Add
          </motion.button>
        </div>
      </div>

      {/* Display social links */}
      <AnimatePresence>
        {socialLinks.length > 0 && (
          <motion.div
            className="space-y-2 mt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {socialLinks.map((link, index) => (
              <motion.div
                key={index}
                className="flex rounded text-sm border-2 bg-card border-border"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                layout
              >
                {link.isEditing ? (
                  <div className="p-3">
                    <div className="flex-grow mr-2">
                      <input
                        type="text"
                        value={editState.editingTitle}
                        onChange={e =>
                          setEditState(prev => ({
                            ...prev,
                            editingTitle: e.target.value,
                          }))
                        }
                        onFocus={() =>
                          updateUiState({ focusedInput: "editingTitle" })
                        }
                        onBlur={() => updateUiState({ focusedInput: null })}
                        className={combineClasses(
                          getInputStyle("editingTitle"),
                          "w-full rounded px-3 py-1 text-sm mb-2"
                        )}
                        style={{
                          outlineWidth: 0,
                          boxShadow: "none",
                        }}
                        placeholder="Link Title"
                        autoFocus
                      />
                      <input
                        type="text"
                        value={editState.editingLink}
                        onChange={e =>
                          setEditState(prev => ({
                            ...prev,
                            editingLink: e.target.value,
                          }))
                        }
                        onFocus={() =>
                          updateUiState({
                            focusedInput: "editingLink",
                            duplicateUrlError: false,
                          })
                        }
                        onBlur={() => updateUiState({ focusedInput: null })}
                        className={combineClasses(
                          getInputStyle("editingLink"),
                          "w-full rounded px-3 py-1 text-sm",
                          uiState.duplicateUrlError ? "border-red-500" : ""
                        )}
                        style={{
                          outlineWidth: 0,
                          boxShadow: "none",
                        }}
                        placeholder="Link URL"
                      />

                      {/* Error message for duplicate URL */}
                      <AnimatePresence>
                        {uiState.duplicateUrlError && (
                          <motion.p
                            className={combineClasses(
                              textClasses.error,
                              "text-xs mt-1"
                            )}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                          >
                            This URL has already been added. Please use a
                            different URL.
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                    <div className="flex items-center justify-end mt-2">
                      <motion.button
                        onClick={handleUpdateLink}
                        className="p-1 text-green-500 hover:text-green-400"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Check size={18} />
                      </motion.button>
                      <motion.button
                        onClick={handleCancelEdit}
                        className="p-1 text-red-500 hover:text-red-400 ml-1"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <X size={18} />
                      </motion.button>
                    </div>
                  </div>
                ) : (
                  <div className={` flex w-full`}>
                    <div className="flex-none p-3 flex items-center justify-center">
                      {getSocialIcon(link.platform)}
                    </div>
                    <div className="flex-1 p-3 border-l border-[#2a2a2a] truncate w-full">
                      <div className="flex flex-col justify-start">
                        <span className="font-medium">{link.title}</span>
                        <div
                          className={combineClasses(
                            textClasses.tertiary,
                            "text-xs mt-1 truncate max-w-sm"
                          )}
                        >
                          {link.url}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-end px-3">
                      <motion.button
                        onClick={() => handleEditLink(index)}
                        className={combineClasses(
                          textClasses.tertiary,
                          "p-1 hover:text-white"
                        )}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Edit2 size={16} />
                      </motion.button>
                      <motion.button
                        onClick={() => handleDeleteLink(index)}
                        className={combineClasses(
                          textClasses.tertiary,
                          "p-1 hover:text-red-500 ml-1"
                        )}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Trash2 size={16} />
                      </motion.button>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
