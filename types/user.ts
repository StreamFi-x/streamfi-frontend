// types/user.ts

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
  wallet: string;
  username: string;
  email: string;
  streamkey?: string;
  avatar?: string;
  bio?: string;
  socialLinks: SocialLink[];
  emailVerified: boolean;
  emailNotifications: boolean;
  creator: Creator;
  created_at: string;
  updated_at: string;
}

export interface UserRegistrationInput {
  email: string;
  username: string;
  wallet: string;
  socialLinks?: SocialLink[];
  emailNotifications?: boolean;
  creator?: Partial<Creator>;
}

export interface UserUpdateInput {
  username?: string;
  email?: string;
  streamkey?: string;
  avatar?: string;
  bio?: string;
  socialLinks?: SocialLink[];
  emailVerified?: boolean;
  emailNotifications?: boolean;
  creator?: Partial<Creator>;
}