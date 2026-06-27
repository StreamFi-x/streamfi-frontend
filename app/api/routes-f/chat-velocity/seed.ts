import type { ChatStream } from "./types";

/** Seed timestamped chat events for velocity analysis. */
export function getChatStreams(): ChatStream[] {
  return [
    {
      stream_id: "stream_chat_1",
      title: "Morning Crypto Chat",
      events: [
        { message_id: "m1", offset_seconds: 5 },
        { message_id: "m2", offset_seconds: 12 },
        { message_id: "m3", offset_seconds: 45 },
        { message_id: "m4", offset_seconds: 58 },
        { message_id: "m5", offset_seconds: 62 },
        { message_id: "m6", offset_seconds: 75 },
        { message_id: "m7", offset_seconds: 90 },
        { message_id: "m8", offset_seconds: 95 },
        { message_id: "m9", offset_seconds: 110 },
        { message_id: "m10", offset_seconds: 125 },
        { message_id: "m11", offset_seconds: 130 },
        { message_id: "m12", offset_seconds: 145 },
        { message_id: "m13", offset_seconds: 180 },
        { message_id: "m14", offset_seconds: 185 },
        { message_id: "m15", offset_seconds: 240 },
      ],
    },
    {
      stream_id: "stream_chat_2",
      title: "Quiet VOD Replay",
      events: [
        { message_id: "q1", offset_seconds: 10 },
        { message_id: "q2", offset_seconds: 70 },
        { message_id: "q3", offset_seconds: 130 },
      ],
    },
    {
      stream_id: "stream_chat_empty",
      title: "Silent Stream",
      events: [],
    },
  ];
}

export function getChatStream(streamId: string): ChatStream | undefined {
  return getChatStreams().find(s => s.stream_id === streamId);
}
