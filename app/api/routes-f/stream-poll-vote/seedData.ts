import type { Poll } from "./types";

export const pollStore = new Map<string, Poll>([
  [
    "poll_open_1",
    {
      poll_id: "poll_open_1",
      stream_id: "stream_a",
      question: "What should we play next?",
      choices: [
        { label: "Platformer", votes: 0 },
        { label: "Puzzle", votes: 0 },
        { label: "Shooter", votes: 0 },
      ],
      deadline: "2099-01-01T00:00:00.000Z",
      voters: new Set(),
    },
  ],
  [
    "poll_expired",
    {
      poll_id: "poll_expired",
      stream_id: "stream_a",
      question: "Should we extend the stream?",
      choices: [
        { label: "Yes", votes: 3 },
        { label: "No", votes: 1 },
      ],
      deadline: "2020-01-01T00:00:00.000Z",
      voters: new Set(["viewer_1"]),
    },
  ],
]);
