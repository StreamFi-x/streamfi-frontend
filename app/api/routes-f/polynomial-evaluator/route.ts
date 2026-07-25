import { NextRequest, NextResponse } from 'next/server'

function hornerEvaluate(coefficients: number[], xVal: number): number {
  let result = coefficients[0]
  for (let i = 1; i < coefficients.length; i++) {
    result = result * xVal + coefficients[i]
  }
  return result
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { coefficients, x } = body ?? {}

    if (
      !Array.isArray(coefficients) ||
      coefficients.length === 0 ||
      coefficients.some((c) => typeof c !== 'number' || isNaN(c))
    ) {
      return NextResponse.json({ error: 'Valid coefficients array is required' }, { status: 400 })
    }

    if (x === undefined || x === null) {
      return NextResponse.json({ error: 'x value or array of x values is required' }, { status: 400 })
    }

    let xValues: number[]
    if (typeof x === 'number' && !isNaN(x)) {
      xValues = [x]
    } else if (Array.isArray(x) && x.length > 0 && x.every((v) => typeof v === 'number' && !isNaN(v))) {
      xValues = x
    } else {
      return NextResponse.json({ error: 'Invalid x parameter' }, { status: 400 })
    }

    const results = xValues.map((xVal) => hornerEvaluate(coefficients, xVal))

    return NextResponse.json({ results }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request' }, { status: 400 })
  }
}
