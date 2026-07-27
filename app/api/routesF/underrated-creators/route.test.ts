import { describe, it, expect } from 'vitest'
import { GET } from './route'
import { NextRequest } from 'next/server'

function makeRequest(params?: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/routesF/underrated-creators')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  return new NextRequest(url.toString())
}

describe('GET /api/routesF/underrated-creators', () => {
  it('returns a list of creators', async () => {
    const res = await GET(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(data.creators)).toBe(true)
    expect(data.creators.length).toBeGreaterThan(0)
  })

  it('returns correct creator shape', async () => {
    const res = await GET(makeRequest())
    const data = await res.json()
    const creator = data.creators[0]

    expect(creator).toHaveProperty('username')
    expect(creator).toHaveProperty('display_name')
    expect(creator).toHaveProperty('followers')
    expect(creator).toHaveProperty('score')
    expect(creator).toHaveProperty('tips_per_viewer')
    expect(creator).toHaveProperty('chat_msgs_per_viewer')
  })

  it('sorts by score descending', async () => {
    const res = await GET(makeRequest())
    const data = await res.json()

    for (let i = 0; i < data.creators.length - 1; i++) {
      expect(data.creators[i].score).toBeGreaterThanOrEqual(data.creators[i + 1].score)
    }
  })

  it('score equals tips_per_viewer + chat_msgs_per_viewer', async () => {
    const res = await GET(makeRequest())
    const data = await res.json()

    for (const c of data.creators) {
      expect(c.score).toBeCloseTo(c.tips_per_viewer + c.chat_msgs_per_viewer, 2)
    }
  })

  it('respects limit parameter', async () => {
    const res = await GET(makeRequest({ limit: '3' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.creators).toHaveLength(3)
    expect(data.total).toBe(3)
  })

  it('defaults to limit 20', async () => {
    const res = await GET(makeRequest())
    const data = await res.json()
    expect(data.creators.length).toBeLessThanOrEqual(20)
  })

  it('includes scoring_method in response', async () => {
    const res = await GET(makeRequest())
    const data = await res.json()
    expect(data.scoring_method).toBeDefined()
  })
})
