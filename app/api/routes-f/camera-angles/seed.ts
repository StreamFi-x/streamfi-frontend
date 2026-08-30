import type { MultiAngleStream } from "./types";

/** Seed streams that broadcast from multiple Mux camera angles. */
export function getMultiAngleStreams(): MultiAngleStream[] {
  return [
    {
      stream_id: "stream_multi_1",
      title: "Esports Finals — Multi-Cam",
      angles: [
        { id: "main", label: "Main Stage", playback_id: "mux_playback_main_01" },
        { id: "caster", label: "Caster Desk", playback_id: "mux_playback_caster_01" },
        { id: "map", label: "Map Overview", playback_id: "mux_playback_map_01" },
      ],
    },
    {
      stream_id: "stream_multi_2",
      title: "Music Festival Live",
      angles: [
        { id: "stage", label: "Main Stage", playback_id: "mux_playback_stage_02" },
        { id: "crowd", label: "Crowd Cam", playback_id: "mux_playback_crowd_02" },
      ],
    },
    {
      stream_id: "stream_single_1",
      title: "Solo Creator Stream",
      angles: [
        { id: "primary", label: "Primary", playback_id: "mux_playback_solo_01" },
      ],
    },
  ];
}

export function getStreamById(streamId: string): MultiAngleStream | undefined {
  return getMultiAngleStreams().find(s => s.stream_id === streamId);
}

export function findAngle(
  streamId: string,
  angleId: string
): { stream: MultiAngleStream; angle: MultiAngleStream["angles"][number] } | undefined {
  const stream = getStreamById(streamId);
  if (!stream) {return undefined;}
  const angle = stream.angles.find(a => a.id === angleId);
  if (!angle) {return undefined;}
  return { stream, angle };
}
