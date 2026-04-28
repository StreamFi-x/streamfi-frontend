import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { calculateAge, getGeneration, getWesternZodiac, getChineseZodiac } from "./_lib/helpers";

const requestSchema = z.object({
  birthdate: z.string().refine((date) => {
    const d = new Date(date);
    return !isNaN(d.getTime()) && d.getFullYear() >= 1900 && d < new Date();
  }, "Birthdate must be a valid ISO date between 1900 and today"),
  on_date: z.string().optional().refine((date) => {
    if (!date) return true;
    const d = new Date(date);
    return !isNaN(d.getTime());
  }, "On date must be a valid ISO date"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { birthdate, on_date } = parsed.data;
    const targetDate = on_date ? new Date(on_date) : new Date();

    // Validate that on_date is not before birthdate
    if (targetDate < new Date(birthdate)) {
      return NextResponse.json(
        { error: "Target date cannot be before birthdate" },
        { status: 400 }
      );
    }

    const result = calculateAge(new Date(birthdate), targetDate);
    const generation = getGeneration(new Date(birthdate));
    const westernZodiac = getWesternZodiac(new Date(birthdate));
    const chineseZodiac = getChineseZodiac(new Date(birthdate));

    const response = {
      years: result.years,
      months: result.months,
      days: result.days,
      total_days: result.totalDays,
      total_seconds: result.totalSeconds,
      next_birthday: result.nextBirthday,
      generation,
      zodiac_western: westernZodiac,
      zodiac_chinese: chineseZodiac,
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}
