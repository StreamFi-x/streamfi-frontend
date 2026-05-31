import { type NextRequest, NextResponse } from "next/server";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
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

  const {
    home_price,
    down_payment,
    annual_rate,
    years,
    property_tax_annual,
    insurance_annual,
    hoa_monthly,
  } = body as Record<string, unknown>;

  if (typeof home_price !== "number" || home_price <= 0) {
    return NextResponse.json({ error: "home_price must be a positive number." }, { status: 400 });
  }
  if (typeof down_payment !== "number" || down_payment < 0) {
    return NextResponse.json({ error: "down_payment must be non-negative." }, { status: 400 });
  }
  if (down_payment >= home_price) {
    return NextResponse.json({ error: "down_payment must be less than home_price." }, { status: 400 });
  }
  if (typeof annual_rate !== "number" || annual_rate < 0) {
    return NextResponse.json({ error: "annual_rate must be a non-negative number." }, { status: 400 });
  }
  if (typeof years !== "number" || years <= 0 || years > 50) {
    return NextResponse.json({ error: "years must be between 1 and 50." }, { status: 400 });
  }

  const loan_amount = round2(home_price - down_payment);
  const monthlyRate = annual_rate / 100 / 12;
  const totalMonths = years * 12;

  let monthly_pi: number;
  if (monthlyRate === 0) {
    monthly_pi = round2(loan_amount / totalMonths);
  } else {
    const factor = Math.pow(1 + monthlyRate, totalMonths);
    monthly_pi = round2((loan_amount * monthlyRate * factor) / (factor - 1));
  }

  const total_paid_pi = round2(monthly_pi * totalMonths);
  const total_interest = round2(total_paid_pi - loan_amount);

  const monthly_taxes = round2(
    typeof property_tax_annual === "number" ? property_tax_annual / 12 : 0
  );
  const monthly_insurance = round2(
    typeof insurance_annual === "number" ? insurance_annual / 12 : 0
  );
  const monthly_hoa = typeof hoa_monthly === "number" ? round2(hoa_monthly) : 0;

  const monthly_total = round2(monthly_pi + monthly_taxes + monthly_insurance + monthly_hoa);
  const ltv_ratio = round2((loan_amount / home_price) * 100);

  const payoffDate = new Date();
  payoffDate.setMonth(payoffDate.getMonth() + totalMonths);
  const payoff_date = payoffDate.toISOString().slice(0, 7);

  return NextResponse.json({
    loan_amount,
    monthly_principal_interest: monthly_pi,
    monthly_taxes,
    monthly_insurance,
    monthly_hoa,
    monthly_total,
    total_interest,
    total_paid: round2(total_paid_pi + (monthly_taxes + monthly_insurance + monthly_hoa) * totalMonths),
    ltv_ratio,
    payoff_date,
  });
}
