import { StellarPublicKey } from "@/types/user";

/** Message as returned by the chat API */
export interface ChatMessageAPI {
  id: number;
  content: string;
  messageType: "message" | "emote" | "system";
  createdAt: string;
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
  messageType: "message" | "emote" | "system";
  createdAt: string;
  /** True while an optimistic message is being confirmed by the API */
  isPending?: boolean;
}

/** Payload for sending a chat message */
export interface SendChatMessagePayload {
  /** Stellar public key (G..., 56 characters) */
  wallet: StellarPublicKey;
  playbackId: string;
  content: string;
  messageType?: "message" | "emote" | "system";
}

/** Return type of the useChat hook */
export interface UseChatReturn {
  messages: ChatMessage[];
  sendMessage: (content: string) => Promise<void>;
  deleteMessage: (messageId: number) => Promise<void>;
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
}
