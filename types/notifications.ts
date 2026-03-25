export const notificationTypes = [
  "new_follower",
  "tip_received",
  "stream_live",
  "stream_ended",
  "recording_ready",
] as const;

export type NotificationType = (typeof notificationTypes)[number];

export interface NotificationMetadata {
  url?: string;
  followerId?: string;
  followerUsername?: string;
  senderWallet?: string;
  amount?: string;
  txHash?: string;
  paymentId?: string;
  playbackId?: string;
  recordingId?: string;
  recordingPlaybackId?: string;
  username?: string;
  [key: string]: boolean | number | string | null | undefined;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string | null;
  metadata: NotificationMetadata | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationCursor {
  createdAt: string;
  id: string;
}

export interface NotificationPreferences {
  newFollower: boolean;
  tipReceived: boolean;
  streamLive: boolean;
  recordingReady: boolean;
  emailNotifications: boolean;
}

export const defaultNotificationPreferences: NotificationPreferences = {
  newFollower: true,
  tipReceived: true,
  streamLive: true,
  recordingReady: true,
  emailNotifications: true,
};

export const notificationPreferenceKeyByType: Partial<
  Record<NotificationType, keyof NotificationPreferences>
> = {
  new_follower: "newFollower",
  tip_received: "tipReceived",
  stream_live: "streamLive",
  recording_ready: "recordingReady",
};