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
  new Request('http://localhost/api/routes-f/polynomial-evaluator', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import('next/server').NextRequest

describe('POST /api/routes-f/polynomial-evaluator', () => {
  it('returns 400 when coefficients or x is missing', async () => {
    const res = await POST(makeRequest({ coefficients: [1, 2] }))
    expect(res.status).toBe(400)
  })

  it('evaluates polynomial at a single x value', async () => {
    // 2x^2 - x + 3 at x = 3 -> 2(9) - 3 + 3 = 18
    const res = await POST(makeRequest({ coefficients: [2, -1, 3], x: 3 }))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.results).toEqual([18])
  })

  it('evaluates polynomial at multiple x values matching expanded form', async () => {
    // x^3 - 2x^2 + 4 at x = [0, 1, 2]
    // x=0: 4
    // x=1: 1 - 2 + 4 = 3
    // x=2: 8 - 8 + 4 = 4
    const res = await POST(makeRequest({ coefficients: [1, -2, 0, 4], x: [0, 1, 2] }))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.results).toEqual([4, 3, 4])
  })
})
