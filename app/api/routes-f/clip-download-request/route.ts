import { NextRequest, NextResponse } from "next/server";

type ClipFormat = "mp4" | "gif";
type RequestStatus = "queued" | "ready" | "failed";

type DownloadRequest = {
  request_id: string;
  clip_id: string;
  requester_id: string;
  format: ClipFormat;
  status: RequestStatus;
  queued_at: number;
  download_url?: string;
};

type PostBody = {
  clip_id: string;
  requester_id: string;
  format?: ClipFormat;
};

const VALID_FORMATS: ClipFormat[] = ["mp4", "gif"];
const AUTO_COMPLETE_MS = 5_000;

const requests = new Map<string, DownloadRequest>();
let counter = 0;

function generateRequestId(): string {
  counter += 1;
  return `cdl-${Date.now()}-${counter}`;
}

function mockDownloadUrl(clipId: string, format: ClipFormat): string {
  return `https://cdn.streamfi.io/clips/${clipId}/download.${format}?token=mock`;
}

function resolveStatus(req: DownloadRequest): DownloadRequest {
  if (req.status === "queued" && Date.now() - req.queued_at >= AUTO_COMPLETE_MS) {
    return { ...req, status: "ready", download_url: mockDownloadUrl(req.clip_id, req.format) };
  }
  return req;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { clip_id, requester_id, format = "mp4" } = (body ?? {}) as PostBody;

  if (!clip_id || typeof clip_id !== "string") {
    return NextResponse.json({ error: "clip_id is required" }, { status: 400 });
  }
  if (!requester_id || typeof requester_id !== "string") {
    return NextResponse.json({ error: "requester_id is required" }, { status: 400 });
  }
  if (!VALID_FORMATS.includes(format)) {
    return NextResponse.json({ error: "format must be mp4 or gif" }, { status: 400 });
  }

  const request_id = generateRequestId();
  const entry: DownloadRequest = {
    request_id,
    clip_id,
    requester_id,
    format,
    status: "queued",
    queued_at: Date.now(),
  };
  requests.set(request_id, entry);

  return NextResponse.json({ request_id, status: "queued" }, { status: 202 });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const request_id = searchParams.get("request_id");

  if (!request_id) {
    return NextResponse.json({ error: "request_id query param is required" }, { status: 400 });
  }

  const entry = requests.get(request_id);
  if (!entry) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const resolved = resolveStatus(entry);
  requests.set(request_id, resolved);

  const response: { request_id: string; status: RequestStatus; download_url?: string } = {
    request_id: resolved.request_id,
    status: resolved.status,
  };
  if (resolved.download_url) {
    response.download_url = resolved.download_url;
  }

  return NextResponse.json(response);
}
