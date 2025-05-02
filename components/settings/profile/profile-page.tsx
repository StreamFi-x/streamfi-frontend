"use client";
import React, { useState } from "react";
import Image, { StaticImageData } from "next/image";
import profileImage from "@/public/Images/profile.png";
import Avatar from "@/public/icons/avatar.svg";
import {
  Edit2,
  Trash2,
  Check,
  X,
} from "lucide-react";
import VerificationPopup from "./popup";
import AvatarSelectionModal from "./avatar-modal";
import { useToast } from "@/components/ui/toast-provider";

// Import social media icons - You'll need to update these paths based on your project structure
import InstagramIcon from "@/public/Images/instagram.svg";
import TwitterIcon from "@/public/Images/twitter.svg";
import FacebookIcon from "@/public/Images/facebook.svg";
import YoutubeIcon from "@/public/Images/youtube copy.svg";
import TelegramIcon from "@/public/Images/telegram.svg";
import DiscordIcon from "@/public/Images/discord copy.svg";
import TikTokIcon from "@/public/Images/tiktok.svg";

const avatar1 = Avatar;
const avatar2 = Avatar;
const avatar3 = Avatar;
const avatar4 = Avatar;
const avatar5 = Avatar;

interface SocialLink {
  url: string;
  title: string;
  platform:
    | "instagram"
    | "twitter"
    | "facebook"
    | "youtube"
    | "telegram"
    | "discord"
    | "tiktok"
    | "other";
  isEditing?: boolean;
}

export default function ProfileSettings() {
  const { showToast } = useToast();
  const [username, setUsername] = useState("Cassyyy");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [email, setEmail] = useState("Chidinmacasandra@gmail.com");
  const [bio, setBio] = useState("Chidinma Cassandra");
  const [socialLinkUrl, setSocialLinkUrl] = useState("");
  const [socialLinkTitle, setSocialLinkTitle] = useState("");
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([
    { url: "www.facebook.com", title: "Facebook", platform: "facebook" }
  ]);
  const [editingLink, setEditingLink] = useState<string>("");
  const [editingTitle, setEditingTitle] = useState<string>("");
  const [showVerificationPopup, setShowVerificationPopup] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [avatar, setAvatar] = useState(profileImage);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [avatarError, setAvatarError] = useState("");
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [language, setLanguage] = useState("English");
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

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

  const getInputStyle = (inputName: string) => {
    return `w-full bg-[#2a2a2a] rounded-lg px-4 py-2 text-white text-sm outline-none 
           ${focusedInput === inputName ? "border border-purple-600" : "border border-transparent"} 
           transition-all duration-200`;
  };

  const avatarOptions = [avatar1, avatar2, avatar3, avatar4, avatar5];

  const validateAndIdentifyLink = (url: string, title: string): SocialLink | null => {
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
      return { url, title, platform: "instagram" };
    } else if (domain.includes("twitter") || domain.includes("x.com")) {
      return { url, title, platform: "twitter" };
    } else if (domain.includes("facebook") || domain.includes("fb.com")) {
      return { url, title, platform: "facebook" };
    } else if (domain.includes("youtube") || domain.includes("youtu.be")) {
      return { url, title, platform: "youtube" };
    } else if (domain.includes("telegram") || domain.includes("t.me")) {
      return { url, title, platform: "telegram" };
    } else if (domain.includes("discord")) {
      return { url, title, platform: "discord" };
    } else if (domain.includes("tiktok")) {
      return { url, title, platform: "tiktok" };
    } else {
      return { url, title, platform: "other" };
    }
  };

  const handleAddSocialLink = () => {
    if (socialLinkUrl && socialLinks.length < 5) {
      const validatedLink = validateAndIdentifyLink(socialLinkUrl, socialLinkTitle || "Social Link");

      if (validatedLink) {
        setSocialLinks([...socialLinks, validatedLink]);
        setSocialLinkUrl("");
        setSocialLinkTitle("");
        showToast("Social link added successfully", "success");
      } else {
        showToast("Please enter a valid URL", "error");
      }
    } else if (socialLinks.length >= 5) {
      showToast("You can add a maximum of 5 social links", "info");
    }
  };

  const handleEditLink = (index: number) => {
    const newLinks = [...socialLinks];
    const linkToEdit = newLinks[index];
    setEditingLink(linkToEdit.url);
    setEditingTitle(linkToEdit.title);
    newLinks[index] = { ...linkToEdit, isEditing: true };
    setSocialLinks(newLinks);
  };

  const handleUpdateLink = (index: number) => {
    const validatedLink = validateAndIdentifyLink(editingLink, editingTitle);

    if (validatedLink) {
      const newLinks = [...socialLinks];
      newLinks[index] = validatedLink;
      setSocialLinks(newLinks);
      setEditingLink("");
      setEditingTitle("");
      showToast("Link updated successfully", "success");
    } else {
      showToast("Please enter a valid URL", "error");
    }
  };

  const handleCancelEdit = (index: number) => {
    const newLinks = [...socialLinks];
    newLinks[index] = { ...newLinks[index], isEditing: false };
    setSocialLinks(newLinks);
    setEditingLink("");
    setEditingTitle("");
  };

  const handleDeleteLink = (index: number) => {
    setSocialLinks(socialLinks.filter((_, i) => i !== index));
    showToast("Link removed", "info");
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleVerifyEmail = () => {
    setShowVerificationPopup(true);
    console.log("Sending verification code to", email);
  };

  const handleVerificationComplete = (code: string) => {
    console.log("Verifying code:", code);

    if (code.length === 6) {
      setIsEmailVerified(true);
      setShowVerificationPopup(false);
      showToast("Email verified successfully", "success");
    }
  };

  const handleAvatarClick = () => {
    setShowAvatarModal(true);
  };

  const handleSaveAvatar = (
    newAvatar: React.SetStateAction<StaticImageData>
  ) => {
    setAvatar(newAvatar);
    setAvatarError("");
    showToast("Avatar updated successfully", "success");
  };

  const handleLanguageSelect = (selectedLanguage: string) => {
    setLanguage(selectedLanguage);
    setShowLanguageModal(false);
    showToast(`Language changed to ${selectedLanguage}`, "success");
  };

  const handleSaveChanges = () => {
    console.log("Saving profile changes...");
    showToast("Profile changes saved successfully", "success");
  };

  const getSocialIcon = (platform: string) => {
    switch (platform) {
      case "instagram":
        return <Image src={InstagramIcon} alt="Instagram" width={24} height={24} />;
      case "twitter":
        return <Image src={TwitterIcon} alt="Twitter" width={24} height={24} />;
      case "facebook":
        return <Image src={FacebookIcon} alt="Facebook" width={24} height={24} />;
      case "youtube":
        return <Image src={YoutubeIcon} alt="YouTube" width={24} height={24} />;
      case "telegram":
        return <Image src={TelegramIcon} alt="Telegram" width={24} height={24} />;
      case "discord":
        return <Image src={DiscordIcon} alt="Discord" width={24} height={24} />;
      case "tiktok":
        return <Image src={TikTokIcon} alt="TikTok" width={24} height={24} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-8">
      <div className="mx-auto max-w-8xl">
        {/* Avatar Section */}
        <div className="bg-[#1a1a1a] rounded-lg p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-purple-700">
              <Image
                src={avatar}
                alt="Profile Avatar"
                fill
                className="object-cover"
                priority
              />
            </div>
            <div>
              <button
                onClick={handleAvatarClick}
                className="bg-[#2a2a2a] text-white px-3 py-2 rounded text-sm hover:bg-[#333] transition"
              >
                Edit Avatar
              </button>
              <p className="text-gray-400 mt-2 text-xs">
                Must be JPEG, PNG, or GIF and cannot exceed 10MB 
              </p>
            </div>
          </div>
        </div>

        {/* Basic Settings Section */}
        <div className="bg-[#1a1a1a] rounded-lg p-4 mb-6">
          <h2 className="text-purple-500 text-lg mb-4">
            Basic Settings
          </h2>

          <div className="mb-5">
            <label className="block mb-2 text-sm">User Name</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onFocus={() => setFocusedInput("username")}
              onBlur={() => setFocusedInput(null)}
              className={getInputStyle("username")}
              style={{ outlineWidth: 0, boxShadow: "none" }}
            />
            <p className="text-gray-500 italic text-xs mt-1">
              You can only change your display name once in a month.
            </p>
          </div>

          <div className="mb-5">
            <label className="block mb-2 text-sm">Edit Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              onFocus={() => setFocusedInput("bio")}
              onBlur={() => setFocusedInput(null)}
              className={`${getInputStyle("bio")} min-h-[7em]`}
              style={{ outlineWidth: 0, boxShadow: "none", height: "7em" }}
            />
            <p className="text-gray-500 italic text-xs mt-1">
              Share a bit about yourself. (Max 150 words)
            </p>
          </div>
        </div>

        {/* Social Links Section */}
        <div className="bg-[#1a1a1a] rounded-lg p-4 mb-6">
          <h2 className="text-purple-500 text-lg mb-4">
            Social Links
          </h2>
          <p className="text-gray-500 text-xs mb-4">
            Add up to 5 social media links to showcase your online presence.
          </p>
          <div className="mb-4">
            <label className="block mb-2 text-sm">Link Title</label>
            <input
              type="text"
              value={socialLinkTitle}
              onChange={(e) => setSocialLinkTitle(e.target.value)}
              onFocus={() => setFocusedInput("socialLinkTitle")}
              onBlur={() => setFocusedInput(null)}
              placeholder="e.g. Facebook, Twitter, etc."
              className={getInputStyle("socialLinkTitle")}
              style={{ outlineWidth: 0, boxShadow: "none", marginBottom: "1rem" }}
            />
            
            <label className="block mb-2 text-sm">Link URL</label>
            <div className="relative mb-6">
              <input
                type="text"
                value={socialLinkUrl}
                onChange={(e) => setSocialLinkUrl(e.target.value)}
                onFocus={() => setFocusedInput("socialLinkUrl")}
                onBlur={() => setFocusedInput(null)}
                placeholder="https://www.discord.com/emyyy2001"
                className={`${getInputStyle("socialLinkUrl")} pr-16`}
                style={{ outlineWidth: 0, boxShadow: "none" }}
              />
              <div className="absolute right-0 top-0 h-full flex items-center">
                <div className="flex gap-2 px-2">
                  <Image src={InstagramIcon} alt="Instagram" width={20} height={20} className="cursor-pointer" />
                  <Image src={TwitterIcon} alt="Twitter" width={20} height={20} className="cursor-pointer" />
                  <Image src={FacebookIcon} alt="Facebook" width={20} height={20} className="cursor-pointer" />
                  <Image src={YoutubeIcon} alt="YouTube" width={20} height={20} className="cursor-pointer" />
                  <Image src={DiscordIcon} alt="Discord" width={20} height={20} className="cursor-pointer" />
                  <Image src={TikTokIcon} alt="TikTok" width={20} height={20} className="cursor-pointer" />
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleAddSocialLink}
                disabled={socialLinks.length >= 5}
                className="bg-[#2a2a2a] px-6 py-2 rounded-md hover:bg-[#444] transition text-sm"
              >
                Add
              </button>
            </div>
          </div>

          {/* Display social links */}
          {socialLinks.length > 0 && (
            <div className="space-y-2 mt-4">
              {socialLinks.map((link, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-[#2a2a2a] p-3 rounded text-sm"
                >
                  {link.isEditing ? (
                    <>
                      <div className="flex-grow mr-2">
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onFocus={() => setFocusedInput("editingTitle")}
                          onBlur={() => setFocusedInput(null)}
                          className={`${getInputStyle("editingTitle")} w-full rounded px-3 py-1 text-white text-sm mb-2`}
                          style={{ outlineWidth: 0, boxShadow: "none", background: "#333" }}
                          placeholder="Link Title"
                          autoFocus
                        />
                        <input
                          type="text"
                          value={editingLink}
                          onChange={(e) => setEditingLink(e.target.value)}
                          onFocus={() => setFocusedInput("editingLink")}
                          onBlur={() => setFocusedInput(null)}
                          className={`${getInputStyle("editingLink")} w-full rounded px-3 py-1 text-white text-sm`}
                          style={{ outlineWidth: 0, boxShadow: "none", background: "#333" }}
                          placeholder="Link URL"
                        />
                      </div>
                      <div className="flex items-center">
                        <button
                          onClick={() => handleUpdateLink(index)}
                          className="p-1 text-green-500 hover:text-green-400"
                        >
                          <Check size={18} />
                        </button>
                        <button
                          onClick={() => handleCancelEdit(index)}
                          className="p-1 text-red-500 hover:text-red-400 ml-1"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center">
                        {getSocialIcon(link.platform)}
                        <span className="ml-2 font-medium">{link.title}</span>
                      </div>
                      <span className="text-gray-400 text-xs">
                        {link.url}
                      </span>
                      <div className="flex items-center">
                        <button
                          onClick={() => handleEditLink(index)}
                          className="p-1 text-gray-400 hover:text-white"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteLink(index)}
                          className="p-1 text-gray-400 hover:text-red-500 ml-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Language Section */}
        <div className="bg-[#1a1a1a] rounded-lg p-4 mb-6">
          <h2 className="text-purple-500 text-lg mb-4">
            Language
          </h2>
          <div 
            className={`w-full bg-[#2a2a2a] rounded-lg px-4 py-2 text-white text-sm flex justify-between items-center cursor-pointer ${
              focusedInput === "language" ? "border border-purple-600" : "border border-transparent"
            } transition-all duration-200`}
            onClick={() => {
              setFocusedInput("language");
              setShowLanguageModal(true);
            }}
          >
            <span>{language}</span>
            <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1.5L6 6.5L11 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSaveChanges}
            className="bg-purple-700 hover:bg-purple-800 text-white px-6 py-3 rounded-md transition text-sm"
          >
            Save Changes
          </button>
        </div>
      </div>

      {/* Modals */}
      {showAvatarModal && (
        <AvatarSelectionModal
          currentAvatar={avatar}
          onClose={() => setShowAvatarModal(false)}
          onSaveAvatar={handleSaveAvatar}
          avatarOptions={avatarOptions}
        />
      )}
      {showVerificationPopup && (
        <VerificationPopup
          email={email}
          onClose={() => setShowVerificationPopup(false)}
          onVerify={handleVerificationComplete}
        />
      )}
      
      {/* Language Modal */}
      {showLanguageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] rounded-lg w-full max-w-md p-6 relative">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-purple-500 text-xl font-medium">Select Language</h2>
              <button
                onClick={() => setShowLanguageModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto">
              {languages.map((lang) => (
                <div
                  key={lang}
                  onClick={() => handleLanguageSelect(lang)}
                  className={`flex items-center gap-3 p-3 rounded-md cursor-pointer ${
                    language === lang
                      ? "bg-purple-900 bg-opacity-50"
                      : "bg-[#2a2a2a] hover:bg-[#333]"
                  }`}
                >
                  <span className="text-sm">{lang}</span>
                  {language === lang && (
                    <div className="ml-auto w-2 h-2 rounded-full bg-purple-500"></div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowLanguageModal(false)}
                className="bg-purple-700 hover:bg-purple-800 text-white px-6 py-2 rounded-md transition text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}