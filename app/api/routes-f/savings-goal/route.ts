import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  let body: {
    goal?: unknown;
    initial?: unknown;
    monthly_contribution?: unknown;
    annual_rate?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const goal = Number(body.goal);
  const initial = Number(body.initial);
  const monthlyContribution = Number(body.monthly_contribution);
  const annualRate = body.annual_rate !== undefined ? Number(body.annual_rate) : 0;

  if (
    body.goal === undefined ||
    body.initial === undefined ||
    body.monthly_contribution === undefined ||
    isNaN(goal) ||
    isNaN(initial) ||
    isNaN(monthlyContribution) ||
    isNaN(annualRate) ||
    typeof body.goal === "boolean" ||
    typeof body.initial === "boolean" ||
    typeof body.monthly_contribution === "boolean"
  ) {
    return NextResponse.json(
      { error: "goal, initial, and monthly_contribution are required and must be numbers." },
      { status: 400 }
    );
  }

  if (goal <= 0 || initial < 0 || annualRate < 0) {
    return NextResponse.json(
      { error: "goal must be positive. initial and annual_rate must be non-negative." },
      { status: 400 }
    );
  }

  // Reject impossible goals initially
  if (initial < goal) {
    if (monthlyContribution <= 0 && annualRate <= 0) {
      return NextResponse.json(
        { error: "Goal is impossible to reach (no contribution and no interest)." },
        { status: 400 }
      );
    }
    if (initial <= 0 && monthlyContribution <= 0) {
      return NextResponse.json(
        { error: "Goal is impossible to reach (initial balance and monthly contribution are both zero)." },
        { status: 400 }
      );
    }
  }

  let balance = initial;
  let months = 0;
  let totalInterest = 0;
  let totalContributed = 0;
  const monthlyRate = (annualRate / 100) / 12;

  // Let's protect against infinite/extremely long runtimes
  const maxMonths = 12000; // 1000 years limit

  while (balance < goal && months < maxMonths) {
    months++;
    const interest = balance * monthlyRate;
    totalInterest += interest;
    totalContributed += monthlyContribution;
    balance = balance + interest + monthlyContribution;
  }

  if (months >= maxMonths && balance < goal) {
    return NextResponse.json(
      { error: "Goal is impossible or takes too long (> 1000 years) to reach with current parameters." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    months_to_goal: months,
    total_contributed: Math.round(totalContributed * 100) / 100,
    total_interest: Math.round(totalInterest * 100) / 100,
    final_balance: Math.round(balance * 100) / 100,
  });
}
