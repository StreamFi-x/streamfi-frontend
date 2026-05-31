import { POST } from "./route";

describe("Polynomial Evaluator API", () => {
  it("should return 400 for invalid JSON", async () => {
    const req = new Request("http://localhost/api/routes-f/polynomial-eval", {
      method: "POST",
      body: "not-json",
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("should return 400 when coefficients is missing", async () => {
    const req = new Request("http://localhost/api/routes-f/polynomial-eval", {
      method: "POST",
      body: JSON.stringify({ x: 2 }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it("should return 400 when coefficients is empty", async () => {
    const req = new Request("http://localhost/api/routes-f/polynomial-eval", {
      method: "POST",
      body: JSON.stringify({ coefficients: [], x: 2 }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it("should return 400 when x is not a number or array", async () => {
    const req = new Request("http://localhost/api/routes-f/polynomial-eval", {
      method: "POST",
      body: JSON.stringify({ coefficients: [1, 2, 3], x: "hello" }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it("evaluates a constant polynomial f(x) = 5", async () => {
    const req = new Request("http://localhost/api/routes-f/polynomial-eval", {
      method: "POST",
      body: JSON.stringify({ coefficients: [5], x: 10 }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results).toEqual([5]);
  });

  it("evaluates f(x) = 2x + 1 at x=3 via Horner's method", async () => {
    // Horner: coefficients = [2, 1], x=3 → 2*3+1 = 7
    const req = new Request("http://localhost/api/routes-f/polynomial-eval", {
      method: "POST",
      body: JSON.stringify({ coefficients: [2, 1], x: 3 }),
    });
    const res = await POST(req as any);
    const data = await res.json();
    expect(data.results).toEqual([7]);
  });

  it("evaluates f(x) = 3x² + 2x + 1 at x=2 via Horner (matches expanded form)", async () => {
    // Expanded: 3*4 + 2*2 + 1 = 17. Horner: [3,2,1], x=2 → ((3*2)+2)*2+1=17
    const req = new Request("http://localhost/api/routes-f/polynomial-eval", {
      method: "POST",
      body: JSON.stringify({ coefficients: [3, 2, 1], x: 2 }),
    });
    const res = await POST(req as any);
    const data = await res.json();
    expect(data.results).toEqual([17]);
  });

  it("evaluates a polynomial at multiple x values", async () => {
    // f(x) = x^2 = [1, 0, 0], x=[0,2,3] → [0,4,9]
    const req = new Request("http://localhost/api/routes-f/polynomial-eval", {
      method: "POST",
      body: JSON.stringify({ coefficients: [1, 0, 0], x: [0, 2, 3] }),
    });
    const res = await POST(req as any);
    const data = await res.json();
    expect(data.results).toEqual([0, 4, 9]);
  });

  it("Horner result matches expanded form for degree-3 polynomial", async () => {
    // f(x) = 2x^3 - 3x^2 + x - 5 at x=4
    // Expanded: 2*64 - 3*16 + 4 - 5 = 128 - 48 + 4 - 5 = 79
    const x = 4;
    const coefficients = [2, -3, 1, -5];
    const expanded = 2 * x ** 3 - 3 * x ** 2 + 1 * x - 5;

    const req = new Request("http://localhost/api/routes-f/polynomial-eval", {
      method: "POST",
      body: JSON.stringify({ coefficients, x }),
    });
    const res = await POST(req as any);
    const data = await res.json();
    expect(data.results[0]).toBeCloseTo(expanded);
  });

  it("handles x=0", async () => {
    // f(0) = constant term (last coef)
    const req = new Request("http://localhost/api/routes-f/polynomial-eval", {
      method: "POST",
      body: JSON.stringify({ coefficients: [5, 3, 7], x: 0 }),
    });
    const res = await POST(req as any);
    const data = await res.json();
    expect(data.results).toEqual([7]);
  });
});
