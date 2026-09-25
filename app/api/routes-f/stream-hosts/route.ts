/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server";

export type HostRole = "host" | "guest" | "co-host";

export interface StreamHost {
  stream_id: string;
  host_user_id: string;
  role: HostRole;
  added_at: number;
}

let streamHosts: StreamHost[] = [];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const streamId = searchParams.get("stream_id");

  if (!streamId) {
    return NextResponse.json({ error: "stream_id is required" }, { status: 400 });
  }

  const hosts = streamHosts.filter((sh) => sh.stream_id === streamId);
  return NextResponse.json({ hosts }, { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stream_id, host_user_id, role } = body;

    if (!stream_id || !host_user_id || !role) {
      return NextResponse.json(
        { error: "stream_id, host_user_id, and role are required" },
        { status: 400 }
      );
    }

    if (!["host", "guest", "co-host"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Check cap
    const currentHosts = streamHosts.filter((sh) => sh.stream_id === stream_id);
    
    // Check if host already exists
    const existingIndex = streamHosts.findIndex(
      (sh) => sh.stream_id === stream_id && sh.host_user_id === host_user_id
    );

    if (existingIndex < 0 && currentHosts.length >= 4) {
      return NextResponse.json(
        { error: "Maximum number of hosts (4) reached" },
        { status: 403 }
      );
    }

    const added_at = Date.now();
    const newHost: StreamHost = { stream_id, host_user_id, role, added_at };

    if (existingIndex >= 0) {
      streamHosts[existingIndex] = newHost;
    } else {
      streamHosts.push(newHost);
    }

    return NextResponse.json({ added_at: newHost.added_at }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const streamId = searchParams.get("stream_id");
  const hostUserId = searchParams.get("host_user_id");

  if (!streamId || !hostUserId) {
    return NextResponse.json(
      { error: "stream_id and host_user_id are required" },
      { status: 400 }
    );
  }

  const initialLength = streamHosts.length;
  streamHosts = streamHosts.filter(
    (sh) => !(sh.stream_id === streamId && sh.host_user_id === hostUserId)
  );

  if (streamHosts.length === initialLength) {
    return NextResponse.json({ error: "Host not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}

// For testing purposes
export function _resetStreamHosts() {
  streamHosts = [];
}
