import { GET } from "../route";
import { POST } from "../verify/route";
import { NextRequest } from "next/server";

function makeVerifyRequest(body: object): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/captcha-math/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/routes-f/captcha-math", () => {
  it("returns a challenge and token", async () => {
    const res = await GET();
    const data = await res.json();
    expect(data).toHaveProperty("challenge");
    expect(data).toHaveProperty("token");
    expect(typeof data.challenge).toBe("string");
    expect(typeof data.token).toBe("string");
    expect(data.challenge).toMatch(/What is \d+ [+\-*] \d+\?/);
  });
});

describe("POST /api/routes-f/captcha-math/verify", () => {
  async function getToken(): Promise<{ token: string; answer: number }> {
    const res = await GET();
    const { token, challenge } = await res.json();
    // Parse answer from challenge
    const match = challenge.match(/What is (\d+) ([+\-*]) (\d+)\?/);
    const a = parseInt(match![1]);
    const op = match![2];
    const b = parseInt(match![3]);
    let answer: number;
    if (op === "+") {
      answer = a + b;
    } else if (op === "-") {
      answer = a - b;
    } else {
      answer = a * b;
    }
    return { token, answer };
  }

  it("returns valid: true for correct answer", async () => {
    const { token, answer } = await getToken();
    const res = await POST(makeVerifyRequest({ token, answer }));
    const data = await res.json();
    expect(data.valid).toBe(true);
  });

  it("returns valid: false for wrong answer", async () => {
    const { token, answer } = await getToken();
    const res = await POST(makeVerifyRequest({ token, answer: answer + 999 }));
    const data = await res.json();
    expect(data.valid).toBe(false);
    expect(data.reason).toBe("wrong_answer");
  });

  it("returns valid: false for expired token", async () => {
    // Manually craft an expired token
    const { createHmac } = await import("crypto");
    const SECRET = "captcha-math-dev-secret-streamfi";
    const payload = { answer: 5, expires_at: Date.now() - 1000 };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = createHmac("sha256", SECRET).update(encoded).digest("base64url");
    const token = `${encoded}.${sig}`;

    const res = await POST(makeVerifyRequest({ token, answer: 5 }));
    const data = await res.json();
    expect(data.valid).toBe(false);
    expect(data.reason).toBe("expired");
  });

  it("returns valid: false for replay (already used token)", async () => {
    const { token, answer } = await getToken();
    // First use
    await POST(makeVerifyRequest({ token, answer }));
    // Replay
    const res = await POST(makeVerifyRequest({ token, answer }));
    const data = await res.json();
    expect(data.valid).toBe(false);
    expect(data.reason).toBe("already_used");
  });

  it("returns valid: false for tampered token", async () => {
    const res = await POST(makeVerifyRequest({ token: "invalid.token", answer: 5 }));
    const data = await res.json();
    expect(data.valid).toBe(false);
  });
});
