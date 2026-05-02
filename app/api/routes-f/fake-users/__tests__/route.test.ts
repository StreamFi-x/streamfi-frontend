/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";

function makeReq(query = "") {
  return new NextRequest(`http://localhost/api/routes-f/fake-users${query}`);
}

describe("GET /api/routes-f/fake-users", () => {
  it("returns deterministic users for the same seed", async () => {
    const q = "?count=5&seed=42";
    const r1 = await GET(makeReq(q));
    const r2 = await GET(makeReq(q));

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect((await r1.json()).users).toEqual((await r2.json()).users);
  });

  it("enforces count cap", async () => {
    const res = await GET(makeReq("?count=101"));
    expect(res.status).toBe(400);
  });

  it("returns well-formed user shape", async () => {
    const res = await GET(makeReq("?count=1&seed=7"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.users).toHaveLength(1);
    const user = body.users[0];
    expect(user.id).toMatch(/^usr_\d{6}_1$/);
    expect(user.name).toMatch(/^[A-Za-z]+\s[A-Za-z]+$/);
    expect(user.email).toMatch(/^[a-z]+\.[a-z]+@example\.com$/);
    expect(user.phone).toMatch(/^\+1-\d{3}-\d{3}-\d{4}$/);
    expect(user.address.street.length).toBeGreaterThan(0);
    expect(user.address.city.length).toBeGreaterThan(0);
    expect(user.address.state.length).toBeGreaterThan(0);
    expect(user.address.zip).toMatch(/^\d{5}$/);
    expect(user.address.country.length).toBeGreaterThan(0);
    expect(user.avatar_url).toContain("dicebear");
  });
});
