export interface ChannelOgData {
  kind: "channel";
  displayName: string;
  isLive: boolean;
  streamTitle: string | null;
}

export interface ClipOgData {
  kind: "clip";
  displayName: string;
  clipTitle: string;
  thumbnailUrl: string | null;
}

export type OgImageData = ChannelOgData | ClipOgData;
