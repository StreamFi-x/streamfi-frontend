import { NextResponse } from "next/server";

type HistoryEntry = {
  viewer_id: string;
  creator_id: string;
  tip_usdc: number;
  sub_months: number;
};

type LtvBody = {
  viewer_id?: unknown;
  creator_id?: unknown;
};

const VIEWER_HISTORY: HistoryEntry[] = [
  {
    viewer_id: "viewer-alpha",
    creator_id: "creator-alpha",
    tip_usdc: 12,
    sub_months: 1,
  },
  {
    viewer_id: "viewer-alpha",
    creator_id: "creator-alpha",
    tip_usdc: 18,
    sub_months: 2,
  },
  {
    viewer_id: "viewer-alpha",
    creator_id: "creator-beta",
    tip_usdc: 5,
    sub_months: 0,
  },
  {
    viewer_id: "viewer-bravo",
    creator_id: "creator-alpha",
    tip_usdc: 0,
    sub_months: 4,
  },
  {
    viewer_id: "viewer-bravo",
    creator_id: "creator-alpha",
    tip_usdc: 8,
    sub_months: 0,
  },
  {
    viewer_id: "viewer-charlie",
    creator_id: "creator-alpha",
    tip_usdc: 120,
    sub_months: 6,
  },
];

const SUB_MONTH_VALUE_USDC = 5;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function resolveCohort(totalTipsUsdc: number, totalSubMonths: number) {
  if (totalTipsUsdc >= 100 || totalSubMonths >= 6) {
    return "power";
  }

  if (totalTipsUsdc >= 25 || totalSubMonths >= 2) {
    return "steady";
  }

  return "new";
}

export async function POST(request: Request) {
  let body: LtvBody;

  try {
    body = (await request.json()) as LtvBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const viewerId = body.viewer_id;
  const creatorId = body.creator_id;

  if (typeof viewerId !== "string" || viewerId.trim() === "") {
    return badRequest("viewer_id is required.");
  }

  if (typeof creatorId !== "string" || creatorId.trim() === "") {
    return badRequest("creator_id is required.");
  }

  const history = VIEWER_HISTORY.filter(
    entry => entry.viewer_id === viewerId && entry.creator_id === creatorId
  );

  const total_tips_usdc = history.reduce(
    (total, entry) => total + entry.tip_usdc,
    0
  );
  const total_sub_months = history.reduce(
    (total, entry) => total + entry.sub_months,
    0
  );
  const ltv_usdc = total_tips_usdc + total_sub_months * SUB_MONTH_VALUE_USDC;
  const cohort = resolveCohort(total_tips_usdc, total_sub_months);

  return NextResponse.json({
    total_tips_usdc,
    total_sub_months,
    ltv_usdc,
    cohort,
  });
}
