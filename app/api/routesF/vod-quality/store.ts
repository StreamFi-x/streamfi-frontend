// Seed VOD renditions and viewer quality preferences, bundled inside this
// folder per the routesF scope constraint.

export interface VodQuality {
  label: string;
  resolution: string;
  bitrate_kbps: number;
}

// playback_id -> available renditions (what Mux would report per asset)
export const VOD_QUALITIES: Record<string, VodQuality[]> = {
  'vod-raid-recap': [
    { label: '1080p', resolution: '1920x1080', bitrate_kbps: 5000 },
    { label: '720p', resolution: '1280x720', bitrate_kbps: 2800 },
    { label: '480p', resolution: '854x480', bitrate_kbps: 1200 },
    { label: '360p', resolution: '640x360', bitrate_kbps: 700 },
  ],
  'vod-speedrun-finals': [
    { label: '720p', resolution: '1280x720', bitrate_kbps: 2800 },
    { label: '480p', resolution: '854x480', bitrate_kbps: 1200 },
  ],
};

// viewer_id -> playback_id -> selected quality label
export const QUALITY_SELECTIONS: Record<string, Record<string, string>> = {};
