import { NextRequest, NextResponse } from 'next/server'

function getMedian(arr: number[]): number {
  if (arr.length === 0) {return 0}
  const mid = Math.floor(arr.length / 2)
  if (arr.length % 2 === 1) {
    return arr[mid]
  }
  return (arr[mid - 1] + arr[mid]) / 2
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { data, multiplier = 1.5 } = body ?? {}

    if (!Array.isArray(data) || data.length === 0 || data.some((x) => typeof x !== 'number' || isNaN(x))) {
      return NextResponse.json({ error: 'Valid non-empty array of numbers is required' }, { status: 400 })
    }

    if (typeof multiplier !== 'number' || isNaN(multiplier) || multiplier <= 0) {
      return NextResponse.json({ error: 'Multiplier must be a positive number' }, { status: 400 })
    }

    const sorted = [...data].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    const lowerHalf = sorted.slice(0, mid)
    const upperHalf = sorted.length % 2 === 0 ? sorted.slice(mid) : sorted.slice(mid + 1)

    const q1 = getMedian(lowerHalf.length > 0 ? lowerHalf : sorted)
    const q3 = getMedian(upperHalf.length > 0 ? upperHalf : sorted)
    const iqr = q3 - q1
    const lower_bound = q1 - multiplier * iqr
    const upper_bound = q3 + multiplier * iqr

    const outliers = sorted.filter((num) => num < lower_bound || num > upper_bound)

    return NextResponse.json(
      {
        q1,
        q3,
        iqr,
        lower_bound,
        upper_bound,
        outliers,
      },
      { status: 200 }
    )
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request' }, { status: 400 })
  }
}
