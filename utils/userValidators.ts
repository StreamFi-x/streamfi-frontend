// utils/userValidators.ts
import type { UserRegistrationInput, UserUpdateInput } from "../types/user" // Make sure these types are correctly defined in types/user.ts

/**
 * Validates a single social link object (used for array of social links)
 */
export function validateSocialLink(socialLink: any): boolean {
  if (!socialLink || typeof socialLink !== "object") return false

  // Check if url exists and is a string
  if (!socialLink.url || typeof socialLink.url !== "string") return false

  // Check if title exists and is a string
  if (!socialLink.title || typeof socialLink.title !== "string") return false

  // Check if platform exists and is a string
  if (!socialLink.platform || typeof socialLink.platform !== "string") return false

  // Basic URL validation
  try {
    new URL(socialLink.url)
    return true
  } catch (error) {
    return false
  }
}

/**
 * Validates an array of social links (SocialLink[])
 */
export function validateSocialLinksArray(socialLinks: any): boolean {
  if (!Array.isArray(socialLinks)) return false
  if (socialLinks.length === 0) return true
  return socialLinks.every((link) => validateSocialLink(link))
}

/**
 * Validates a social links object (Record<string, string>)
 */
export function validateSocialLinksRecord(socialLinks: any): boolean {
  if (!socialLinks || typeof socialLinks !== "object" || Array.isArray(socialLinks)) return false

  for (const key in socialLinks) {
    if (Object.prototype.hasOwnProperty.call(socialLinks, key)) {
      const url = socialLinks[key]
      if (typeof url !== "string") return false
      // Basic URL validation
      try {
        new URL(url)
      } catch (error) {
        return false
      }
    }
  }
  return true
}

/**
 * Validates creator object
 */
export function validateCreator(creator: any): boolean {
  if (!creator || typeof creator !== "object") return false

  // streamTitle should be a string if provided
  if (creator.streamTitle !== undefined && typeof creator.streamTitle !== "string") return false

  // tags should be an array of strings if provided
  if (creator.tags !== undefined) {
    if (!Array.isArray(creator.tags)) return false
    if (!creator.tags.every((tag: string) => typeof tag === "string")) return false
  }

  // category should be a string if provided
  if (creator.category !== undefined && typeof creator.category !== "string") return false

  // payout should be a string if provided
  if (creator.payout !== undefined && typeof creator.payout !== "string") return false

  return true
}

/**
 * Validates a complete user registration input
 */
export function validateUserRegistration(input: UserRegistrationInput): {
  isValid: boolean
  error?: string
} {
  // Check required fields
  if (!input.email) return { isValid: false, error: "Email is required" }
  if (!input.username) return { isValid: false, error: "Username is required" }
  if (!input.wallet) return { isValid: false, error: "Wallet is required" }

  // Validate social links if provided (assuming SocialLink[] for registration based on YAML, though YAML is ambiguous)
  if (input.socialLinks && !validateSocialLinksArray(input.socialLinks)) {
    return { isValid: false, error: "Invalid social links format" }
  }

  // Validate creator object if provided
  if (input.creator && !validateCreator(input.creator)) {
    return { isValid: false, error: "Invalid creator data format" }
  }

  return { isValid: true }
}

/**
 * Validates user update input
 */
export function validateUserUpdate(input: UserUpdateInput): {
  isValid: boolean
  error?: string
} {
  // Check if at least one field is provided
  if (Object.keys(input).length === 0) {
    return { isValid: false, error: "No update fields provided" }
  }

  // Validate social links if provided (now expecting Record<string, string> for updates)
  if (input.socialLinks && !validateSocialLinksRecord(input.socialLinks)) {
    return { isValid: false, error: "Invalid social links format" }
  }

  // Validate creator object if provided
  if (input.creator && !validateCreator(input.creator)) {
    return { isValid: false, error: "Invalid creator data format" }
  }

  return { isValid: true }
}
