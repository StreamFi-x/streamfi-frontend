import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

interface Creator {
  username: string
  display_name: string
  followers: number
  avg_viewers: number
  tips_per_viewer: number
  chat_msgs_per_viewer: number
  score: number
  categories: string[]
}

const CREATORS_POOL: Omit<Creator, 'score'>[] = [
  { username: 'hidden_gem_1', display_name: 'PixelWave', followers: 320, avg_viewers: 45, tips_per_viewer: 0.8, chat_msgs_per_viewer: 12.5, categories: ['gaming'] },
  { username: 'hidden_gem_2', display_name: 'SoundForge', followers: 180, avg_viewers: 28, tips_per_viewer: 1.2, chat_msgs_per_viewer: 18.0, categories: ['music'] },
  { username: 'hidden_gem_3', display_name: 'CodeNight', followers: 540, avg_viewers: 62, tips_per_viewer: 0.5, chat_msgs_per_viewer: 9.8, categories: ['tech'] },
  { username: 'hidden_gem_4', display_name: 'ArtEon', followers: 210, avg_viewers: 33, tips_per_viewer: 1.5, chat_msgs_per_viewer: 22.3, categories: ['creative'] },
  { username: 'hidden_gem_5', display_name: 'ChefRoam', followers: 390, avg_viewers: 55, tips_per_viewer: 0.9, chat_msgs_per_viewer: 14.1, categories: ['lifestyle'] },
  { username: 'hidden_gem_6', display_name: 'ZenFit', followers: 140, avg_viewers: 19, tips_per_viewer: 2.0, chat_msgs_per_viewer: 26.5, categories: ['fitness'] },
  { username: 'hidden_gem_7', display_name: 'NightOwlDev', followers: 670, avg_viewers: 78, tips_per_viewer: 0.4, chat_msgs_per_viewer: 8.2, categories: ['tech'] },
  { username: 'hidden_gem_8', display_name: 'BeatLab', followers: 250, avg_viewers: 41, tips_per_viewer: 1.1, chat_msgs_per_viewer: 16.7, categories: ['music'] },
  { username: 'hidden_gem_9', display_name: 'StrategyCore', followers: 310, avg_viewers: 37, tips_per_viewer: 0.7, chat_msgs_per_viewer: 11.4, categories: ['gaming'] },
  { username: 'hidden_gem_10', display_name: 'CraftStudio', followers: 190, avg_viewers: 24, tips_per_viewer: 1.8, chat_msgs_per_viewer: 20.9, categories: ['creative'] },
  { username: 'hidden_gem_11', display_name: 'MindSpace', followers: 420, avg_viewers: 51, tips_per_viewer: 0.6, chat_msgs_per_viewer: 13.0, categories: ['lifestyle'] },
  { username: 'hidden_gem_12', display_name: 'SpeedRun', followers: 280, avg_viewers: 43, tips_per_viewer: 1.0, chat_msgs_per_viewer: 15.8, categories: ['gaming'] },
]

const RATED_CREATORS = CREATORS_POOL.map((c) => ({
  ...c,
  score: parseFloat((c.tips_per_viewer + c.chat_msgs_per_viewer).toFixed(2)),
})).sort((a, b) => b.score - a.score)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const parsed = schema.safeParse({ limit: searchParams.get('limit') ?? 20 })

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid parameters', details: parsed.error.flatten() }, { status: 400 })
  }

  const { limit } = parsed.data
  const creators = RATED_CREATORS.slice(0, limit)

  return NextResponse.json({
    creators,
    total: creators.length,
    scoring_method: 'tips_per_viewer + chat_msgs_per_viewer',
  })
}
