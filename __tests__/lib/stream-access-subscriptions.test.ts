/**
 * @jest-environment node
 *
 * #726: subscription access reads subscriptions.expires_at (the schema the
 * migrations settle on), and a failed lookup is an error, never a silent denial.
 */
const mockSql = jest.fn();
jest.mock("@vercel/postgres", () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) =>
    mockSql(strings.join("?"), values),
}));

import { canAccessStream, SubscriptionCheckError } from "@/lib/stream-access";

const base = {
  privacy: "subscribers_only" as const,
  streamShareToken: null,
  providedToken: null,
  creatorUserId: "creator-1",
  viewerUserId: "viewer-1",
};

beforeEach(() => {
  mockSql.mockReset();
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

it("queries the canonical columns and allows an active subscriber", async () => {
  mockSql.mockResolvedValue({ rows: [{ "?column?": 1 }] });
  await expect(canAccessStream(base)).resolves.toEqual({
    allowed: true,
    reason: "subscription",
  });
  const [text, values] = mockSql.mock.calls[0];
  expect(text).toContain("expires_at > NOW()");
  expect(text).toContain("creator_id");
  expect(text).not.toContain("current_period_end");
  expect(text).not.toContain("streamer_id");
  expect(values).toEqual(["viewer-1", "creator-1"]);
});

it("denies a viewer with no active subscription", async () => {
  mockSql.mockResolvedValue({ rows: [] });
  await expect(canAccessStream(base)).resolves.toEqual({
    allowed: false,
    reason: "needs_subscription",
  });
});

it("throws, instead of denying, when the lookup fails (e.g. missing column)", async () => {
  mockSql.mockRejectedValue(
    Object.assign(new Error('column "expires_at" does not exist'), {
      code: "42703",
    })
  );
  await expect(canAccessStream(base)).rejects.toBeInstanceOf(
    SubscriptionCheckError
  );
  expect(console.error).toHaveBeenCalled();
});

it("does not touch the database for public streams or the owner", async () => {
  await canAccessStream({ ...base, privacy: "public" as never });
  await canAccessStream({ ...base, viewerUserId: "creator-1" });
  expect(mockSql).not.toHaveBeenCalled();
});
