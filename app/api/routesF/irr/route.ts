import { NextResponse } from 'next/server';

function computeNPV(cashFlows: number[], rate: number): number {
  return cashFlows.reduce((npv, cf, t) => npv + cf / Math.pow(1 + rate, t), 0);
}

function computeIRR(cashFlows: number[]): number | null {
  // Validate: first cash flow should be negative (initial investment)
  if (cashFlows[0] >= 0) return null;
  // At least one positive cash flow required
  if (!cashFlows.slice(1).some((cf) => cf > 0)) return null;

  // Bisection method
  let low = -0.999;
  let high = 10.0; // 1000% upper bound

  if (computeNPV(cashFlows, low) * computeNPV(cashFlows, high) > 0) return null;

  for (let i = 0; i < 1000; i++) {
    const mid = (low + high) / 2;
    const npv = computeNPV(cashFlows, mid);
    if (Math.abs(npv) < 1e-7) return mid;
    if (computeNPV(cashFlows, low) * npv < 0) high = mid;
    else low = mid;
  }

  return (low + high) / 2;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { cash_flows } = body;

    if (!Array.isArray(cash_flows) || cash_flows.length < 2) {
      return NextResponse.json(
        { error: 'cash_flows must be an array with at least 2 values' },
        { status: 400 },
      );
    }
    if (!cash_flows.every((v) => typeof v === 'number')) {
      return NextResponse.json({ error: 'All cash_flows values must be numbers' }, { status: 400 });
    }

    const irr = computeIRR(cash_flows);

    if (irr === null) {
      return NextResponse.json({ error: 'IRR could not be computed for the given cash flows' }, { status: 422 });
    }

    return NextResponse.json({
      irr: parseFloat((irr * 100).toFixed(4)),
      irr_decimal: parseFloat(irr.toFixed(6)),
    });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}
