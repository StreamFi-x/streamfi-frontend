import { NextRequest } from "next/server";
import { POST, GET } from "../route";
import { eventBuffer } from "../_lib/buffer";

// Mock the buffer
jest.mock("../_lib/buffer", () => ({
  eventBuffer: {
    addEvents: jest.fn(),
    getEvents: jest.fn(),
    getBufferSize: jest.fn(),
    clearBuffer: jest.fn(),
  },
}));

describe("/api/routes-f/events", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/routes-f/events", () => {
    it("should accept a single valid event", async () => {
      const mockEvent = {
        name: "user_login",
        timestamp: Date.now(),
        properties: { userId: "123" },
      };

      const request = new NextRequest("http://localhost/api/routes-f/events", {
        method: "POST",
        body: JSON.stringify({ event: mockEvent }),
        headers: { "Content-Type": "application/json" },
      });

      (eventBuffer.addEvents as jest.Mock).mockReturnValue(undefined);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.received).toBe(1);
      expect(eventBuffer.addEvents).toHaveBeenCalledWith([mockEvent]);
    });

    it("should accept a batch of valid events", async () => {
      const mockEvents = [
        { name: "user_login", timestamp: Date.now() },
        { name: "page_view", timestamp: Date.now() + 1 },
      ];

      const request = new NextRequest("http://localhost/api/routes-f/events", {
        method: "POST",
        body: JSON.stringify({ events: mockEvents }),
        headers: { "Content-Type": "application/json" },
      });

      (eventBuffer.addEvents as jest.Mock).mockReturnValue(undefined);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.received).toBe(2);
      expect(eventBuffer.addEvents).toHaveBeenCalledWith(mockEvents);
    });

    it("should reject requests with neither event nor events", async () => {
      const request = new NextRequest("http://localhost/api/routes-f/events", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Either 'event' or 'events' must be provided");
    });

    it("should reject requests with both event and events", async () => {
      const request = new NextRequest("http://localhost/api/routes-f/events", {
        method: "POST",
        body: JSON.stringify({
          event: { name: "test", timestamp: Date.now() },
          events: [{ name: "test", timestamp: Date.now() }],
        }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Cannot provide both 'event' and 'events'");
    });

    it("should reject batches larger than 100 events", async () => {
      const largeBatch = Array.from({ length: 101 }, (_, i) => ({
        name: "test_event",
        timestamp: Date.now() + i,
      }));

      const request = new NextRequest("http://localhost/api/routes-f/events", {
        method: "POST",
        body: JSON.stringify({ events: largeBatch }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Batch size cannot exceed 100 events");
    });

    it("should reject events with missing required fields", async () => {
      const request = new NextRequest("http://localhost/api/routes-f/events", {
        method: "POST",
        body: JSON.stringify({
          event: { name: "", timestamp: Date.now() },
        }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Event name is required");
    });

    it("should reject events with invalid timestamp", async () => {
      const request = new NextRequest("http://localhost/api/routes-f/events", {
        method: "POST",
        body: JSON.stringify({
          event: { name: "test", timestamp: -1 },
        }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Timestamp must be a positive integer");
    });

    it("should handle malformed JSON", async () => {
      const request = new NextRequest("http://localhost/api/routes-f/events", {
        method: "POST",
        body: "invalid json",
        headers: { "Content-Type": "application/json" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Internal server error");
    });
  });

  describe("GET /api/routes-f/events", () => {
    it("should return paginated events with default parameters", async () => {
      const mockEvents = [
        { name: "event1", timestamp: Date.now() },
        { name: "event2", timestamp: Date.now() - 1000 },
      ];

      const mockResult = {
        events: mockEvents,
        pagination: {
          page: 1,
          limit: 50,
          total: 2,
          hasNext: false,
          hasPrev: false,
        },
      };

      (eventBuffer.getEvents as jest.Mock).mockReturnValue(mockResult);

      const request = new NextRequest("http://localhost/api/routes-f/events");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockResult);
      expect(eventBuffer.getEvents).toHaveBeenCalledWith({ page: 1, limit: 50 });
    });

    it("should return paginated events with custom parameters", async () => {
      const mockResult = {
        events: [],
        pagination: {
          page: 2,
          limit: 25,
          total: 100,
          hasNext: true,
          hasPrev: true,
        },
      };

      (eventBuffer.getEvents as jest.Mock).mockReturnValue(mockResult);

      const request = new NextRequest(
        "http://localhost/api/routes-f/events?page=2&limit=25"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockResult);
      expect(eventBuffer.getEvents).toHaveBeenCalledWith({ page: 2, limit: 25 });
    });

    it("should validate pagination parameters", async () => {
      const request = new NextRequest(
        "http://localhost/api/routes-f/events?page=0&limit=101"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      // Should default to valid values due to schema validation
      expect(eventBuffer.getEvents).toHaveBeenCalledWith({ page: 1, limit: 50 });
    });

    it("should handle errors gracefully", async () => {
      (eventBuffer.getEvents as jest.Mock).mockImplementation(() => {
        throw new Error("Buffer error");
      });

      const request = new NextRequest("http://localhost/api/routes-f/events");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Internal server error");
    });
  });
});
