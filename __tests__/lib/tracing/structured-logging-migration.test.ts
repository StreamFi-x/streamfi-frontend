/**
 * @jest-environment node
 */
// Tests verifying structured logger migration across server utilities (#1956 follow-up).

import { logger } from "@/lib/tracing/logger";

jest.mock("@/lib/tracing/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockRedis = { set: jest.fn(), eval: jest.fn() };
jest.mock("@/lib/upstash-redis", () => ({
  getUpstashRedis: () => mockRedis,
}));

jest.mock("@/utils/upload/cloudinary", () => ({
  deleteImage: jest.fn().mockRejectedValue(new Error("Cloudinary timeout")),
  extractPublicIdFromUrl: jest.fn(url => "sample_public_id"),
}));

import { acquireLock, resetMemoryLocksForTests } from "@/lib/single-flight-lock";
import { createImageCleanup } from "@/lib/users/image-cleanup";

describe("Structured Logger Migration across Infrastructure Modules", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMemoryLocksForTests();
  });

  describe("single-flight-lock", () => {
    it("emits structured logger.error when Redis acquire throws", async () => {
      mockRedis.set.mockRejectedValueOnce(new Error("Redis cluster unreachable"));

      const handle = await acquireLock("test-subject", { ttlMs: 5000 });
      expect(handle).not.toBeNull(); // fallback succeeded

      expect(logger.error).toHaveBeenCalledWith(
        "Redis acquire failed",
        expect.any(Error),
        expect.objectContaining({
          module: "single-flight-lock",
          key: "lock:test-subject",
        })
      );
    });

    it("emits structured logger.error when Redis release throws", async () => {
      mockRedis.set.mockResolvedValueOnce("OK");
      mockRedis.eval.mockRejectedValueOnce(new Error("Eval connection reset"));

      const handle = await acquireLock("test-subject", { ttlMs: 5000 });
      expect(handle).not.toBeNull();

      await handle!.release();

      expect(logger.error).toHaveBeenCalledWith(
        "Redis release failed",
        expect.any(Error),
        expect.objectContaining({
          module: "single-flight-lock",
          key: "lock:test-subject",
        })
      );
    });
  });

  describe("image-cleanup", () => {
    it("emits structured logger.error when Cloudinary delete fails", async () => {
      const cleanup = createImageCleanup();
      cleanup.trackReplaced("https://res.cloudinary.com/demo/image/upload/sample.jpg");

      await cleanup.commit();

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to delete replaced Cloudinary image",
        expect.any(Error),
        expect.objectContaining({
          module: "users/image-cleanup",
          operation: "destroy",
          publicId: "sample_public_id",
          reason: "replaced",
        })
      );
    });
  });
});
