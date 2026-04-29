import { NextRequest, NextResponse } from "next/server";

function roundCents(v: number): number {
  return Math.round(v * 100) / 100;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const homePrice = Number(body.home_price);
  const downPayment = Number(body.down_payment);
  const annualRate = Number(body.annual_rate);
  const years = Number(body.years);
  const propertyTaxAnnual = body.property_tax_annual !== undefined ? Number(body.property_tax_annual) : 0;
  const insuranceAnnual = body.insurance_annual !== undefined ? Number(body.insurance_annual) : 0;
  const hoaMonthly = body.hoa_monthly !== undefined ? Number(body.hoa_monthly) : 0;

  if (!Number.isFinite(homePrice) || homePrice <= 0) {
    return NextResponse.json({ error: "home_price must be a positive number." }, { status: 400 });
  }

  if (!Number.isFinite(downPayment) || downPayment < 0) {
    return NextResponse.json({ error: "down_payment must be a non-negative number." }, { status: 400 });
  }

  if (downPayment >= homePrice) {
    return NextResponse.json({ error: "down_payment must be less than home_price." }, { status: 400 });
  }

  if (!Number.isFinite(annualRate) || annualRate < 0) {
    return NextResponse.json({ error: "annual_rate must be a non-negative number." }, { status: 400 });
  }

  if (!Number.isFinite(years) || !Number.isInteger(years) || years < 1 || years > 50) {
    return NextResponse.json({ error: "years must be an integer between 1 and 50." }, { status: 400 });
  }

  if (!Number.isFinite(propertyTaxAnnual) || propertyTaxAnnual < 0) {
    return NextResponse.json({ error: "property_tax_annual must be a non-negative number." }, { status: 400 });
  }

  if (!Number.isFinite(insuranceAnnual) || insuranceAnnual < 0) {
    return NextResponse.json({ error: "insurance_annual must be a non-negative number." }, { status: 400 });
  }

  if (!Number.isFinite(hoaMonthly) || hoaMonthly < 0) {
    return NextResponse.json({ error: "hoa_monthly must be a non-negative number." }, { status: 400 });
  }

  const loanAmount = homePrice - downPayment;
  const totalMonths = years * 12;
  const monthlyRate = annualRate / 100 / 12;

  let monthlyPrincipalInterest: number;

  if (monthlyRate === 0) {
    monthlyPrincipalInterest = loanAmount / totalMonths;
  } else {
    const factor = Math.pow(1 + monthlyRate, totalMonths);
    monthlyPrincipalInterest = (loanAmount * monthlyRate * factor) / (factor - 1);
  }

  monthlyPrincipalInterest = roundCents(monthlyPrincipalInterest);

  const monthlyTaxes = roundCents(propertyTaxAnnual / 12);
  const monthlyInsurance = roundCents(insuranceAnnual / 12);
  const monthlyHoa = roundCents(hoaMonthly);
  const monthlyTotal = roundCents(monthlyPrincipalInterest + monthlyTaxes + monthlyInsurance + monthlyHoa);

  const totalPaid = roundCents(monthlyPrincipalInterest * totalMonths + monthlyTaxes * totalMonths + monthlyInsurance * totalMonths + monthlyHoa * totalMonths);
  const totalInterest = roundCents(monthlyPrincipalInterest * totalMonths - loanAmount);

  const ltvRatio = roundCents((loanAmount / homePrice) * 100);

  const now = new Date();
  const payoffDate = new Date(now.getFullYear(), now.getMonth() + totalMonths, 1);
  const payoffDateStr = `${payoffDate.getFullYear()}-${String(payoffDate.getMonth() + 1).padStart(2, "0")}`;

  return NextResponse.json({
    loan_amount: roundCents(loanAmount),
    monthly_principal_interest: monthlyPrincipalInterest,
    monthly_taxes: monthlyTaxes,
    monthly_insurance: monthlyInsurance,
    monthly_hoa: monthlyHoa,
    monthly_total: monthlyTotal,
    total_interest: totalInterest,
    total_paid: totalPaid,
    ltv_ratio: ltvRatio,
    payoff_date: payoffDateStr,
  });
}
