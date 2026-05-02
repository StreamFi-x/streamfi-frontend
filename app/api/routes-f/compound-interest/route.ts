import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { calculateCompoundInterest } from "./_lib/helpers";

const contributionSchema = z.object({
  amount: z.number().min(0),
  frequency: z.enum(["monthly", "annually"]),
});

const requestSchema = z.object({
  principal: z.number().min(0, "Principal must be >= 0"),
  rate: z.number().min(0, "Rate must be >= 0"),
  years: z.number().min(1, "Years must be >= 1").max(100, "Years must be <= 100"),
  compounds_per_year: z.number().min(1).max(365).optional(),
  contributions: contributionSchema.optional(),
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

    const { principal, rate, years, compounds_per_year = 12, contributions } = parsed.data;

    const result = calculateCompoundInterest({
      principal,
      rate,
      years,
      compoundsPerYear: compounds_per_year,
      contributions,
    });

    const response = {
      final_balance: Math.round(result.finalBalance * 100) / 100,
      total_contributed: Math.round(result.totalContributed * 100) / 100,
      total_interest: Math.round(result.totalInterest * 100) / 100,
      schedule: result.schedule.map(year => ({
        year: year.year,
        balance: Math.round(year.balance * 100) / 100,
        interest_earned: Math.round(year.interestEarned * 100) / 100,
        contributions_to_date: Math.round(year.contributionsToDate * 100) / 100,
      })),
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}
