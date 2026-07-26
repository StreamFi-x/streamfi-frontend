import { NextRequest, NextResponse } from 'next/server'

interface CategoryRelation {
  category: string
  similarity_score: number
}

const CATEGORY_GRAPH: Record<string, CategoryRelation[]> = {
  gaming: [
    { category: 'Esports', similarity_score: 0.95 },
    { category: 'IRL', similarity_score: 0.4 },
    { category: 'Creative', similarity_score: 0.3 },
  ],
  esports: [
    { category: 'Gaming', similarity_score: 0.95 },
    { category: 'IRL', similarity_score: 0.35 },
  ],
  music: [
    { category: 'Creative', similarity_score: 0.85 },
    { category: 'Podcasts', similarity_score: 0.6 },
    { category: 'IRL', similarity_score: 0.5 },
  ],
  creative: [
    { category: 'Music', similarity_score: 0.85 },
    { category: 'Gaming', similarity_score: 0.3 },
  ],
  irl: [
    { category: 'Podcasts', similarity_score: 0.75 },
    { category: 'Music', similarity_score: 0.5 },
    { category: 'Gaming', similarity_score: 0.4 },
  ],
  podcasts: [
    { category: 'IRL', similarity_score: 0.75 },
    { category: 'Music', similarity_score: 0.6 },
  ],
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { category } = body ?? {}

    if (!category || typeof category !== 'string') {
      return NextResponse.json({ error: 'Category string is required' }, { status: 400 })
    }

    const key = category.trim().toLowerCase()
    const related = CATEGORY_GRAPH[key]

    if (!related) {
      return NextResponse.json({ error: `Category '${category}' not found` }, { status: 404 })
    }

    return NextResponse.json({ related }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request' }, { status: 400 })
  }
}
