import { NextRequest, NextResponse } from "next/server";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { checkInSchema } from "../schema";
import { streakStore, storeKey, todayISO, daysDiff } from "../store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const bodyResult = await validateBody(req, checkInSchema);
  if (bodyResult instanceof NextResponse) {return bodyResult;}

  const { viewer_id, creator_id, on_date } = bodyResult.data;
  const checkInDate = on_date ?? todayISO();
  const key = storeKey(viewer_id, creator_id);

  if (!streakStore[key]) {
    // First ever check-in
    streakStore[key] = {
      viewer_id,
      creator_id,
      current_streak: 1,
      longest_streak: 1,
      last_check_in: checkInDate,
    };
    return NextResponse.json({
      ...streakStore[key],
      message: "Streak started! 🔥",
    });
  }

  const record = streakStore[key];

  if (record.last_check_in === checkInDate) {
    return NextResponse.json({
      ...record,
      message: "Already checked in today.",
    });
  }

  const diff = daysDiff(record.last_check_in, checkInDate);

  if (diff === 1) {
    record.current_streak += 1;
    record.longest_streak = Math.max(record.longest_streak, record.current_streak);
    record.last_check_in = checkInDate;
    return NextResponse.json({
      ...record,
      message: `Streak extended to ${record.current_streak} days! 🔥`,
    });
  } else {
    record.current_streak = 1;
    record.last_check_in = checkInDate;
    return NextResponse.json({
      ...record,
      message: "Streak reset. Starting fresh!",
    });
  }
}
