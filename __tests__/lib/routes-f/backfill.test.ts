/**
 * Tests for backfill utility functions
 * Verifies idempotency, data reconstruction, and error handling
 */

jest.mock("@vercel/postgres", () => ({
  sql: jest.fn(),
}));

jest.mock("@/lib/tracing/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

import { sql } from "@vercel/postgres";
import {
  ensureBackfillSchema,
  getOrCreateBackfillJob,
  backfillWatchHistory,
  backfillSessionRetention,
  backfillSessionChatEngagement,
  getBackfillStatus,
} from "@/lib/routes-f/backfill";

describe("backfill utility", () => {
  const mockSql = sql as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("ensureBackfillSchema", () => {
    it("should verify backfill tables exist", async () => {
      mockSql.mockResolvedValueOnce({ rows: [{ "1": 1 }] });

      await ensureBackfillSchema();

      expect(mockSql).toHaveBeenCalledWith(
        expect.stringContaining("route_f_backfill_status")
      );
    });

    it("should throw if tables do not exist", async () => {
      mockSql.mockRejectedValueOnce(
        new Error("relation does not exist")
      );

      await expect(ensureBackfillSchema()).rejects.toThrow(
        "Backfill tables not initialized"
      );
    });
  });

  describe("getOrCreateBackfillJob", () => {
    it("should return existing job", async () => {
      const mockJob = {
        id: "job-1",
        table_name: "watch_history",
        rows_backfilled: 100,
        rows_skipped: 5,
        status: "pending",
      };

      mockSql.mockResolvedValueOnce({ rows: [mockJob] });

      const result = await getOrCreateBackfillJob("watch_history");

      expect(result.id).toBe("job-1");
      expect(result.table_name).toBe("watch_history");
    });

    it("should create new job if none exists", async () => {
      mockSql
        .mockResolvedValueOnce({ rows: [] })  // First query: no existing job
        .mockResolvedValueOnce({
          rows: [{
            id: "new-job-1",
            table_name: "watch_history",
            rows_backfilled: 0,
            rows_skipped: 0,
            status: "pending",
          }],
        });  // Second query: created job

      const result = await getOrCreateBackfillJob("watch_history");

      expect(result.id).toBe("new-job-1");
      expect(result.status).toBe("pending");
    });
  });

  describe("backfillWatchHistory", () => {
    it("should process sessions and create watch_history entries", async () => {
      mockSql
        .mockResolvedValueOnce({ rows: [{ id: "job-1", status: "pending" }] })  // getOrCreateBackfillJob
        .mockResolvedValueOnce({ rows: [] })  // startBackfillJob
        .mockResolvedValueOnce({
          rows: [{
            id: "session-1",
            creator_id: "creator-1",
            started_at: new Date(),
            title: "Test Stream",
          }],
        })  // find sessions
        .mockResolvedValueOnce({
          rows: [{
            user_id: "viewer-1",
            first_joined: new Date(),
            last_left: new Date(Date.now() + 3600000),
          }],
        })  // get viewers
        .mockResolvedValueOnce({ rows: [] })  // insert watch_history
        .mockResolvedValueOnce({ rows: [] });  // completeBackfillJob

      const result = await backfillWatchHistory(100);

      expect(result.tableName).toBe("watch_history");
      expect(result.success).toBe(true);
      expect(result.rowsProcessed).toBeGreaterThanOrEqual(0);
    });

    it("should handle failures gracefully", async () => {
      mockSql
        .mockResolvedValueOnce({ rows: [{ id: "job-1", status: "pending" }] })
        .mockRejectedValueOnce(new Error("Database error"));

      const result = await backfillWatchHistory(100);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Database error");
    });
  });

  describe("backfillSessionRetention", () => {
    it("should create retention curve entries", async () => {
      const sessionDuration = 3600;  // 1 hour

      mockSql
        .mockResolvedValueOnce({ rows: [{ id: "job-1", status: "pending" }] })
        .mockResolvedValueOnce({ rows: [] })  // startBackfillJob
        .mockResolvedValueOnce({
          rows: [{
            id: "session-1",
            started_at: new Date(),
            duration_seconds: sessionDuration,
          }],
        })  // find sessions
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: "viewer-1",
              joined_at: new Date(),
              left_at: new Date(Date.now() + 1800000),  // 30 min
            },
            {
              user_id: "viewer-2",
              joined_at: new Date(Date.now() + 300000),  // 5 min in
              left_at: new Date(Date.now() + 3600000),  // 60 min
            },
          ],
        })  // get viewer events
        .mockImplementation(() => Promise.resolve({ rows: [] }));  // all inserts

      const result = await backfillSessionRetention(100);

      expect(result.tableName).toBe("session_retention");
      expect(result.success).toBe(true);
    });

    it("should skip sessions with existing retention data", async () => {
      mockSql
        .mockResolvedValueOnce({ rows: [{ id: "job-1", status: "pending" }] })
        .mockResolvedValueOnce({ rows: [] })  // startBackfillJob
        .mockResolvedValueOnce({ rows: [] })  // no sessions to process
        .mockResolvedValueOnce({ rows: [] });  // completeBackfillJob

      const result = await backfillSessionRetention(100);

      expect(result.rowsProcessed).toBe(0);
    });
  });

  describe("backfillSessionChatEngagement", () => {
    it("should create chat engagement entries", async () => {
      mockSql
        .mockResolvedValueOnce({ rows: [{ id: "job-1", status: "pending" }] })
        .mockResolvedValueOnce({ rows: [] })  // startBackfillJob
        .mockResolvedValueOnce({
          rows: [{
            id: "session-1",
            started_at: new Date(),
            duration_seconds: 3600,
            total_messages: 50,
          }],
        })  // find sessions
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: "user-1",
              created_at: new Date(),
            },
            {
              user_id: "user-2",
              created_at: new Date(),
            },
          ],
        })  // get messages
        .mockImplementation(() => Promise.resolve({ rows: [{ viewer_count: 5 }] }));  // get viewer count

      const result = await backfillSessionChatEngagement(100);

      expect(result.tableName).toBe("session_chat_engagement");
      expect(result.success).toBe(true);
    });
  });

  describe("getBackfillStatus", () => {
    it("should return all backfill jobs", async () => {
      const mockJobs = [
        {
          id: "job-1",
          table_name: "watch_history",
          status: "completed",
          rows_backfilled: 100,
        },
        {
          id: "job-2",
          table_name: "session_retention",
          status: "in_progress",
          rows_backfilled: 50,
        },
      ];

      mockSql.mockResolvedValueOnce({ rows: mockJobs });

      const result = await getBackfillStatus();

      expect(result).toHaveLength(2);
      expect(result[0].table_name).toBe("watch_history");
      expect(result[1].status).toBe("in_progress");
    });
  });

  describe("idempotency", () => {
    it("should handle duplicate insertions gracefully", async () => {
      // Simulate duplicate unique constraint violation
      const duplicateError = new Error(
        "duplicate key value violates unique constraint"
      );

      mockSql
        .mockResolvedValueOnce({ rows: [{ id: "job-1", status: "pending" }] })
        .mockResolvedValueOnce({ rows: [] })  // startBackfillJob
        .mockResolvedValueOnce({
          rows: [{
            id: "session-1",
            creator_id: "creator-1",
            started_at: new Date(),
            title: "Test",
          }],
        })  // find sessions
        .mockResolvedValueOnce({
          rows: [{ user_id: "viewer-1", first_joined: new Date(), last_left: new Date() }],
        })  // get viewers
        .mockRejectedValueOnce(duplicateError)  // first insert fails (duplicate)
        .mockResolvedValueOnce({ rows: [] });  // completeBackfillJob

      const result = await backfillWatchHistory(100);

      expect(result.rowsSkipped).toBeGreaterThan(0);
    });
  });
});
