export interface LiveAnnouncementConfig {
  throttleIntervalMs: number; // minimum delay between screen-reader announcements
  stormThreshold: number; // msgs/sec threshold to switch to batch summary mode
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
}

export class AccessibleChatAnnouncer {
  private config: LiveAnnouncementConfig;
  private messageQueue: ChatMessage[] = [];
  private lastAnnouncementTime = 0;

  constructor(config: Partial<LiveAnnouncementConfig> = {}) {
    this.config = {
      throttleIntervalMs: config.throttleIntervalMs ?? 1500,
      stormThreshold: config.stormThreshold ?? 5,
    };
  }

  /**
   * Processes incoming chat message and produces throttled/polite screen reader announcement text.
   */
  public enqueueMessage(message: ChatMessage): string | null {
    const now = Date.now();
    this.messageQueue.push(message);

    // Filter messages in the last 2 seconds to calculate arrival rate
    this.messageQueue = this.messageQueue.filter((m) => now - m.timestamp < 2000);
    const messageRate = this.messageQueue.length / 2;

    if (now - this.lastAnnouncementTime < this.config.throttleIntervalMs) {
      return null;
    }

    this.lastAnnouncementTime = now;

    if (messageRate >= this.config.stormThreshold) {
      return `Fast chat activity: ${this.messageQueue.length} new messages, latest from ${message.sender}: ${message.text}`;
    }

    return `${message.sender} says: ${message.text}`;
  }

  /**
   * Returns keyboard focus & accessibility attributes for moderation buttons.
   */
  public static getModeratorActionA11y(action: 'timeout' | 'ban' | 'delete', targetUser: string) {
    return {
      role: 'button',
      tabIndex: 0,
      'aria-label': `${action.toUpperCase()} ${targetUser}`,
      'data-action': action,
    };
  }
}
