import { NextRequest, NextResponse } from "next/server";

export interface ChannelTheme {
  creator_id: string;
  accent_color: string;
  secondary_color: string;
}

export const DEFAULT_THEME = {
  accent_color: "#1E90FF",
  secondary_color: "#FF4500",
};

// In-memory store for practice implementation
let themes: ChannelTheme[] = [];

const hexRegex = /^#([0-9A-Fa-f]{3}){1,2}$/;

function isValidHex(hex: string): boolean {
  return hexRegex.test(hex);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const creatorId = searchParams.get("creator_id");

  if (!creatorId) {
    return NextResponse.json({ error: "creator_id is required" }, { status: 400 });
  }

  const theme = themes.find((t) => t.creator_id === creatorId);

  if (!theme) {
    return NextResponse.json(
      {
        accent_color: DEFAULT_THEME.accent_color,
        secondary_color: DEFAULT_THEME.secondary_color,
      },
      { status: 200 }
    );
  }

  return NextResponse.json(
    {
      accent_color: theme.accent_color,
      secondary_color: theme.secondary_color,
    },
    { status: 200 }
  );
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { creator_id, accent_color, secondary_color } = body;

    if (!creator_id || !accent_color || !secondary_color) {
      return NextResponse.json(
        { error: "creator_id, accent_color, and secondary_color are required" },
        { status: 400 }
      );
    }

    if (!isValidHex(accent_color) || !isValidHex(secondary_color)) {
      return NextResponse.json(
        { error: "Invalid hex color format" },
        { status: 400 }
      );
    }

    const existingIndex = themes.findIndex((t) => t.creator_id === creator_id);

    const newTheme: ChannelTheme = { creator_id, accent_color, secondary_color };

    if (existingIndex >= 0) {
      themes[existingIndex] = newTheme;
    } else {
      themes.push(newTheme);
    }

    return NextResponse.json({ success: true, theme: newTheme }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

// For testing purposes
export function _resetThemes() {
  themes = [];
}
