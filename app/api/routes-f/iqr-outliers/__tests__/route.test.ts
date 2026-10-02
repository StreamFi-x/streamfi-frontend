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
  new Request('http://localhost/api/routes-f/iqr-outliers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import('next/server').NextRequest

describe('POST /api/routes-f/iqr-outliers', () => {
  it('returns 400 when data is missing or empty', async () => {
    const res = await POST(makeRequest({ data: [] }))
    expect(res.status).toBe(400)
  })

  it('detects no outliers in uniform dataset', async () => {
    const res = await POST(makeRequest({ data: [10, 12, 14, 15, 16, 18, 20] }))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.outliers).toEqual([])
    expect(body.q1).toBe(12)
    expect(body.q3).toBe(18)
    expect(body.iqr).toBe(6)
  })

  it('detects outliers in dataset with extreme high and low values', async () => {
    const res = await POST(makeRequest({ data: [-100, 10, 12, 14, 15, 16, 18, 20, 200] }))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.outliers).toEqual([-100, 200])
  })
})
