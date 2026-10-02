import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const VALID_CATEGORIES = [
  'new_follower',
  'stream_live',
  'stream_end',
  'tip_received',
  'mention',
  'chat_message',
  'subscription',
  'raid',
] as const

type NotificationCategory = typeof VALID_CATEGORIES[number]

const getSchema = z.object({
  viewer_id: z.string().min(1),
})

const postSchema = z.object({
  viewer_id: z.string().min(1),
  category: z.enum(VALID_CATEGORIES),
  action: z.enum(['mute', 'unmute']),
})

const mutedCategories = new Map<string, Set<NotificationCategory>>()

function getMuted(viewerId: string): Set<NotificationCategory> {
  if (!mutedCategories.has(viewerId)) {mutedCategories.set(viewerId, new Set())}
  return mutedCategories.get(viewerId)!
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const parsed = getSchema.safeParse({ viewer_id: searchParams.get('viewer_id') })

  if (!parsed.success) {
    return NextResponse.json({ error: 'viewer_id is required', details: parsed.error.flatten() }, { status: 400 })
  }

  const { viewer_id } = parsed.data
  const muted = Array.from(getMuted(viewer_id))
  const active = VALID_CATEGORIES.filter((c) => !muted.includes(c))

  return NextResponse.json({
    viewer_id,
    muted_categories: muted,
    active_categories: active,
    all_categories: VALID_CATEGORIES,
  })
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten(), validCategories: VALID_CATEGORIES },
      { status: 400 },
    )
  }

  const { viewer_id, category, action } = parsed.data
  const muted = getMuted(viewer_id)

  const alreadyMuted = muted.has(category)

  if (action === 'mute') {
    if (alreadyMuted) {
      return NextResponse.json({ error: `Category '${category}' is already muted` }, { status: 409 })
    }
    muted.add(category)
  } else {
    if (!alreadyMuted) {
      return NextResponse.json({ error: `Category '${category}' is not muted` }, { status: 409 })
    }
    muted.delete(category)
  }

  return NextResponse.json({
    viewer_id,
    category,
    action,
    muted_categories: Array.from(muted),
  })
}
