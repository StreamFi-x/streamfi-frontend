import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  host_username: z.string().min(1),
})

interface HostedStream {
  stream_id: string
  primary_creator: string
  title: string
  category: string
  role: 'co-host' | 'guest' | 'raid-host'
  playback_id: string
  started_at: string
}

const HOST_STREAMS: Record<string, HostedStream[]> = {
  streamer_ts: [
    {
      stream_id: 'str-201',
      primary_creator: 'coder_live',
      title: 'Full-Stack with Next.js',
      category: 'tech',
      role: 'co-host',
      playback_id: 'pb-201',
      started_at: '2024-07-01T10:00:00Z',
    },
    {
      stream_id: 'str-202',
      primary_creator: 'devhacks',
      title: 'Open Source Sprint',
      category: 'tech',
      role: 'guest',
      playback_id: 'pb-202',
      started_at: '2024-07-01T14:00:00Z',
    },
  ],
  gamer_pro: [
    {
      stream_id: 'str-203',
      primary_creator: 'ultimate_gamer',
      title: 'Pro League Showdown',
      category: 'gaming',
      role: 'co-host',
      playback_id: 'pb-203',
      started_at: '2024-07-01T18:00:00Z',
    },
  ],
  beatmaker: [
    {
      stream_id: 'str-204',
      primary_creator: 'sound_lab',
      title: 'Trap Beats Session',
      category: 'music',
      role: 'guest',
      playback_id: 'pb-204',
      started_at: '2024-07-01T20:00:00Z',
    },
    {
      stream_id: 'str-205',
      primary_creator: 'lo_fi_hub',
      title: 'Lo-fi Chill Vibes',
      category: 'music',
      role: 'raid-host',
      playback_id: 'pb-205',
      started_at: '2024-07-01T22:00:00Z',
    },
  ],
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const parsed = schema.safeParse({ host_username: searchParams.get('host_username') })

  if (!parsed.success) {
    return NextResponse.json({ error: 'host_username is required', details: parsed.error.flatten() }, { status: 400 })
  }

  const { host_username } = parsed.data
  const streams = HOST_STREAMS[host_username] ?? []

  return NextResponse.json({
    host_username,
    streams,
    total: streams.length,
  })
}
