import { GET, POST } from "./route";
import { clearOnAirStates } from "./store";

const URL_BASE = "http://localhost/api/routesF/stream-on-air";

function getRequest(query = "") {
  return new Request(`${URL_BASE}${query}`, { method: "GET" });
}

function postRequest(body: unknown) {
  return new Request(URL_BASE, { method: "POST", body: JSON.stringify(body) });
}

describe("/api/routesF/stream-on-air", () => {
  beforeEach(() => {
    clearOnAirStates();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("POST", () => {
    it("sets the signal on and stamps since", async () => {
      const response = await POST(
        postRequest({ creator_id: "creator_123", on_air: true })
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.on_air).toBe(true);
      expect(data.since).toBe("2026-01-01T12:00:00.000Z");
      expect(data.changed).toBe(true);
    });

    it("sets the signal off", async () => {
      await POST(postRequest({ creator_id: "creator_123", on_air: true }));

      jest.setSystemTime(new Date("2026-01-01T13:00:00.000Z"));
      const response = await POST(
        postRequest({ creator_id: "creator_123", on_air: false })
      );
      const data = await response.json();

      expect(data.on_air).toBe(false);
      expect(data.since).toBe("2026-01-01T13:00:00.000Z");
      expect(data.changed).toBe(true);
    });

    it("does not move since when the value is unchanged", async () => {
      await POST(postRequest({ creator_id: "creator_123", on_air: true }));

      jest.setSystemTime(new Date("2026-01-01T12:30:00.000Z"));
      const response = await POST(
        postRequest({ creator_id: "creator_123", on_air: true })
      );
      const data = await response.json();

      expect(data.since).toBe("2026-01-01T12:00:00.000Z");
      expect(data.changed).toBe(false);
    });

    it("rejects a non-boolean on_air", async () => {
      const response = await POST(
        postRequest({ creator_id: "creator_123", on_air: "yes" })
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("on_air");
    });

    it("rejects a missing on_air", async () => {
      const response = await POST(postRequest({ creator_id: "creator_123" }));

      expect(response.status).toBe(400);
    });

    it("rejects a missing creator_id", async () => {
      const response = await POST(postRequest({ on_air: true }));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("creator_id");
    });

    it("rejects an invalid JSON body", async () => {
      const response = await POST(
        new Request(URL_BASE, { method: "POST", body: "nope" })
      );

      expect(response.status).toBe(400);
    });
  });

  describe("GET", () => {
    it("reports off with a null since for an unknown creator", async () => {
      const response = await GET(getRequest("?creator_id=unknown_creator"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ on_air: false, since: null, duration_seconds: 0 });
    });

    it("returns 400 when creator_id is missing", async () => {
      const response = await GET(getRequest());
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("creator_id");
    });

    it("computes the duration since the toggle", async () => {
      await POST(postRequest({ creator_id: "creator_123", on_air: true }));

      jest.setSystemTime(new Date("2026-01-01T12:05:30.000Z"));
      const response = await GET(getRequest("?creator_id=creator_123"));
      const data = await response.json();

      expect(data.on_air).toBe(true);
      expect(data.since).toBe("2026-01-01T12:00:00.000Z");
      expect(data.duration_seconds).toBe(330);
    });

    it("resets the duration when the signal flips", async () => {
      await POST(postRequest({ creator_id: "creator_123", on_air: true }));

      jest.setSystemTime(new Date("2026-01-01T14:00:00.000Z"));
      await POST(postRequest({ creator_id: "creator_123", on_air: false }));

      jest.setSystemTime(new Date("2026-01-01T14:00:10.000Z"));
      const response = await GET(getRequest("?creator_id=creator_123"));
      const data = await response.json();

      expect(data.on_air).toBe(false);
      expect(data.duration_seconds).toBe(10);
    });

    it("tracks creators independently", async () => {
      await POST(postRequest({ creator_id: "creator_a", on_air: true }));
      await POST(postRequest({ creator_id: "creator_b", on_air: false }));

      const a = await (await GET(getRequest("?creator_id=creator_a"))).json();
      const b = await (await GET(getRequest("?creator_id=creator_b"))).json();

      expect(a.on_air).toBe(true);
      expect(b.on_air).toBe(false);
    });
  });
});
