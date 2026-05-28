import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { principal, rate, years, compounds_per_year = 1 } = body;

    if (typeof principal !== 'number' || principal <= 0) {
      return NextResponse.json({ error: 'principal must be a positive number' }, { status: 400 });
    }
    if (typeof rate !== 'number' || rate < 0) {
      return NextResponse.json({ error: 'rate must be a non-negative number (e.g. 0.05 for 5%)' }, { status: 400 });
    }
    if (typeof years !== 'number' || years <= 0) {
      return NextResponse.json({ error: 'years must be a positive number' }, { status: 400 });
    }
    if (typeof compounds_per_year !== 'number' || compounds_per_year < 1) {
      return NextResponse.json({ error: 'compounds_per_year must be >= 1' }, { status: 400 });
    }

    const simpleInterest  = principal * rate * years;
    const simpleTotal     = principal + simpleInterest;

    const compoundTotal    = principal * Math.pow(1 + rate / compounds_per_year, compounds_per_year * years);
    const compoundInterest = compoundTotal - principal;

    const difference = compoundTotal - simpleTotal;

    return NextResponse.json({
      simple: {
        interest: parseFloat(simpleInterest.toFixed(2)),
        total:    parseFloat(simpleTotal.toFixed(2)),
      },
      compound: {
        interest: parseFloat(compoundInterest.toFixed(2)),
        total:    parseFloat(compoundTotal.toFixed(2)),
        compounds_per_year,
      },
      difference: parseFloat(difference.toFixed(2)),
    });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}
