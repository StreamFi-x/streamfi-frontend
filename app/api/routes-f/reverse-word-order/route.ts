import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text } = body ?? {}

    if (text === undefined || text === null || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text string is required' }, { status: 400 })
    }

    const words = text.trim().split(/\s+/).filter(Boolean)
    const reversedWords = words.reverse()
    const result = reversedWords.join(' ')

    return NextResponse.json({ result }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request' }, { status: 400 })
  }
}
