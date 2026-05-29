import { NextRequest } from "next/server";
import { POST } from "../route";

function makeReq(password: string) {
  return new NextRequest("http://localhost/api/routes-f/password-entropy", {
    method: "POST",
    body: JSON.stringify({ password }),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/routes-f/password-entropy", () => {
  it("flags simple passwords as weak", async () => {
    const res = await POST(makeReq("password123"));
    const body = await res.json();
    expect(body.strength === "very_weak" || body.strength === "weak").toBe(
      true
    );
  });

  it("rates complex passwords higher", async () => {
    const res = await POST(makeReq("V3ry$Tr0ng!Passw0rd#2026"));
    const body = await res.json();
    expect(body.entropy_bits).toBeGreaterThan(60);
    expect(["strong", "very_strong"]).toContain(body.strength);
  });
});
