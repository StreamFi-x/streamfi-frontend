import { StellarPublicKey } from "@/types/user";

export interface GiftMessageMetadata {
  gift_name: string;
  gift_emoji: string;
  usd_value: string;
  tx_hash: string;
  animation?: string;
}

export type ChatMessageType = "message" | "emote" | "system" | "gift";

/** Message as returned by the chat API */
export interface ChatMessageAPI {
  id: number;
  content: string;
  messageType: ChatMessageType;
  createdAt: string;
  metadata?: GiftMessageMetadata | null;
  user: {
    username: string;
    /** Stellar public key (G..., 56 characters) */
    wallet: StellarPublicKey;
    avatar: string | null;
  };
}

/** Normalized message used by all chat UI components */
export interface ChatMessage {
  id: number;
  username: string;
  message: string;
  color: string;
  avatar?: string | null;
  /** Stellar public key (G..., 56 characters) */
  wallet?: StellarPublicKey;
  messageType: ChatMessageType;
  createdAt: string;
  metadata?: GiftMessageMetadata | null;
  /** True while an optimistic message is being confirmed by the API */
  isPending?: boolean;
}

/** Payload for sending a chat message */
export interface SendChatMessagePayload {
  /** Stellar public key (G..., 56 characters) */
  wallet: StellarPublicKey;
  playbackId: string;
  content: string;
  messageType?: ChatMessageType;
  metadata?: GiftMessageMetadata;
}

export interface SendGiftMessagePayload {
  wallet: StellarPublicKey;
  playbackId: string;
  content: string;
  metadata: GiftMessageMetadata;
}

/** Return type of the useChat hook */
export interface UseChatReturn {
  messages: ChatMessage[];
  sendMessage: (content: string) => Promise<void>;
  sendGiftMessage: (payload: SendGiftMessagePayload) => Promise<void>;
  deleteMessage: (messageId: number) => Promise<void>;
  /** Placeholder until chat moderation API exists */
  banUser: (username: string, durationMinutes?: number) => Promise<void>;
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
}

/** Chat ban record */
export interface ChatBan {
  id: string;
  bannedUser: string;
  bannedAt: string;
  expiresAt: string | null;
  reason: string | null;
}

/** Stream chat settings */
export interface StreamChatSettings {
  slowModeSeconds: number;
  followerOnlyChat: boolean;
  linkBlocking: boolean;
}
