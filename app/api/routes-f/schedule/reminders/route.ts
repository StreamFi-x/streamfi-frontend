import { NextResponse } from "next/server";
import { sendDueScheduleReminders } from "@/lib/routes-f/schedule";

export async function GET() {
  try {
    const processed = await sendDueScheduleReminders();
    return NextResponse.json({ processed });
  } catch (error) {
    console.error("[routes-f schedule reminders GET]", error);
    return NextResponse.json(
      { error: "Failed to process reminders" },
      { status: 500 }
    );
  }
}
