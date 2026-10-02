import { describe, it, expect } from 'vitest'
import { GET } from './route'
import { NextRequest } from 'next/server'

function makeRequest(params?: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/routesF/streams-hosted-by-user')
  if (params) {
    for (const [k, v] of Object.entries(params)) {url.searchParams.set(k, v)}
  }
  return new NextRequest(url.toString())
}

describe('GET /api/routesF/streams-hosted-by-user', () => {
  it('returns hosted streams for a known host', async () => {
    const res = await GET(makeRequest({ host_username: 'streamer_ts' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.host_username).toBe('streamer_ts')
    expect(data.streams.length).toBeGreaterThan(0)
  })

  it('returns correct stream shape', async () => {
    const res = await GET(makeRequest({ host_username: 'streamer_ts' }))
    const data = await res.json()
    const stream = data.streams[0]

    expect(stream).toHaveProperty('stream_id')
    expect(stream).toHaveProperty('primary_creator')
    expect(stream).toHaveProperty('title')
    expect(stream).toHaveProperty('role')
    expect(stream).toHaveProperty('playback_id')
    expect(stream).toHaveProperty('started_at')
  })

  it('role is one of co-host, guest, or raid-host', async () => {
    const res = await GET(makeRequest({ host_username: 'beatmaker' }))
    const data = await res.json()

    const validRoles = ['co-host', 'guest', 'raid-host']
    for (const stream of data.streams) {
      expect(validRoles).toContain(stream.role)
    }
  })

  it('returns empty streams for unknown host', async () => {
    const res = await GET(makeRequest({ host_username: 'nobody' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.streams).toHaveLength(0)
    expect(data.total).toBe(0)
  })

  it('returns 400 when host_username is missing', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(400)
  })

  it('returns multiple streams for hosts with more than one', async () => {
    const res = await GET(makeRequest({ host_username: 'beatmaker' }))
    const data = await res.json()
    expect(data.streams.length).toBe(2)
    expect(data.total).toBe(2)
  })
})
