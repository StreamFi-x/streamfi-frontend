import { GET } from "../route";
import { NextRequest } from "next/server";

describe("GET /api/routes-f/word-of-the-day", () => {
  it("returns required response fields", async () => {
    const req = new NextRequest(
      "http://localhost/api/routes-f/word-of-the-day?date=2026-04-25"
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.date).toBe("2026-04-25");
    expect(typeof body.word).toBe("string");
    expect(typeof body.definition).toBe("string");
    expect(typeof body.part_of_speech).toBe("string");
    expect(typeof body.example_sentence).toBe("string");
  });

  it("is deterministic for the same date", async () => {
    const url = "http://localhost/api/routes-f/word-of-the-day?date=2026-04-25";
    const resA = await GET(new NextRequest(url));
    const resB = await GET(new NextRequest(url));

    expect(await resA.json()).toEqual(await resB.json());
  });

  it("returns stable but different values across multiple dates", async () => {
    const dates = ["2026-01-01", "2026-04-25", "2026-12-31"];
    const responses: Array<{ date: string; word: string }> = [];

    for (const date of dates) {
      const res = await GET(
        new NextRequest(
          `http://localhost/api/routes-f/word-of-the-day?date=${date}`
        )
      );
      expect(res.status).toBe(200);
      responses.push(await res.json());
    }

    expect(responses.map(r => r.date)).toEqual(dates);
    expect(new Set(responses.map(r => r.word)).size).toBeGreaterThan(1);
  });

  it("rejects invalid format", async () => {
    const req = new NextRequest(
      "http://localhost/api/routes-f/word-of-the-day?date=04-25-2026"
    );
    const res = await GET(req);

    expect(res.status).toBe(400);
  });

  it("rejects out-of-range dates", async () => {
    const resTooEarly = await GET(
      new NextRequest(
        "http://localhost/api/routes-f/word-of-the-day?date=1989-12-31"
      )
    );
    const resTooLate = await GET(
      new NextRequest(
        "http://localhost/api/routes-f/word-of-the-day?date=2101-01-01"
      )
    );

    expect(resTooEarly.status).toBe(400);
    expect(resTooLate.status).toBe(400);
  });
});
