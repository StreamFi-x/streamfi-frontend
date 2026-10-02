/**
 * Seed caption tracks for the closed-captions endpoint.
 * Self-contained inside app/api/routes-f/ — do not import from outside.
 */
export interface CaptionTrack {
  lang: string;
  label: string;
  url: string;
}

export interface PlaybackTracks {
  playback_id: string;
  tracks: CaptionTrack[];
}

export const SEED_TRACKS: PlaybackTracks[] = [
  {
    playback_id: "playback-001",
    tracks: [
      { lang: "en", label: "English", url: "/captions/en.vtt" },
      { lang: "es", label: "Spanish", url: "/captions/es.vtt" },
    ],
  },
  {
    playback_id: "playback-002",
    tracks: [
      { lang: "en", label: "English", url: "/captions/en-002.vtt" },
      { lang: "fr", label: "French", url: "/captions/fr-002.vtt" },
      { lang: "de", label: "German", url: "/captions/de-002.vtt" },
    ],
  },
];
