/** Message as returned by the chat API */
export interface ChatMessageAPI {
  id: number;
  content: string;
  messageType: "message" | "emote" | "system";
  createdAt: string;
  user: {
    username: string;
    wallet: string;
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
  wallet?: string;
  messageType: "message" | "emote" | "system";
  createdAt: string;
  /** True while an optimistic message is being confirmed by the API */
  isPending?: boolean;
}

/** Payload for sending a chat message */
export interface SendChatMessagePayload {
  wallet: string;
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
