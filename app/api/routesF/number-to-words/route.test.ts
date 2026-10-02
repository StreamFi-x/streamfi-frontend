import { NextRequest } from "next/server";
import { GET, integerToWords } from "./route";

describe("integerToWords", () => {
  it("handles reference values", () => {
    expect(integerToWords(BigInt(0))).toBe("zero");
    expect(integerToWords(BigInt(21))).toBe("twenty-one");
    expect(integerToWords(BigInt(105))).toBe("one hundred five");
    expect(integerToWords(BigInt(1234567))).toBe(
      "one million two hundred thirty-four thousand five hundred sixty-seven"
    );
  });

  it("handles negatives", () => {
    expect(integerToWords(BigInt(-42))).toBe("minus forty-two");
  });
});

describe("GET /api/routesF/number-to-words", () => {
  it("returns words for n", async () => {
    const req = new NextRequest(
      "http://localhost/api/routesF/number-to-words?n=100000000000001"
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect((await res.json()).words).toBe("one hundred trillion one");
  });

  it("rejects invalid n", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/routesF/number-to-words?n=1.2")
    );
    expect(res.status).toBe(400);
  });

  it("rejects out-of-range boundary", async () => {
    const res = await GET(
      new NextRequest(
        "http://localhost/api/routesF/number-to-words?n=1000000000000000"
      )
    );
    expect(res.status).toBe(400);
  });
});
