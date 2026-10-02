import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type Assessment = "too_low" | "too_high" | "ok";

type MicCheckResponse = {
  assessment: Assessment;
  suggestions: string[];
};

const bodySchema = z.object({
  creator_id: z.string().min(1),
  sample_rms_db: z.number().finite(),
  peak_db: z.number().finite(),
});

// Threshold ranges bundled inside the folder (scope constraint).
// dBFS levels: 0 is digital maximum; more negative is quieter.
const THRESHOLDS = {
  // Average (RMS) loudness sweet spot for streaming voice.
  rms_min_db: -30,
  rms_max_db: -12,
  // Peaks above this risk clipping regardless of average loudness.
  peak_clip_db: -3,
};

const SUGGESTIONS: Record<Assessment, string[]> = {
  too_low: [
    "Raise your microphone gain or move closer to the mic.",
    "Aim for an average level between -30 dB and -12 dB.",
    "Check that the correct input device is selected.",
  ],
  too_high: [
    "Lower your microphone gain or move slightly away from the mic.",
    "Keep peaks below -3 dB to avoid clipping and distortion.",
    "Consider enabling a limiter or compressor on your input.",
  ],
  ok: [
    "Levels look good — you are ready to go live.",
    "Keep peaks below -3 dB during louder moments.",
  ],
};

function assess(sampleRmsDb: number, peakDb: number): Assessment {
  // Clipping peaks dominate: even a quiet average with clipping peaks needs
  // the gain brought down.
  if (peakDb > THRESHOLDS.peak_clip_db || sampleRmsDb > THRESHOLDS.rms_max_db) {
    return "too_high";
  }
  if (sampleRmsDb < THRESHOLDS.rms_min_db) {
    return "too_low";
  }
  return "ok";
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<MicCheckResponse | { error: string }>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = bodySchema.safeParse(raw);
  if (!validation.success) {
    return NextResponse.json(
      { error: "creator_id, sample_rms_db and peak_db are required" },
      { status: 400 }
    );
  }

  const { sample_rms_db, peak_db } = validation.data;
  const assessment = assess(sample_rms_db, peak_db);

  return NextResponse.json({ assessment, suggestions: SUGGESTIONS[assessment] });
}
