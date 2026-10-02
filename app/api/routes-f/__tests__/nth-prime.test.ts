/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../nth-prime/route";

test("/api/routes-f/nth-prime returns the tenth prime", async () => {
  const req = new NextRequest("http://localhost/api/routes-f/nth-prime?n=10");
  const res = await GET(req);

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ n: 10, prime: 29 });
});

test("/api/routes-f/nth-prime returns the 100000th prime", async () => {
  const req = new NextRequest("http://localhost/api/routes-f/nth-prime?n=100000");
  const res = await GET(req);

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ n: 100000, prime: 1299709 });
});

test("/api/routes-f/nth-prime rejects out-of-range values", async () => {
  const req = new NextRequest("http://localhost/api/routes-f/nth-prime?n=0");
  const res = await GET(req);

  expect(res.status).toBe(400);
  const data = await res.json();
  expect(data.error).toMatch(/integer between 1 and 100000/i);
});
