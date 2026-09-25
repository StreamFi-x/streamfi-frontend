import { POST } from '../route'

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { 'Content-Type': 'application/json' },
      }),
  },
}))

const makeRequest = (body?: object) =>
  new Request('http://localhost/api/routes-f/category-cross-promotion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import('next/server').NextRequest

describe('POST /api/routes-f/category-cross-promotion', () => {
  it('returns 400 when category is missing', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns 404 for unknown category', async () => {
    const res = await POST(makeRequest({ category: 'Quantum Physics' }))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/not found/i)
  })

  it('returns 200 and related categories for known category', async () => {
    const res = await POST(makeRequest({ category: 'Gaming' }))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.related).toBeDefined()
    expect(Array.isArray(body.related)).toBe(true)
    expect(body.related.length).toBeGreaterThan(0)
    expect(body.related[0]).toHaveProperty('category')
    expect(body.related[0]).toHaveProperty('similarity_score')
  })
})
