import type { StreamSample } from "./types";

const STREAMS: StreamSample[] = [
  {
    stream_id: "stream-hl-1",
    duration_seconds: 300,
    chat_events: [
      // Spike at 60–90s (20 msgs)
      ...[62,63,65,66,68,70,72,74,75,78,80,81,82,83,85,86,87,88,89,90].map(s => ({ offset_seconds: s })),
      // Quieter burst at 150–180s (8 msgs)
      ...[151,155,158,162,167,170,174,178].map(s => ({ offset_seconds: s })),
      // Scattered noise
      ...[10,30,210,240,270].map(s => ({ offset_seconds: s })),
    ],
    tip_events: [
      { offset_seconds: 75, amount_usdc: 50 },
      { offset_seconds: 82, amount_usdc: 20 },
      // Tip spike at 200–230s
      { offset_seconds: 205, amount_usdc: 100 },
      { offset_seconds: 215, amount_usdc: 75 },
    ],
  },
  {
    stream_id: "stream-hl-2",
    duration_seconds: 600,
    chat_events: [
      ...[5,10,15,20,25,30,35,40,45,50,55,60].map(s => ({ offset_seconds: s })),
      ...[120,122,125,128,130,132,135,138,140,142,145,148,149].map(s => ({ offset_seconds: s })),
      ...[300,350,400].map(s => ({ offset_seconds: s })),
    ],
    tip_events: [
      { offset_seconds: 130, amount_usdc: 200 },
      { offset_seconds: 145, amount_usdc: 50 },
      { offset_seconds: 10, amount_usdc: 5 },
    ],
  },
];

export function getStream(streamId: string): StreamSample | undefined {
  return STREAMS.find(s => s.stream_id === streamId);
}

export function allStreamIds(): string[] {
  return STREAMS.map(s => s.stream_id);
}
