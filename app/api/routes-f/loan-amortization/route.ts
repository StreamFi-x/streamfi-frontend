import { NextRequest, NextResponse } from "next/server";

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function POST(req: NextRequest) {
  let body: {
    principal?: unknown;
    annual_rate?: unknown;
    years?: unknown;
    extra_monthly_payment?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { principal, annual_rate, years, extra_monthly_payment = 0 } = body ?? {};

  if (typeof principal !== "number" || principal <= 0) {
    return NextResponse.json({ error: "'principal' must be a positive number" }, { status: 400 });
  }
  if (typeof annual_rate !== "number" || annual_rate < 0) {
    return NextResponse.json({ error: "'annual_rate' must be a non-negative number" }, { status: 400 });
  }
  if (typeof years !== "number" || years <= 0 || years > 50) {
    return NextResponse.json({ error: "'years' must be a positive number ≤ 50" }, { status: 400 });
  }
  if (typeof extra_monthly_payment !== "number" || extra_monthly_payment < 0) {
    return NextResponse.json(
      { error: "'extra_monthly_payment' must be a non-negative number" },
      { status: 400 },
    );
  }

  const monthlyRate = annual_rate / 100 / 12;
  const totalMonths = Math.round(years * 12);

  let monthly_payment: number;
  if (monthlyRate === 0) {
    monthly_payment = r2(principal / totalMonths);
  } else {
    const factor = Math.pow(1 + monthlyRate, totalMonths);
    monthly_payment = r2((principal * monthlyRate * factor) / (factor - 1));
  }

  const schedule: {
    month: number;
    payment: number;
    principal: number;
    interest: number;
    balance: number;
  }[] = [];

  let balance = principal;
  let totalInterest = 0;
  let month = 0;

  while (balance > 0) {
    month++;
    const interest = r2(balance * monthlyRate);
    const payment = Math.min(r2(monthly_payment + (extra_monthly_payment as number)), r2(balance + interest));
    const principalPaid = r2(payment - interest);
    balance = r2(balance - principalPaid);
    if (balance < 0.01) balance = 0;
    totalInterest = r2(totalInterest + interest);

    schedule.push({
      month,
      payment,
      principal: principalPaid,
      interest,
      balance,
    });

    if (month > 600) break; // safety cap: 50 years
  }

  return NextResponse.json({
    monthly_payment,
    total_interest: r2(totalInterest),
    total_paid: r2(monthly_payment * schedule.length + (extra_monthly_payment as number) * Math.max(0, schedule.length - 1)),
    payoff_months: month,
    schedule,
  });
}
