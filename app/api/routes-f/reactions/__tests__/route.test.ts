jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

jest.mock("@/app/api/routes-f/_lib/session", () => ({
  getOptionalSession: jest.fn(),
}));

jest.mock("../_lib/reactions", () => ({
  REACTIONS: ["❤️", "🔥", "😂", "👏", "💜", "🎉", "😮", "👑"],
  reactionEmojiSchema: require("zod").z.enum([
    "❤️",
    "🔥",
    "😂",
    "👏",
    "💜",
    "🎉",
    "😮",
    "👑",
  ]),
  enforceReactionRateLimit: jest.fn(),
  getReactionSummary: jest.fn(),
  incrementReaction: jest.fn(),
}));

import { getOptionalSession } from "@/app/api/routes-f/_lib/session";
import {
  enforceReactionRateLimit,
  getReactionSummary,
  incrementReaction,
} from "../_lib/reactions";
import { GET, POST } from "../[streamId]/route";

const getOptionalSessionMock = getOptionalSession as jest.Mock;
const enforceReactionRateLimitMock = enforceReactionRateLimit as jest.Mock;
const getReactionSummaryMock = getReactionSummary as jest.Mock;
const incrementReactionMock = incrementReaction as jest.Mock;

function makeRequest(method: string, path: string, body?: object) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;
}

describe("routes-f reactions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getOptionalSessionMock.mockResolvedValue(null);
    enforceReactionRateLimitMock.mockResolvedValue(false);
    getReactionSummaryMock.mockResolvedValue({
      reactions: { "🔥": 3 },
      total: 3,
    });
    incrementReactionMock.mockResolvedValue(undefined);
  });

  it("returns reaction counts for a stream", async () => {
    const res = await GET(
      makeRequest("GET", "/api/routes-f/reactions/stream-1"),
      {
        params: Promise.resolve({ streamId: "stream-1" }),
      }
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.total).toBe(3);
    expect(json.reactions["🔥"]).toBe(3);
  });

  it("records an anonymous reaction", async () => {
    const res = await POST(
      makeRequest("POST", "/api/routes-f/reactions/stream-1", { emoji: "🔥" }),
      { params: Promise.resolve({ streamId: "stream-1" }) }
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(incrementReactionMock).toHaveBeenCalledWith("stream-1", "🔥");
    expect(json.total).toBe(3);
  });

  it("returns 429 when reaction rate limit is hit", async () => {
    enforceReactionRateLimitMock.mockResolvedValue(true);

    const res = await POST(
      makeRequest("POST", "/api/routes-f/reactions/stream-1", { emoji: "🔥" }),
      { params: Promise.resolve({ streamId: "stream-1" }) }
    );

    expect(res.status).toBe(429);
  });
});
