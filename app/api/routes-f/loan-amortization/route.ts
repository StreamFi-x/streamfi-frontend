import { type NextRequest, NextResponse } from "next/server";

interface AmortizationRow {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

interface AmortizationInput {
  principal: number;
  annual_rate: number;
  years: number;
  extra_monthly_payment?: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function computeSchedule(input: AmortizationInput) {
  const { principal, annual_rate, years, extra_monthly_payment = 0 } = input;
  const monthlyRate = annual_rate / 100 / 12;
  const totalMonths = years * 12;

  let monthly_payment: number;
  if (monthlyRate === 0) {
    monthly_payment = round2(principal / totalMonths);
  } else {
    const factor = Math.pow(1 + monthlyRate, totalMonths);
    monthly_payment = round2((principal * monthlyRate * factor) / (factor - 1));
  }

  const schedule: AmortizationRow[] = [];
  let balance = principal;
  let month = 0;

  while (balance > 0) {
    month++;
    const interest = round2(balance * monthlyRate);
    const principalPart = round2(Math.min(monthly_payment - interest + extra_monthly_payment, balance));
    const payment = round2(interest + principalPart);
    balance = round2(balance - principalPart);
    schedule.push({ month, payment, principal: principalPart, interest, balance: Math.max(0, balance) });
    if (month > totalMonths + 1000) {break;} // safety guard
  }

  const total_interest = round2(schedule.reduce((sum, r) => sum + r.interest, 0));

  return { monthly_payment, payoff_months: schedule.length, total_interest, schedule };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "Request body must be an object." }, { status: 400 });
  }

  const { principal, annual_rate, years, extra_monthly_payment } = body as Record<string, unknown>;

  if (typeof principal !== "number" || principal <= 0) {
    return NextResponse.json({ error: "principal must be a positive number." }, { status: 400 });
  }
  if (typeof annual_rate !== "number" || annual_rate < 0) {
    return NextResponse.json({ error: "annual_rate must be a non-negative number." }, { status: 400 });
  }
  if (typeof years !== "number" || years <= 0 || years > 50) {
    return NextResponse.json({ error: "years must be a positive number not exceeding 50." }, { status: 400 });
  }
  if (extra_monthly_payment !== undefined && (typeof extra_monthly_payment !== "number" || extra_monthly_payment < 0)) {
    return NextResponse.json({ error: "extra_monthly_payment must be a non-negative number." }, { status: 400 });
  }

  return NextResponse.json(
    computeSchedule({ principal, annual_rate, years, extra_monthly_payment: extra_monthly_payment as number | undefined })
  );
}
