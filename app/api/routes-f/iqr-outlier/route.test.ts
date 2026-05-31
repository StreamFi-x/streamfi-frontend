import { POST } from "./route";

describe("IQR Outlier Detection API", () => {
  it("should return 400 for invalid JSON", async () => {
    const req = new Request("http://localhost/api/routes-f/iqr-outlier", {
      method: "POST",
      body: "bad json",
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it("should return 400 when data is missing", async () => {
    const req = new Request("http://localhost/api/routes-f/iqr-outlier", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it("should return 400 when data is empty", async () => {
    const req = new Request("http://localhost/api/routes-f/iqr-outlier", {
      method: "POST",
      body: JSON.stringify({ data: [] }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it("should return 400 when data contains non-numbers", async () => {
    const req = new Request("http://localhost/api/routes-f/iqr-outlier", {
      method: "POST",
      body: JSON.stringify({ data: [1, "two", 3] }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it("should return 400 for a negative multiplier", async () => {
    const req = new Request("http://localhost/api/routes-f/iqr-outlier", {
      method: "POST",
      body: JSON.stringify({ data: [1, 2, 3, 4, 5], multiplier: -1 }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it("detects dataset with no outliers", async () => {
    const req = new Request("http://localhost/api/routes-f/iqr-outlier", {
      method: "POST",
      body: JSON.stringify({ data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.outliers).toEqual([]);
    expect(typeof data.q1).toBe("number");
    expect(typeof data.q3).toBe("number");
    expect(typeof data.iqr).toBe("number");
    expect(typeof data.lower_bound).toBe("number");
    expect(typeof data.upper_bound).toBe("number");
  });

  it("detects obvious outliers", async () => {
    // Dataset: 1-10 with 100 as an outlier
    const req = new Request("http://localhost/api/routes-f/iqr-outlier", {
      method: "POST",
      body: JSON.stringify({ data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100] }),
    });
    const res = await POST(req as any);
    const data = await res.json();
    expect(data.outliers).toContain(100);
  });

  it("uses default multiplier of 1.5", async () => {
    const dataset = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100];
    const req1 = new Request("http://localhost/api/routes-f/iqr-outlier", {
      method: "POST",
      body: JSON.stringify({ data: dataset }),
    });
    const req2 = new Request("http://localhost/api/routes-f/iqr-outlier", {
      method: "POST",
      body: JSON.stringify({ data: dataset, multiplier: 1.5 }),
    });
    const [res1, res2] = await Promise.all([POST(req1 as any), POST(req2 as any)]);
    const [d1, d2] = await Promise.all([res1.json(), res2.json()]);
    expect(d1).toEqual(d2);
  });

  it("custom multiplier changes bounds", async () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15];
    const reqDefault = new Request("http://localhost/api/routes-f/iqr-outlier", {
      method: "POST",
      body: JSON.stringify({ data, multiplier: 1.5 }),
    });
    const reqStrict = new Request("http://localhost/api/routes-f/iqr-outlier", {
      method: "POST",
      body: JSON.stringify({ data, multiplier: 0.5 }),
    });
    const [resDefault, resStrict] = await Promise.all([
      POST(reqDefault as any),
      POST(reqStrict as any),
    ]);
    const [dDefault, dStrict] = await Promise.all([resDefault.json(), resStrict.json()]);
    // Stricter multiplier yields narrower bounds, more outliers
    expect(dStrict.upper_bound).toBeLessThan(dDefault.upper_bound);
  });

  it("computes correct IQR values for a known dataset", async () => {
    // sorted: [2, 4, 6, 8, 10] → Q1=4, Q3=8, IQR=4
    const req = new Request("http://localhost/api/routes-f/iqr-outlier", {
      method: "POST",
      body: JSON.stringify({ data: [10, 2, 6, 8, 4] }),
    });
    const res = await POST(req as any);
    const data = await res.json();
    expect(data.q1).toBeCloseTo(4);
    expect(data.q3).toBeCloseTo(8);
    expect(data.iqr).toBeCloseTo(4);
    expect(data.lower_bound).toBeCloseTo(4 - 1.5 * 4); // -2
    expect(data.upper_bound).toBeCloseTo(8 + 1.5 * 4); // 14
  });
});
