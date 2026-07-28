import { NextResponse } from "next/server";

export type FeaturedClip = {
  clip_id: string;
  title: string;
  creator_username: string;
  thumbnail_url: string;
  duration_seconds: number;
};

export type CarouselResponse = {
  clips: FeaturedClip[];
  rotation_id: number;
  rotates_at: string;
};

export const ROTATION_SIZE = 3;
export const ROTATION_PERIOD_MS = 60 * 60 * 1000;

/** Bundled candidate clips the carousel rotates through. */
export const CANDIDATE_CLIPS: FeaturedClip[] = [
  { clip_id: "clip-1", title: "Insane 1v5 clutch", creator_username: "novastreams", thumbnail_url: "/clips/clip-1.jpg", duration_seconds: 34 },
  { clip_id: "clip-2", title: "Perfect combo finish", creator_username: "pixelpatch", thumbnail_url: "/clips/clip-2.jpg", duration_seconds: 21 },
  { clip_id: "clip-3", title: "Chat goes wild after tip goal", creator_username: "walletwiz", thumbnail_url: "/clips/clip-3.jpg", duration_seconds: 48 },
  { clip_id: "clip-4", title: "Speedrun world record pace", creator_username: "clipnation", thumbnail_url: "/clips/clip-4.jpg", duration_seconds: 60 },
  { clip_id: "clip-5", title: "Surprise duet with a viewer", creator_username: "novastreams", thumbnail_url: "/clips/clip-5.jpg", duration_seconds: 27 },
  { clip_id: "clip-6", title: "Backseat gaming fail compilation", creator_username: "pixelpatch", thumbnail_url: "/clips/clip-6.jpg", duration_seconds: 39 },
  { clip_id: "clip-7", title: "First XLM tip reaction", creator_username: "walletwiz", thumbnail_url: "/clips/clip-7.jpg", duration_seconds: 18 },
  { clip_id: "clip-8", title: "Community art reveal", creator_username: "clipnation", thumbnail_url: "/clips/clip-8.jpg", duration_seconds: 52 },
  { clip_id: "clip-9", title: "Late-night chill music session", creator_username: "novastreams", thumbnail_url: "/clips/clip-9.jpg", duration_seconds: 45 },
];

/** Manual advances via POST /next shift the rotation by this many extra steps. */
let manualAdvanceOffset = 0;

export function resetCarouselRotation(): void {
  manualAdvanceOffset = 0;
}

export function advanceCarouselRotation(now: Date = new Date()): number {
  manualAdvanceOffset += 1;
  return computeRotationId(now);
}

/** Deterministic-by-hour rotation id, plus any manual advances applied via /next. */
export function computeRotationId(now: Date = new Date()): number {
  const hourBucket = Math.floor(now.getTime() / ROTATION_PERIOD_MS);
  return hourBucket + manualAdvanceOffset;
}

export function computeRotatesAt(now: Date = new Date()): string {
  const hourBucket = Math.floor(now.getTime() / ROTATION_PERIOD_MS);
  return new Date((hourBucket + 1) * ROTATION_PERIOD_MS).toISOString();
}

export function selectClipsForRotation(rotationId: number): FeaturedClip[] {
  const start = ((rotationId % CANDIDATE_CLIPS.length) + CANDIDATE_CLIPS.length) % CANDIDATE_CLIPS.length;
  const clips: FeaturedClip[] = [];
  for (let i = 0; i < ROTATION_SIZE; i++) {
    clips.push(CANDIDATE_CLIPS[(start + i) % CANDIDATE_CLIPS.length]);
  }
  return clips;
}

export async function GET(): Promise<NextResponse<CarouselResponse>> {
  const rotation_id = computeRotationId();
  const clips = selectClipsForRotation(rotation_id);
  const rotates_at = computeRotatesAt();

  return NextResponse.json({ clips, rotation_id, rotates_at });
}
