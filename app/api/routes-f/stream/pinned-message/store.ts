import type { PinnedMessage } from "./types";

export const pinnedMessages = new Map<string, PinnedMessage>();

export function pinMessage(
  stream_id: string,
  message_id: string,
  message_text: string,
  pinned_by: string,
  expires_at?: string
): PinnedMessage {
  const pin: PinnedMessage = {
    stream_id,
    message_id,
    message_text,
    pinned_by,
    pinned_at: new Date().toISOString(),
    expires_at,
  };
  pinnedMessages.set(stream_id, pin);
  return pin;
}

export function unpinMessage(stream_id: string): boolean {
  return pinnedMessages.delete(stream_id);
}

export function getPinnedMessage(stream_id: string): PinnedMessage | null {
  const pin = pinnedMessages.get(stream_id);
  if (!pin) {return null;}

  if (pin.expires_at && new Date(pin.expires_at).getTime() <= Date.now()) {
    pinnedMessages.delete(stream_id);
    return null;
  }

  return pin;
}
