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
  new Request('http://localhost/api/routes-f/reverse-word-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import('next/server').NextRequest

describe('POST /api/routes-f/reverse-word-order', () => {
  it('returns 400 when text parameter is missing or invalid', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('reverses words in simple sentence', async () => {
    const res = await POST(makeRequest({ text: 'hello world from streamfi' }))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.result).toBe('streamfi from world hello')
  })

  it('collapses multi-space and handles leading/trailing whitespace', async () => {
    const res = await POST(makeRequest({ text: '   hello   world   again  ' }))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.result).toBe('again world hello')
  })
})
