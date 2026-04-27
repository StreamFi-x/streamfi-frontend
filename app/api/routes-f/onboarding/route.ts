import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Creator Onboarding Checklist API
//
// In production each step queries the relevant Postgres table.
// Here we simulate the data store in-memory for the frontend layer.
// ---------------------------------------------------------------------------

type OnboardingProgress = {
  user_id: string;
  completed: string[];
  dismissed: boolean;
  completed_at: string | null;
  updated_at: string;
};

type UserProfile = {
  avatar: string | null;
  bio: string | null;
  wallet: string | null;
  stream_title: string | null;
  category: string | null;
  total_streams: number;
  follower_count: number;
  total_tips_count: number;
};

// Simulated stores
export const ONBOARDING_STORE: Map<string, OnboardingProgress> = new Map();
export const USER_PROFILES: Map<string, UserProfile> = new Map();

// Seed a demo user profile
USER_PROFILES.set("user-demo-0001", {
  avatar: "https://cdn.example.com/avatars/alice.jpg",
  bio: null,
  wallet: null,
  stream_title: null,
  category: null,
  total_streams: 0,
  follower_count: 0,
  total_tips_count: 0,
});

// ---------------------------------------------------------------------------
// Checklist step definitions
// ---------------------------------------------------------------------------
const CHECKLIST_STEPS: {
  id: string;
  title: string;
  detect: (profile: UserProfile) => boolean;
}[] = [
  {
    id: "set_avatar",
    title: "Upload a profile photo",
    detect: (p) => p.avatar !== null,
  },
  {
    id: "set_bio",
    title: "Write a bio",
    detect: (p) => p.bio !== null,
  },
  {
    id: "set_stream_title",
    title: "Set a stream title",
    detect: (p) => p.stream_title !== null,
  },
  {
    id: "add_category",
    title: "Pick a stream category",
    detect: (p) => p.category !== null,
  },
  {
    id: "first_stream",
    title: "Go live for the first time",
    detect: (p) => p.total_streams > 0,
  },
  {
    id: "connect_wallet",
    title: "Connect Stellar wallet",
    detect: (p) => p.wallet !== null,
  },
  {
    id: "first_follower",
    title: "Get your first follower",
    detect: (p) => p.follower_count >= 1,
  },
  {
    id: "first_tip",
    title: "Receive a tip",
    detect: (p) => p.total_tips_count >= 1,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getCurrentUserId(request: NextRequest): string | null {
  return request.headers.get("x-user-id");
}

async function awardBadge(userId: string, badgeSlug: string) {
  // In production: POST /api/routes-f/badges  { user_id, badge_slug }
  console.log(`[onboarding] Awarding badge '${badgeSlug}' to user ${userId}`);
}

// ---------------------------------------------------------------------------
// GET /api/routes-f/onboarding  — checklist progress for current user
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const userId = getCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const profile = USER_PROFILES.get(userId);
  if (!profile) {
    return NextResponse.json({ error: "User profile not found." }, { status: 404 });
  }

  // Ensure progress record exists
  if (!ONBOARDING_STORE.has(userId)) {
    ONBOARDING_STORE.set(userId, {
      user_id: userId,
      completed: [],
      dismissed: false,
      completed_at: null,
      updated_at: new Date().toISOString(),
    });
  }
  const progress = ONBOARDING_STORE.get(userId)!;

  // Auto-evaluate each step
  const steps = CHECKLIST_STEPS.map((step) => {
    const auto = step.detect(profile);
    const manual = progress.completed.includes(step.id);
    return {
      id: step.id,
      title: step.title,
      completed: auto || manual,
    };
  });

  const completedCount = steps.filter((s) => s.completed).length;
  const totalCount = steps.length;
  const percentage = Math.round((completedCount / totalCount) * 100);

  // Check for first-time full completion
  if (completedCount === totalCount && !progress.completed_at) {
    progress.completed_at = new Date().toISOString();
    progress.updated_at = new Date().toISOString();
    await awardBadge(userId, "onboarding_complete");
  }

  return NextResponse.json({
    steps,
    completed_count: completedCount,
    total_count: totalCount,
    percentage,
    dismissed: progress.dismissed,
    completed_at: progress.completed_at,
  });
}
