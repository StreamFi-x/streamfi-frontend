import type { Stinger } from "./types";

export const DEFAULT_STINGER: Stinger = {
  id: "default",
  name: "StreamFi Default",
  url: "https://cdn.streamfi.io/stingers/default.webm",
};

export interface CreatorStingerState {
  active: string | null;
  library: Stinger[];
}

// In-memory store keyed by creator_id
export const stingerStore: Record<string, CreatorStingerState> = {
  creator_alice: {
    active: "default",
    library: [
      DEFAULT_STINGER,
      { id: "flash-blue", name: "Flash Blue", url: "https://cdn.streamfi.io/stingers/flash-blue.webm" },
      { id: "glitch-red", name: "Glitch Red", url: "https://cdn.streamfi.io/stingers/glitch-red.webm" },
    ],
  },
  creator_bob: {
    active: null,
    library: [DEFAULT_STINGER],
  },
};

export const LIBRARY_CAP = 10;
