import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  viewer_id: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

const FRIENDS: Record<string, string[]> = {
  'user-01': ['alice', 'bob', 'carol'],
  'user-02': ['dave', 'eve'],
  'user-03': ['frank', 'alice', 'carol', 'dave'],
  'user-04': ['grace', 'heidi'],
  'user-05': ['ivan', 'judy', 'mallory'],
}

const LIVE_STREAMS = [
  { stream_id: 'str-101', title: 'Coding with TypeScript', streamer: 'streamer_ts', category: 'tech' },
  { stream_id: 'str-102', title: 'Gaming Highlights', streamer: 'gamer_pro', category: 'gaming' },
  { stream_id: 'str-103', title: 'Music Production Live', streamer: 'beatmaker', category: 'music' },
  { stream_id: 'str-104', title: 'Crypto Market Analysis', streamer: 'crypto_guru', category: 'finance' },
  { stream_id: 'str-105', title: 'Art & Illustration', streamer: 'art_wizard', category: 'creative' },
  { stream_id: 'str-106', title: 'Cooking Masterclass', streamer: 'chef_streams', category: 'lifestyle' },
]

const FRIEND_STREAM_ASSIGNMENTS: Record<string, string[]> = {
  alice: ['str-101', 'str-103'],
  bob: ['str-102'],
  carol: ['str-104'],
  dave: ['str-101', 'str-105'],
  eve: ['str-106'],
  frank: ['str-102', 'str-103'],
  grace: ['str-101'],
  heidi: ['str-104', 'str-106'],
  ivan: ['str-105'],
  judy: ['str-101', 'str-102'],
  mallory: ['str-103'],
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const parsed = schema.safeParse({
    viewer_id: searchParams.get('viewer_id'),
    limit: searchParams.get('limit') ?? 20,
  })

  if (!parsed.success) {
    return NextResponse.json({ error: 'viewer_id is required', details: parsed.error.flatten() }, { status: 400 })
  }

  const { viewer_id, limit } = parsed.data
  const friendList = FRIENDS[viewer_id] ?? []

  const streamMap = new Map<string, Set<string>>()

  for (const friend of friendList) {
    const watching = FRIEND_STREAM_ASSIGNMENTS[friend] ?? []
    for (const streamId of watching) {
      if (!streamMap.has(streamId)) streamMap.set(streamId, new Set())
      streamMap.get(streamId)!.add(friend)
    }
  }

  const streams = Array.from(streamMap.entries())
    .map(([streamId, watchingFriends]) => {
      const streamInfo = LIVE_STREAMS.find((s) => s.stream_id === streamId)!
      return {
        stream: streamInfo,
        friends_watching: Array.from(watchingFriends),
        friend_count: watchingFriends.size,
      }
    })
    .sort((a, b) => b.friend_count - a.friend_count)
    .slice(0, limit)

  return NextResponse.json({
    viewer_id,
    streams,
    total: streams.length,
  })
}
