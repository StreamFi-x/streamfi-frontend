/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../sentence-case-capitalizer/route";

function makeReq(body: unknown) {
  return new NextRequest(
    "http://localhost/api/routesF/sentence-case-capitalizer",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

describe("/api/routesF/sentence-case-capitalizer", () => {
  it("capitalizes the first letter of each sentence", async () => {
    const res = await POST(
      makeReq({ text: "hello world. this is a test! is it working? yes." })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.result).toBe(
      "Hello world. This is a test! Is it working? Yes."
    );
  });

  it("does not split sentences on common abbreviations", async () => {
    const res = await POST(
      makeReq({ text: "dr. smith arrived at 10 a.m. he said hello." })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.result).toBe("Dr. Smith arrived at 10 a.m. He said hello.");
  });

  it("handles a paragraph with mixed punctuation", async () => {
    const res = await POST(
      makeReq({ text: "wow! this is great? yes it is. fantastic." })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.result).toBe("Wow! This is great? Yes it is. Fantastic.");
  });

  it("rejects invalid request bodies", async () => {
    const res = await POST(makeReq({ text: 123 }));
    expect(res.status).toBe(400);
  });
});
