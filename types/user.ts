/** Stellar public key — 56-character Base32 string starting with 'G' */
export type StellarPublicKey = string;

export interface SocialLink {
  socialTitle: string;
  socialLink: string;
}

export interface Creator {
  streamTitle: string;
  tags: string[];
  category: string;
  payout: string;
}

export interface User {
  id: string;
  /** Stellar public key (G..., 56 characters) */
  wallet: StellarPublicKey;
  username: string;
  email: string;
  streamkey?: string;
  avatar?: string;
  bio?: string;
  socialLinks: SocialLink[];
  emailVerified?: boolean;
  emailNotifications?: boolean;
  creator: Creator;
  created_at: string;
  updated_at: string;
  /** When true, Mux records live streams and makes them available as VOD. Default false. */
  enable_recording?: boolean;
}

export interface UserRegistrationInput {
  email: string;
  username: string;
  /** Stellar public key (G..., 56 characters) */
  wallet: StellarPublicKey;
  socialLinks?: SocialLink[];
  emailNotifications?: boolean;
  creator?: Partial<Creator>;
}

export type UserUpdateInput = {
  username?: string;
  email?: string;
  bio?: string;
  /** Stellar public key (G..., 56 characters) */
  wallet?: StellarPublicKey;
  avatar?: string | File;
  streamkey?: string;
  emailVerified?: boolean;
  emailNotifications?: boolean;
  socialLinks?: Record<string, string>;
  creator?: Creator;
  enable_recording?: boolean;
};
