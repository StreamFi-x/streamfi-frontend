import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateQuery, validateBody } from "@/app/api/routes-f/_lib/validate";

const VALID_SECTIONS = [
  "live_alerts",
  "new_clips",
  "tip_summary",
  "recommendations",
] as const;
type Section = (typeof VALID_SECTIONS)[number];

type DigestPreference = {
  viewer_id: string;
  enabled: boolean;
  day_of_week: number;
  sections: Section[];
};

let store: DigestPreference[] = [
  {
    viewer_id: "viewer_001",
    enabled: true,
    day_of_week: 1,
    sections: ["live_alerts", "new_clips"],
  },
  {
    viewer_id: "viewer_002",
    enabled: false,
    day_of_week: 5,
    sections: [],
  },
];

export function __resetEmailDigest(): void {
  store = [
    {
      viewer_id: "viewer_001",
      enabled: true,
      day_of_week: 1,
      sections: ["live_alerts", "new_clips"],
    },
    {
      viewer_id: "viewer_002",
      enabled: false,
      day_of_week: 5,
      sections: [],
    },
  ];
}

const querySchema = z.object({
  viewer_id: z.string().min(1),
});

const putBodySchema = z.object({
  viewer_id: z.string().min(1),
  enabled: z.boolean().optional(),
  day_of_week: z.number().int().min(0).max(6).optional(),
  sections: z.array(z.enum(VALID_SECTIONS)).optional(),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, querySchema);
  if (queryResult instanceof NextResponse) return queryResult;

  const { viewer_id } = queryResult.data;
  const prefs = store.find((p) => p.viewer_id === viewer_id);
  if (!prefs) {
    return NextResponse.json({ error: "Viewer not found" }, { status: 404 });
  }

  return NextResponse.json({
    enabled: prefs.enabled,
    day_of_week: prefs.day_of_week,
    sections: prefs.sections,
  });
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const bodyResult = await validateBody(req, putBodySchema);
  if (bodyResult instanceof NextResponse) return bodyResult;

  const { viewer_id, enabled, day_of_week, sections } = bodyResult.data;
  const prefs = store.find((p) => p.viewer_id === viewer_id);
  if (!prefs) {
    return NextResponse.json({ error: "Viewer not found" }, { status: 404 });
  }

  if (enabled !== undefined) prefs.enabled = enabled;
  if (day_of_week !== undefined) prefs.day_of_week = day_of_week;
  if (sections !== undefined) prefs.sections = sections;

  return NextResponse.json({
    enabled: prefs.enabled,
    day_of_week: prefs.day_of_week,
    sections: prefs.sections,
  });
}