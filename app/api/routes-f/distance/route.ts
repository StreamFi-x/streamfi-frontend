import { NextRequest, NextResponse } from "next/server";
import { haversineKm, isValidPoint, kmToMi, Point, round3 } from "./_lib/haversine";

const MAX_WAYPOINTS = 100;

type DistanceBody = {
  from?: unknown;
  to?: unknown;
  waypoints?: unknown;
};

export async function POST(req: NextRequest) {
  let body: DistanceBody;
  try {
    body = (await req.json()) as DistanceBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidPoint(body.from) || !isValidPoint(body.to)) {
    return NextResponse.json(
      { error: "from and to must be valid [lat, lng] points in range" },
      { status: 400 },
    );
  }

  let waypoints: Point[] = [];
  if (body.waypoints !== undefined) {
    if (!Array.isArray(body.waypoints)) {
      return NextResponse.json({ error: "waypoints must be an array" }, { status: 400 });
    }
    if (body.waypoints.length > MAX_WAYPOINTS) {
      return NextResponse.json(
        { error: `waypoints must contain at most ${MAX_WAYPOINTS} points` },
        { status: 400 },
      );
    }
    if (!body.waypoints.every(isValidPoint)) {
      return NextResponse.json(
        { error: "each waypoint must be a valid [lat, lng] point in range" },
        { status: 400 },
      );
    }
    waypoints = body.waypoints;
  }

  const points: Point[] = [body.from, ...waypoints, body.to];
  const segments = [];
  let totalKm = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    const km = haversineKm(from, to);
    const mi = kmToMi(km);
    totalKm += km;
    segments.push({
      from,
      to,
      km: round3(km),
      mi: round3(mi),
    });
  }

  return NextResponse.json({
    total_km: round3(totalKm),
    total_mi: round3(kmToMi(totalKm)),
    segments,
  });
}
