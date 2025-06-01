// Types
export type Platform =
  | "instagram"
  | "twitter"
  | "facebook"
  | "youtube"
  | "telegram"
  | "discord"
  | "tiktok"
  | "other";
export interface SocialLink {
  url: string;
  title: string;
  platform: Platform;
  isEditing?: boolean;
}

export interface FormState {
  username: string;
  email: string;
  bio: string;
  wallet: string;
  socialLinkUrl: string;
  socialLinkTitle: string;
  language: string;
}

export interface EditState {
  editingLink: string;
  editingTitle: string;
  isEditing: boolean;
  editingIndex: number | null;
}

export interface UIState {
  focusedInput: string | null;
  showVerificationPopup: boolean;
  showAvatarModal: boolean;
  showLanguageModal: boolean;
  isSaving: boolean;
  saveSuccess: boolean;
  saveError: string;
  duplicateUrlError: boolean;
}
