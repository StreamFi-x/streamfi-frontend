/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../company-name-generator/route";

function makeReq(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/routesF/company-name-generator");
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  
  return new NextRequest(url.toString(), { method: "GET" });
}

describe("/api/routesF/company-name-generator", () => {
  it("generates default 5 company names", async () => {
    const res = await GET(makeReq());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.names).toHaveLength(5);
    expect(data.count).toBe(5);
    expect(data.industry).toBe("any");
    expect(typeof data.seed).toBe("string");
  });

  it("respects count parameter", async () => {
    const res = await GET(makeReq({ count: "3" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.names).toHaveLength(3);
    expect(data.count).toBe(3);
  });

  it("filters by tech industry", async () => {
    const res = await GET(makeReq({ industry: "tech", count: "10" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.industry).toBe("tech");
    expect(data.names).toHaveLength(10);
    
    // Check that names contain tech-related words
    const allNames = data.names.join(" ");
    const techWords = ["Tech", "Digital", "Cyber", "Smart", "Data", "Cloud", "System", "Network", "Labs", "Solutions"];
    const containsTechWords = techWords.some(word => allNames.includes(word));
    expect(containsTechWords).toBe(true);
  });

  it("produces deterministic results with seed", async () => {
    const res1 = await GET(makeReq({ seed: "42", count: "3" }));
    const data1 = await res1.json();

    const res2 = await GET(makeReq({ seed: "42", count: "3" }));
    const data2 = await res2.json();

    expect(data1.names).toEqual(data2.names);
    expect(data1.seed).toBe(42);
    expect(data2.seed).toBe(42);
  });

  it("produces different results with different seeds", async () => {
    const res1 = await GET(makeReq({ seed: "42", count: "5" }));
    const data1 = await res1.json();

    const res2 = await GET(makeReq({ seed: "123", count: "5" }));
    const data2 = await res2.json();

    expect(data1.names).not.toEqual(data2.names);
  });

  it("handles finance industry filter", async () => {
    const res = await GET(makeReq({ industry: "finance", count: "5" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.industry).toBe("finance");
    
    const allNames = data.names.join(" ");
    const financeWords = ["Capital", "Bank", "Fund", "Investment", "Trust", "Partners", "Holdings"];
    const containsFinanceWords = financeWords.some(word => allNames.includes(word));
    expect(containsFinanceWords).toBe(true);
  });

  it("handles food industry filter", async () => {
    const res = await GET(makeReq({ industry: "food", count: "5" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.industry).toBe("food");
    
    const allNames = data.names.join(" ");
    const foodWords = ["Fresh", "Organic", "Kitchen", "Bistro", "Cafe", "Foods", "Grill"];
    const containsFoodWords = foodWords.some(word => allNames.includes(word));
    expect(containsFoodWords).toBe(true);
  });

  it("clamps count to reasonable limits", async () => {
    const res = await GET(makeReq({ count: "100" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.count).toBe(50); // Should be clamped to max 50
  });

  it("handles invalid industry gracefully", async () => {
    const res = await GET(makeReq({ industry: "invalid" }));

    expect(res.status).toBe(400);
  });
});