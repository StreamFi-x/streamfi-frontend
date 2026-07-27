import { NextRequest, NextResponse } from "next/server";

type RequestStatus = "queued" | "ready" | "failed";

type VodDownloadRequest = {
  request_id: string;
  vod_id: string;
  requester_id: string;
  status: RequestStatus;
  queued_at: number;
  download_url?: string;
};

type PostBody = {
  vod_id: string;
  requester_id: string;
};

const AUTO_COMPLETE_MS = 8_000;

const requests = new Map<string, VodDownloadRequest>();
const pendingByViewer = new Map<string, string>();

let counter = 0;

function generateRequestId(): string {
  counter += 1;
  return `vdl-${Date.now()}-${counter}`;
}

function pendingKey(requesterId: string, vodId: string): string {
  return `${requesterId}::${vodId}`;
}

function mockDownloadUrl(vodId: string): string {
  return `https://cdn.streamfi.io/vods/${vodId}/download.mp4?token=mock`;
}

function resolveStatus(req: VodDownloadRequest): VodDownloadRequest {
  if (req.status === "queued" && Date.now() - req.queued_at >= AUTO_COMPLETE_MS) {
    const resolved = { ...req, status: "ready" as RequestStatus, download_url: mockDownloadUrl(req.vod_id) };
    pendingByViewer.delete(pendingKey(req.requester_id, req.vod_id));
    return resolved;
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

  const { vod_id, requester_id } = (body ?? {}) as PostBody;

  if (!vod_id || typeof vod_id !== "string") {
    return NextResponse.json({ error: "vod_id is required" }, { status: 400 });
  }
  if (!requester_id || typeof requester_id !== "string") {
    return NextResponse.json({ error: "requester_id is required" }, { status: 400 });
  }

  const key = pendingKey(requester_id, vod_id);
  const existingId = pendingByViewer.get(key);
  if (existingId) {
    const existing = requests.get(existingId);
    if (existing) {
      const resolved = resolveStatus(existing);
      requests.set(existingId, resolved);
      if (resolved.status === "queued") {
        return NextResponse.json(
          { error: "A pending download request already exists", request_id: existingId },
          { status: 409 }
        );
      }
    }
  }

  const request_id = generateRequestId();
  const entry: VodDownloadRequest = {
    request_id,
    vod_id,
    requester_id,
    status: "queued",
    queued_at: Date.now(),
  };
  requests.set(request_id, entry);
  pendingByViewer.set(key, request_id);

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
