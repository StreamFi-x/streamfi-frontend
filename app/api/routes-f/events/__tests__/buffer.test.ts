import { EventBufferManager } from "../_lib/buffer";

describe("EventBufferManager", () => {
  let buffer: EventBufferManager;

  beforeEach(() => {
    buffer = new EventBufferManager();
  });

  describe("addEvents", () => {
    it("should add events to buffer", () => {
      const events = [
        { name: "test1", timestamp: Date.now() },
        { name: "test2", timestamp: Date.now() + 1 },
      ];

      buffer.addEvents(events);
      expect(buffer.getBufferSize()).toBe(2);
    });

    it("should handle buffer overflow by removing oldest events", () => {
      // Fill buffer to capacity
      const events = Array.from({ length: 10000 }, (_, i) => ({
        name: `event${i}`,
        timestamp: Date.now() + i,
      }));

      buffer.addEvents(events);
      expect(buffer.getBufferSize()).toBe(10000);

      // Add more events to trigger overflow
      const newEvents = [
        { name: "new1", timestamp: Date.now() + 10001 },
        { name: "new2", timestamp: Date.now() + 10002 },
      ];

      buffer.addEvents(newEvents);
      expect(buffer.getBufferSize()).toBe(10000);

      // Verify oldest events were removed
      const result = buffer.getEvents({ page: 1, limit: 10000 });
      expect(result.events).toHaveLength(10000);
      expect(result.events[0].name).toBe("event2"); // event0 should be removed
      expect(result.events[9999].name).toBe("new2");
    });

    it("should handle single event addition", () => {
      const event = { name: "single", timestamp: Date.now() };
      buffer.addEvents([event]);
      expect(buffer.getBufferSize()).toBe(1);
    });
  });

  describe("getEvents", () => {
    beforeEach(() => {
      // Add test events
      const events = Array.from({ length: 10 }, (_, i) => ({
        name: `event${i}`,
        timestamp: Date.now() + i,
      }));
      buffer.addEvents(events);
    });

    it("should return events sorted by timestamp (newest first)", () => {
      const result = buffer.getEvents({ page: 1, limit: 5 });
      expect(result.events).toHaveLength(5);
      expect(result.events[0].name).toBe("event9"); // newest
      expect(result.events[4].name).toBe("event5");
    });

    it("should handle pagination correctly", () => {
      const page1 = buffer.getEvents({ page: 1, limit: 3 });
      const page2 = buffer.getEvents({ page: 2, limit: 3 });

      expect(page1.events).toHaveLength(3);
      expect(page2.events).toHaveLength(3);
      expect(page1.events[0].name).toBe("event9");
      expect(page2.events[0].name).toBe("event6");

      expect(page1.pagination.page).toBe(1);
      expect(page1.pagination.hasNext).toBe(true);
      expect(page1.pagination.hasPrev).toBe(false);

      expect(page2.pagination.page).toBe(2);
      expect(page2.pagination.hasNext).toBe(true);
      expect(page2.pagination.hasPrev).toBe(true);
    });

    it("should handle last page correctly", () => {
      const result = buffer.getEvents({ page: 4, limit: 3 });
      expect(result.events).toHaveLength(1);
      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrev).toBe(true);
    });

    it("should return empty result for page beyond range", () => {
      const result = buffer.getEvents({ page: 10, limit: 5 });
      expect(result.events).toHaveLength(0);
      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrev).toBe(true);
    });

    it("should use default pagination parameters", () => {
      const result = buffer.getEvents({});
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(50);
    });
  });

  describe("buffer management", () => {
    it("should clear buffer", () => {
      buffer.addEvents([{ name: "test", timestamp: Date.now() }]);
      expect(buffer.getBufferSize()).toBe(1);

      buffer.clearBuffer();
      expect(buffer.getBufferSize()).toBe(0);
    });

    it("should return correct buffer size", () => {
      expect(buffer.getBufferSize()).toBe(0);
      buffer.addEvents([{ name: "test", timestamp: Date.now() }]);
      expect(buffer.getBufferSize()).toBe(1);
    });

    it("should return buffer statistics", () => {
      const events = Array.from({ length: 50 }, (_, i) => ({
        name: `event${i}`,
        timestamp: Date.now() + i,
      }));
      buffer.addEvents(events);

      const stats = buffer.getStats();
      expect(stats.size).toBe(50);
      expect(stats.maxSize).toBe(10000);
      expect(stats.utilization).toBe(0.5); // 50/10000
    });
  });
});
