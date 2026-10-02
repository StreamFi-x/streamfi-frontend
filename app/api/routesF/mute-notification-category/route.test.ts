import { describe, it, expect } from 'vitest'
import { GET, POST } from './route'
import { NextRequest } from 'next/server'

function makeGet(viewerId: string): NextRequest {
  return new NextRequest(`http://localhost/api/routesF/mute-notification-category?viewer_id=${viewerId}`)
}

function makePost(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/routesF/mute-notification-category', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/routesF/mute-notification-category', () => {
  it('returns muted and active categories for viewer', async () => {
    const res = await GET(makeGet('viewer-get-test'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.viewer_id).toBe('viewer-get-test')
    expect(Array.isArray(data.muted_categories)).toBe(true)
    expect(Array.isArray(data.active_categories)).toBe(true)
    expect(Array.isArray(data.all_categories)).toBe(true)
  })

  it('returns 400 when viewer_id is missing', async () => {
    const res = await GET(new NextRequest('http://localhost/api/routesF/mute-notification-category'))
    expect(res.status).toBe(400)
  })

  it('starts with no muted categories for new viewer', async () => {
    const res = await GET(makeGet('fresh-viewer-123'))
    const data = await res.json()
    expect(data.muted_categories).toHaveLength(0)
    expect(data.active_categories).toHaveLength(data.all_categories.length)
  })
})

describe('POST /api/routesF/mute-notification-category', () => {
  const UNIQUE_VIEWER = 'mute-post-test-viewer-' + Date.now()

  it('mutes a category successfully', async () => {
    const res = await POST(makePost({ viewer_id: UNIQUE_VIEWER, category: 'new_follower', action: 'mute' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.category).toBe('new_follower')
    expect(data.action).toBe('mute')
    expect(data.muted_categories).toContain('new_follower')
  })

  it('unmutes a muted category', async () => {
    const viewerId = 'unmute-test-' + Date.now()
    await POST(makePost({ viewer_id: viewerId, category: 'tip_received', action: 'mute' }))
    const res = await POST(makePost({ viewer_id: viewerId, category: 'tip_received', action: 'unmute' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.muted_categories).not.toContain('tip_received')
  })

  it('returns 409 when trying to mute an already-muted category', async () => {
    const viewerId = 'conflict-test-' + Date.now()
    await POST(makePost({ viewer_id: viewerId, category: 'stream_live', action: 'mute' }))
    const res = await POST(makePost({ viewer_id: viewerId, category: 'stream_live', action: 'mute' }))
    expect(res.status).toBe(409)
  })

  it('returns 409 when trying to unmute a category that is not muted', async () => {
    const res = await POST(makePost({ viewer_id: 'no-mutes-' + Date.now(), category: 'raid', action: 'unmute' }))
    expect(res.status).toBe(409)
  })

  it('returns 400 for invalid category', async () => {
    const res = await POST(makePost({ viewer_id: 'any', category: 'invalid_cat', action: 'mute' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid action', async () => {
    const res = await POST(makePost({ viewer_id: 'any', category: 'raid', action: 'toggle' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when body is malformed JSON', async () => {
    const res = await POST(new NextRequest('http://localhost/api/routesF/mute-notification-category', {
      method: 'POST',
      body: 'not json',
    }))
    expect(res.status).toBe(400)
  })
})
