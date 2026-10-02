import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

/** Bundled theme list — the only appearances the viewer UI ships. */
export const AVAILABLE_THEMES = ["light", "dark", "high-contrast"] as const;

export type ViewerTheme = (typeof AVAILABLE_THEMES)[number];

type ThemeResponse = {
  viewer_id: string;
  theme: ViewerTheme;
  updated_at: string | null;
};

const DEFAULT_THEME: ViewerTheme = "light";

// In-memory store, keyed by viewer id. Module-level so the choice persists
// across requests within a server instance; a real deployment would back
// this with the user preferences table.
const themeStore = new Map<string, { theme: ViewerTheme; updated_at: string }>();

/** Test hook: reset stored preferences between test cases. */
export function __resetThemeStore(): void {
  themeStore.clear();
}

const putSchema = z.object({
  viewer_id: z.string().min(1, "viewer_id is required"),
  theme: z.string().min(1, "theme is required"),
});

export async function GET(
  req: NextRequest
): Promise<NextResponse<ThemeResponse | { error: string }>> {
  const { searchParams } = new URL(req.url);
  const viewerId = searchParams.get("viewer_id");

  if (!viewerId || viewerId.trim() === "") {
    return NextResponse.json({ error: "viewer_id is required" }, { status: 400 });
  }

  const stored = themeStore.get(viewerId);
  return NextResponse.json({
    viewer_id: viewerId,
    theme: stored?.theme ?? DEFAULT_THEME,
    updated_at: stored?.updated_at ?? null,
  });
}

export async function PUT(
  req: NextRequest
): Promise<NextResponse<ThemeResponse | { error: string }>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = putSchema.safeParse(raw);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 }
    );
  }

  const { viewer_id, theme } = validation.data;

  if (!(AVAILABLE_THEMES as readonly string[]).includes(theme)) {
    return NextResponse.json(
      { error: `Invalid theme. Available: ${AVAILABLE_THEMES.join(", ")}` },
      { status: 400 }
    );
  }

  const updated_at = new Date().toISOString();
  themeStore.set(viewer_id, { theme: theme as ViewerTheme, updated_at });

  return NextResponse.json({ viewer_id, theme: theme as ViewerTheme, updated_at });
}
