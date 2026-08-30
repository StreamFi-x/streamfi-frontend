import { describe, it, expect } from 'vitest'
import { GET } from './route'
import { NextRequest } from 'next/server'

function makeRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/routesF/friends-watching')
  for (const [k, v] of Object.entries(params)) {url.searchParams.set(k, v)}
  return new NextRequest(url.toString())
}

describe('GET /api/routesF/friends-watching', () => {
  it('returns streams with friend watchers for a known viewer', async () => {
    const res = await GET(makeRequest({ viewer_id: 'user-01' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.viewer_id).toBe('user-01')
    expect(Array.isArray(data.streams)).toBe(true)
    expect(data.total).toBeGreaterThanOrEqual(0)
  })

  it('returns streams with friend info attached', async () => {
    const res = await GET(makeRequest({ viewer_id: 'user-03' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    if (data.streams.length > 0) {
      expect(data.streams[0]).toHaveProperty('stream')
      expect(data.streams[0]).toHaveProperty('friends_watching')
      expect(data.streams[0]).toHaveProperty('friend_count')
      expect(Array.isArray(data.streams[0].friends_watching)).toBe(true)
    }
  })

  it('sorts by friend_count descending', async () => {
    const res = await GET(makeRequest({ viewer_id: 'user-03' }))
    const data = await res.json()

    for (let i = 0; i < data.streams.length - 1; i++) {
      expect(data.streams[i].friend_count).toBeGreaterThanOrEqual(data.streams[i + 1].friend_count)
    }
  })

  it('returns empty streams for unknown viewer', async () => {
    const res = await GET(makeRequest({ viewer_id: 'unknown-user' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.streams).toHaveLength(0)
    expect(data.total).toBe(0)
  })

  it('respects limit parameter', async () => {
    const res = await GET(makeRequest({ viewer_id: 'user-03', limit: '1' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.streams.length).toBeLessThanOrEqual(1)
  })

  it('returns 400 when viewer_id is missing', async () => {
    const res = await GET(new NextRequest('http://localhost/api/routesF/friends-watching'))
    expect(res.status).toBe(400)
  })
})
