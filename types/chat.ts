import { StellarPublicKey } from "@/types/user";

/** Message as returned by the chat API */
export interface ChatMessageAPI {
  /** chat_messages.id (uuid) */
  id: string;
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

/** GET /api/streams/chat response (shared cursor contract, newest first) */
export interface ChatPage {
  items: ChatMessageAPI[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** Normalized message used by all chat UI components */
export interface ChatMessage {
  /** Server uuid, or `pending-N` for an optimistic message */
  id: string;
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
  /** Oldest first, ready to render */
  messages: ChatMessage[];
  sendMessage: (content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  /** Loads the next page of older history */
  loadOlder: () => void;
  hasOlder: boolean;
  isLoadingOlder: boolean;
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
}
