"use client"
import { useState, useEffect, useCallback } from "react"
import type React from "react"
import Image, { type StaticImageData } from "next/image"
import { Edit2, Trash2, Check, X } from 'lucide-react'
import { useAuth } from "@/components/auth/auth-provider"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import profileImage from "@/public/Images/profile.png"
import Avatar from "@/public/icons/avatar.svg"
import InstagramIcon from "@/public/Images/instagram.svg"
import TwitterIcon from "@/public/Images/twitter.svg"
import FacebookIcon from "@/public/Images/facebook.svg"
import YoutubeIcon from "@/public/Images/youtube copy.svg"
import TelegramIcon from "@/public/Images/telegram.svg"
import DiscordIcon from "@/public/Images/discord.svg"
import TikTokIcon from "@/public/Images/tiktok.svg"
import VerificationPopup from "./popup"
import AvatarSelectionModal from "./avatar-modal"
import LinkedInIcon from "@/public/Images/linkedin.svg"

// Types
type Platform = "instagram" | "twitter" | "facebook" | "youtube" | "telegram" | "discord" | "tiktok" | "other"

interface SocialLink {
  url: string
  title: string
  platform: Platform
  isEditing?: boolean
}

interface FormState {
  username: string
  email: string
  bio: string
  wallet: string
  socialLinkUrl: string
  socialLinkTitle: string
  language: string
}

interface EditState {
  editingLink: string
  editingTitle: string
  isEditing: boolean
  editingIndex: number | null
}

interface UIState {
  focusedInput: string | null
  showVerificationPopup: boolean
  showAvatarModal: boolean
  showLanguageModal: boolean
  isSaving: boolean
  saveSuccess: boolean
  saveError: string
  duplicateUrlError: boolean
}

export default function ProfileSettings() {
  const { user, updateUserProfile } = useAuth()
  const router = useRouter()
  const avatarOptions = [Avatar, Avatar, Avatar, Avatar, Avatar]

  // Main state
  const [avatar, setAvatar] = useState<StaticImageData | string>(profileImage) // Update type to string | StaticImageData
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([])
  const [usedPlatforms, setUsedPlatforms] = useState<Platform[]>([])
  const [isEmailVerified, setIsEmailVerified] = useState(false)

  // Form state
  const [formState, setFormState] = useState<FormState>({
    username: "",
    email: "",
    bio: "",
    wallet: "",
    socialLinkUrl: "",
    socialLinkTitle: "",
    language: "English"
  })

  // Edit state
  const [editState, setEditState] = useState<EditState>({
    editingLink: "",
    editingTitle: "",
    isEditing: false,
    editingIndex: null
  })

  // UI state
  const [uiState, setUiState] = useState<UIState>({
    focusedInput: null,
    showVerificationPopup: false,
    showAvatarModal: false,
    showLanguageModal: false,
    isSaving: false,
    saveSuccess: false,
    saveError: "",
    duplicateUrlError: false
  })

  const languages = ["English", "Spanish", "French", "German", "Portuguese", "Russian", "Chinese", "Japanese"]

  // Update form field
  const updateFormField = (field: keyof FormState, value: string) => {
    setFormState(prev => ({ ...prev, [field]: value }))
    
    // Clear duplicate error when URL changes
    if (field === 'socialLinkUrl') {
      setUiState(prev => ({ ...prev, duplicateUrlError: false }))
    }
  }

  // Update UI state
  const updateUiState = (updates: Partial<UIState>) => {
    setUiState(prev => ({ ...prev, ...updates }))
  }

  // Update used platforms when social links change
  useEffect(() => {
    const platforms = socialLinks.map(link => link.platform)
    setUsedPlatforms(platforms)
  }, [socialLinks])

  // Load user data when available
  useEffect(() => {
    if (user) {
      setFormState(prev => ({
        ...prev,
        username: user.username || "",
        email: user.email || "",
        bio: user.bio || "",
        wallet: user.wallet || ""
      }))

      if (user.avatar) {
        setAvatar(user.avatar)
      }
    }
  }, [user])

  // Fix the focusedInput reference error by using uiState.focusedInput instead
  const getInputStyle = (inputName: string) => {
    return `w-full bg-[#2a2a2a] rounded-lg px-4 py-3 text-white text-sm outline-none 
           ${uiState.focusedInput === inputName ? "border border-purple-600" : "border border-transparent"} 
           transition-all duration-200`
  }

  // Generate a default title based on platform and existing links
  const generateDefaultTitle = useCallback((platform: Platform): string => {
    // Count existing links with the same platform
    const existingCount = socialLinks.filter((link) => link.platform === platform).length

    // Capitalize the first letter of platform name
    const platformName = platform.charAt(0).toUpperCase() + platform.slice(1)

    // If there are existing links with this platform, add a number
    return existingCount > 0 ? `${platformName} ${existingCount + 1}` : platformName
  }, [socialLinks])

  const validateAndIdentifyLink = useCallback((url: string, title: string): SocialLink | null => {
    const urlRegex = /^(https?:\/\/)?(www\.)?([a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+)(\/[^\s]*)?$/

    if (!urlRegex.test(url)) {
      return null
    }

    const domainMatch = url.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z0-9-]+)/)
    const domain = domainMatch ? domainMatch[1].toLowerCase() : ""

    if (domain.includes("instagram")) {
      const platform = "instagram"
      return { url, title: title || generateDefaultTitle(platform), platform }
    } else if (domain.includes("twitter") || domain.includes("x.com")) {
      const platform = "twitter"
      return { url, title: title || generateDefaultTitle(platform), platform }
    } else if (domain.includes("facebook") || domain.includes("fb.com")) {
      const platform = "facebook"
      return { url, title: title || generateDefaultTitle(platform), platform }
    } else if (domain.includes("youtube") || domain.includes("youtu.be")) {
      const platform = "youtube"
      return { url, title: title || generateDefaultTitle(platform), platform }
    } else if (domain.includes("telegram") || domain.includes("t.me")) {
      const platform = "telegram"
      return { url, title: title || generateDefaultTitle(platform), platform }
    } else if (domain.includes("discord")) {
      const platform = "discord"
      return { url, title: title || generateDefaultTitle(platform), platform }
    } else if (domain.includes("tiktok")) {
      const platform = "tiktok"
      return { url, title: title || generateDefaultTitle(platform), platform }
    } else {
      return { url, title: title || "Other", platform: "other" }
    }
  }, [generateDefaultTitle])

  const isDuplicateUrl = (url: string, excludeIndex?: number): boolean => {
    return socialLinks.some((link, index) => 
      (excludeIndex === undefined || index !== excludeIndex) && 
      link.url.toLowerCase() === url.toLowerCase()
    )
  }

  const handleAddSocialLink = () => {
    const { socialLinkUrl, socialLinkTitle } = formState
    
    if (socialLinkUrl && socialLinks.length < 5) {
      // Check for duplicate URL
      if (isDuplicateUrl(socialLinkUrl)) {
        updateUiState({ duplicateUrlError: true })
        return
      }
      
      const validatedLink = validateAndIdentifyLink(socialLinkUrl, socialLinkTitle)

      if (validatedLink) {
        setSocialLinks([...socialLinks, validatedLink])
        updateFormField('socialLinkUrl', '')
        updateFormField('socialLinkTitle', '')
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && formState.socialLinkUrl) {
      e.preventDefault()
      handleAddSocialLink()
    }
  }

  const handleEditLink = (index: number) => {
    const linkToEdit = socialLinks[index]
    setEditState({
      editingLink: linkToEdit.url,
      editingTitle: linkToEdit.title,
      isEditing: true,
      editingIndex: index
    })
    
    const newLinks = [...socialLinks]
    newLinks[index] = { ...linkToEdit, isEditing: true }
    setSocialLinks(newLinks)
  }

  const handleUpdateLink = () => {
    const { editingLink, editingTitle, editingIndex } = editState
    
    if (editingIndex === null) return
    
    const validatedLink = validateAndIdentifyLink(editingLink, editingTitle)

    if (validatedLink) {
      // Check if the updated URL is a duplicate of another link (not the one being edited)
      if (isDuplicateUrl(editingLink, editingIndex)) {
        updateUiState({ duplicateUrlError: true })
        return
      }

      const newLinks = [...socialLinks]
      newLinks[editingIndex] = validatedLink
      setSocialLinks(newLinks)
      
      // Reset edit state
      setEditState({
        editingLink: "",
        editingTitle: "",
        isEditing: false,
        editingIndex: null
      })
    }
  }

  const handleCancelEdit = () => {
    const { editingIndex } = editState
    
    if (editingIndex === null) return
    
    const newLinks = [...socialLinks]
    newLinks[editingIndex] = { ...newLinks[editingIndex], isEditing: false }
    setSocialLinks(newLinks)
    
    // Reset edit state
    setEditState({
      editingLink: "",
      editingTitle: "",
      isEditing: false,
      editingIndex: null
    })
  }

  const handleDeleteLink = (index: number) => {
    setSocialLinks(socialLinks.filter((_, i) => i !== index))
  }

  const handleVerifyEmail = () => {
    updateUiState({ showVerificationPopup: true })
  }

  const handleVerificationComplete = (code: string) => {
    console.log("Verifying code:", code)

    if (code === "123456") {
      // Mock verification
      setIsEmailVerified(true)
      updateUiState({ showVerificationPopup: false })
    }
  }

  const handleAvatarClick = () => {
    updateUiState({ showAvatarModal: true })
  }

  // Fix the avatar type error by updating the handleSaveAvatar function
  const handleSaveAvatar = (newAvatar: React.SetStateAction<string | StaticImageData>) => {
    setAvatar(newAvatar)
  }

  const handleLanguageSelect = (selectedLanguage: string) => {
    updateFormField('language', selectedLanguage)
    updateUiState({ showLanguageModal: false })
  }

  const handleSaveChanges = async () => {
    updateUiState({ isSaving: true, saveError: "", saveSuccess: false })

    try {
      // Convert social links array to object format for API
      const socialLinksObj: Record<string, string> = {}
      socialLinks.forEach((link) => {
        socialLinksObj[link.platform] = link.url
      })

      // Update user profile
      const success = await updateUserProfile({
        username: formState.username,
        bio: formState.bio,
        socialLinks: socialLinksObj,
      })

      if (success) {
        updateUiState({ saveSuccess: true })
      } else {
        updateUiState({ saveError: "Failed to save changes" })
      }
    } catch (error) {
      console.error("Error saving profile:", error)
      updateUiState({ saveError: "An unexpected error occurred" })
    } finally {
      updateUiState({ isSaving: false })
    }
  }

  const getSocialIcon = (platform: Platform) => {
    switch (platform) {
      case "instagram":
        return <Image src={InstagramIcon || "/placeholder.svg"} alt="Instagram" width={20} height={20} />
      case "twitter":
        return <Image src={TwitterIcon || "/placeholder.svg"} alt="X (Twitter)" width={20} height={20} />
      case "facebook":
        return <Image src={FacebookIcon || "/placeholder.svg"} alt="Facebook" width={20} height={20} />
      case "youtube":
        return <Image src={YoutubeIcon || "/placeholder.svg"} alt="YouTube" width={20} height={20} />
      case "telegram":
        return <Image src={TelegramIcon || "/placeholder.svg"} alt="Telegram" width={20} height={20} />
      case "discord":
        return <Image src={DiscordIcon || "/placeholder.svg"} alt="Discord" width={20} height={20} />
      case "tiktok":
        return <Image src={TikTokIcon || "/placeholder.svg"} alt="TikTok" width={20} height={20} />
      default:
        return (
          <div className="w-5 h-5 bg-gray-600 rounded-full flex items-center justify-center">
            <span className="text-xs text-white">🔗</span>
          </div>
        )
    }
  }

  const detectPlatformFromUrl = (url: string): Platform | null => {
    if (!url) return null

    const domain = url.toLowerCase()
    if (domain.includes("instagram")) return "instagram"
    if (domain.includes("twitter") || domain.includes("x.com")) return "twitter"
    if (domain.includes("facebook") || domain.includes("fb.com")) return "facebook"
    if (domain.includes("youtube") || domain.includes("youtu.be")) return "youtube"
    if (domain.includes("telegram") || domain.includes("t.me")) return "telegram"
    if (domain.includes("discord")) return "discord"
    if (domain.includes("tiktok")) return "tiktok"
    return "other"
  }

  // if (isLoading) {
  //   return <SimpleLoader />;
  // }

  return (
    <div className="min-h-screen bg-black text-white pb-8">
      <div className="mx-auto max-w-8xl">
        {/* Avatar Section */}
        <div className="bg-[#1a1a1a] rounded-lg p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-purple-700">
              <Image src={avatar || "/placeholder.svg"} alt="Profile Avatar" fill className="object-cover" priority />
            </div>
            <div>
              <button
                onClick={handleAvatarClick}
                className="bg-[#2a2a2a] text-white px-3 py-2 rounded text-sm hover:bg-[#333] transition"
              >
                Edit Avatar
              </button>
              <p className="text-gray-400 mt-2 text-xs">Must be JPEG, PNG, or GIF and cannot exceed 10MB</p>
            </div>
          </div>
        </div>

        {/* Basic Settings Section */}
        <div className="bg-[#1a1a1a] rounded-lg p-4 mb-6">
          <h2 className="text-purple-500 text-lg mb-4">Basic Settings</h2>

          <div className="mb-5">
            <label className="block mb-2 text-sm">User Name</label>
            <input
              type="text"
              value={formState.username}
              onChange={(e) => updateFormField('username', e.target.value)}
              onFocus={() => updateUiState({ focusedInput: "username" })}
              onBlur={() => updateUiState({ focusedInput: null })}
              className={getInputStyle("username")}
              style={{ outlineWidth: 0, boxShadow: "none" }}
            />
            <p className="text-gray-500 italic text-xs mt-1">You can only change your display name once in a month.</p>
          </div>

          <div className="mb-5">
            <label className="block mb-2 text-sm">Wallet Address</label>
            <input
              type="text"
              value={formState.wallet}
              readOnly
              className={`${getInputStyle("wallet")} opacity-70`}
              style={{ outlineWidth: 0, boxShadow: "none" }}
            />
            <p className="text-gray-500 italic text-xs mt-1">Your wallet address cannot be changed.</p>
          </div>

          <div className="mb-5">
            <label className="block mb-2 text-sm">Edit Bio</label>
            <textarea
              value={formState.bio}
              onChange={(e) => updateFormField('bio', e.target.value)}
              onFocus={() => updateUiState({ focusedInput: "bio" })}
              onBlur={() => updateUiState({ focusedInput: null })}
              className={`${getInputStyle("bio")} min-h-[7em]`}
              style={{ outlineWidth: 0, boxShadow: "none", height: "7em" }}
            />
            <p className="text-gray-500 italic text-xs mt-1">Share a bit about yourself. (Max 150 words)</p>
          </div>
        </div>

        {/* Social Links Section */}
        <motion.div
          className="bg-[#1a1a1a] rounded-lg p-4 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h2 className="text-white text-xl font-medium mb-1">Social Links</h2>
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <p className="text-gray-400 text-sm">Add up to 5 social media links to showcase your online presence.</p>
            <div className="flex items-center gap-2 flex-wrap">
              <Image 
                src={InstagramIcon || "/placeholder.svg"} 
                alt="Instagram" 
                width={16} 
                height={16} 
                className={`${usedPlatforms.includes('instagram') ? 'opacity-30' : ''} w-3 h-3 md:w-4 md:h-4`} 
              />
              <Image 
                src={TwitterIcon || "/placeholder.svg"} 
                alt="Twitter" 
                width={16} 
                height={16} 
                className={`${usedPlatforms.includes('twitter') ? 'opacity-30' : ''} w-3 h-3 md:w-4 md:h-4`} 
              />
              <Image 
                src={FacebookIcon || "/placeholder.svg"} 
                alt="Facebook" 
                width={16} 
                height={16} 
                className={`${usedPlatforms.includes('facebook') ? 'opacity-30' : ''} w-3 h-3 md:w-4 md:h-4`} 
              />
              <Image 
                src={YoutubeIcon || "/placeholder.svg"} 
                alt="YouTube" 
                width={16} 
                height={16} 
                className={`${usedPlatforms.includes('youtube') ? 'opacity-30' : ''} w-3 h-3 md:w-4 md:h-4`} 
              />
              <Image 
                src={DiscordIcon || "/placeholder.svg"} 
                alt="Discord" 
                width={16} 
                height={16} 
                className={`${usedPlatforms.includes('discord') ? 'opacity-30' : ''} w-3 h-3 md:w-4 md:h-4`} 
              />
              <Image 
                src={TikTokIcon || "/placeholder.svg"} 
                alt="TikTok" 
                width={16} 
                height={16} 
                className={`${usedPlatforms.includes('tiktok') ? 'opacity-30' : ''} w-3 h-3 md:w-4 md:h-4`} 
              />
              <Image 
                src={TelegramIcon || "/placeholder.svg"} 
                alt="Telegram" 
                width={16} 
                height={16} 
                className={`${usedPlatforms.includes('telegram') ? 'opacity-30' : ''} w-3 h-3 md:w-4 md:h-4`} 
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block mb-2 text-sm">Link Title</label>
            <motion.input
              type="text"
              value={formState.socialLinkTitle}
              onChange={(e) => updateFormField('socialLinkTitle', e.target.value)}
              onFocus={() => updateUiState({ focusedInput: "socialLinkTitle" })}
              onBlur={() => updateUiState({ focusedInput: null })}
              placeholder="e.g. Facebook, Twitter, etc."
              className={getInputStyle("socialLinkTitle")}
              style={{ outlineWidth: 0, boxShadow: "none", marginBottom: "1rem" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            />

            <label className="block mb-2 text-sm">Link URL</label>
            <div className="relative mb-1">
              <motion.input
                type="text"
                value={formState.socialLinkUrl}
                onChange={(e) => updateFormField('socialLinkUrl', e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => updateUiState({ focusedInput: "socialLinkUrl", duplicateUrlError: false })}
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
                      {getSocialIcon(detectPlatformFromUrl(formState.socialLinkUrl) || "other")}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            
            {/* Error message for duplicate URL */}
            <AnimatePresence>
              {uiState.duplicateUrlError && (
                <motion.p 
                  className="text-red-500 text-xs mt-1 mb-2"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
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
                className="bg-[#2a2a2a] px-6 py-2 rounded-md hover:bg-[#444] transition text-sm disabled:opacity-50"
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
                    className="flex bg-[#1e1e1e] rounded text-sm"
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
                            onChange={(e) => setEditState(prev => ({ ...prev, editingTitle: e.target.value }))}
                            onFocus={() => updateUiState({ focusedInput: "editingTitle" })}
                            onBlur={() => updateUiState({ focusedInput: null })}
                            className={`${getInputStyle("editingTitle")} w-full rounded px-3 py-1 text-white text-sm mb-2`}
                            style={{
                              outlineWidth: 0,
                              boxShadow: "none",
                              background: "#333",
                            }}
                            placeholder="Link Title"
                            autoFocus
                          />
                          <input
                            type="text"
                            value={editState.editingLink}
                            onChange={(e) => setEditState(prev => ({ ...prev, editingLink: e.target.value }))}
                            onFocus={() => updateUiState({ focusedInput: "editingLink", duplicateUrlError: false })}
                            onBlur={() => updateUiState({ focusedInput: null })}
                            className={`${getInputStyle("editingLink")} w-full rounded px-3 py-1 text-white text-sm ${uiState.duplicateUrlError ? 'border-red-500' : ''}`}
                            style={{
                              outlineWidth: 0,
                              boxShadow: "none",
                              background: "#333",
                            }}
                            placeholder="Link URL"
                          />
                          
                          {/* Error message for duplicate URL */}
                          <AnimatePresence>
                            {uiState.duplicateUrlError && (
                              <motion.p 
                                className="text-red-500 text-xs mt-1"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                              >
                                This URL has already been added. Please use a different URL.
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
                      <div className="flex">
                        <div className="flex-none p-3 flex items-center justify-center">
                          {getSocialIcon(link.platform)}
                        </div>
                        <div className="flex-1 p-3 border-l border-[#2a2a2a]">
                          <div className="flex flex-col justify-start">
                            <span className="font-medium">{link.title}</span>
                            <div className="text-gray-400 text-xs mt-1 truncate">{link.url}</div>
                          </div>
                          <div className="flex items-center justify-end">
                            <motion.button
                              onClick={() => handleEditLink(index)}
                              className="p-1 text-gray-400 hover:text-white"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <Edit2 size={16} />
                            </motion.button>
                            <motion.button
                              onClick={() => handleDeleteLink(index)}
                              className="p-1 text-gray-400 hover:text-red-500 ml-1"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <Trash2 size={16} />
                            </motion.button>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Language Section */}
        <motion.div
          className="bg-[#1a1a1a] rounded-lg p-4 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <h2 className="text-purple-500 text-lg mb-4">Language</h2>
          <div
            className={`w-full bg-[#2a2a2a] rounded-lg px-4 py-3 text-white text-sm flex justify-between items-center cursor-pointer ${
              uiState.focusedInput === "language" ? "border border-purple-600" : "border border-transparent"
            } transition-all duration-200`}
            onClick={() => updateUiState({ focusedInput: "language", showLanguageModal: true })}
          >
            <span>{formState.language}</span>
            <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M1 1.5L6 6.5L11 1.5"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </motion.div>

        {/* Save Button */}
        <motion.div
          className="flex justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          {uiState.saveError && <p className="text-red-500 mr-4 self-center">{uiState.saveError}</p>}
          {uiState.saveSuccess && <p className="text-green-500 mr-4 self-center">Changes saved successfully!</p>}
          <motion.button
            onClick={handleSaveChanges}
            disabled={uiState.isSaving}
            className="bg-purple-700 hover:bg-purple-800 text-white px-6 py-3 rounded-md transition text-sm disabled:opacity-50"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {uiState.isSaving ? "Saving..." : "Save Changes"}
          </motion.button>
        </motion.div>
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

      {/* Language Modal */}
      <AnimatePresence>
        {uiState.showLanguageModal && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="bg-[#1a1a1a] rounded-lg w-full max-w-md p-6 relative"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-purple-500 text-xl font-medium">Select Language</h2>
                <motion.button
                  onClick={() => updateUiState({ showLanguageModal: false })}
                  className="text-gray-400 hover:text-white"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X size={24} />
                </motion.button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto">
                {languages.map((lang, index) => (
                  <motion.div
                    key={lang}
                    onClick={() => handleLanguageSelect(lang)}
                    className={`flex items-center gap-3 p-3 rounded-md cursor-pointer ${
                      formState.language === lang ? "bg-purple-900 bg-opacity-50" : "bg-[#2a2a2a] hover:bg-[#333]"
                    }`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.03 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="text-sm">{lang}</span>
                    {formState.language === lang && <div className="ml-auto w-2 h-2 rounded-full bg-purple-500"></div>}
                  </motion.div>
                ))}
              </div>

              <div className="mt-6 flex justify-end">
                <motion.button
                  onClick={() => updateUiState({ showLanguageModal: false })}
                  className="bg-purple-700 hover:bg-purple-800 text-white px-6 py-2 rounded-md transition text-sm"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Close
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
