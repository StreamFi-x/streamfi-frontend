export type ViewerSample = {
  minute: number;
  viewer_count: number;
};

export type StreamViewerData = {
  stream_id: string;
  samples: ViewerSample[];
};

const SEED: StreamViewerData[] = [
  {
    stream_id: "stream_001",
    samples: [
      { minute: 0, viewer_count: 1000 },
      { minute: 5, viewer_count: 800 },
      { minute: 10, viewer_count: 500 },
      { minute: 15, viewer_count: 200 },
      { minute: 20, viewer_count: 100 },
    ],
  },
  {
    stream_id: "stream_002",
    samples: [
      { minute: 0, viewer_count: 400 },
      { minute: 5, viewer_count: 395 },
      { minute: 10, viewer_count: 410 },
      { minute: 15, viewer_count: 390 },
      { minute: 20, viewer_count: 405 },
    ],
  },
];

export function getSeedStreamData(streamId: string): StreamViewerData | null {
  return SEED.find((s) => s.stream_id === streamId) ?? null;
}