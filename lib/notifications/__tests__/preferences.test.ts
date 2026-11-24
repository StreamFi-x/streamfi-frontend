import {
  getDefaultPreferences,
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/notifications/preferences";

describe("notification preference persistence", () => {
  const userId = "c0110000-0000-4000-8000-000000000001";

  it("includes the clip-created preference in defaults", () => {
    expect(getDefaultPreferences(userId).notify_clip_created).toBe(true);
  });

  it("binds partial update values to the matching columns", async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        { user_id: userId, notify_live: false, notify_clip_created: false },
      ],
    });
    const executor = { query, sql: jest.fn() } as unknown as Parameters<
      typeof updateNotificationPreferences
    >[2];

    const result = await updateNotificationPreferences(
      userId,
      { notify_live: false, notify_clip_created: false },
      executor
    );

    expect(result.notify_live).toBe(false);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        "ON CONFLICT (user_id) DO UPDATE SET\n      notify_live = EXCLUDED.notify_live, notify_clip_created = EXCLUDED.notify_clip_created"
      ),
      [userId, false, false]
    );
  });

  it("propagates database failures for callers to report", async () => {
    const sql = jest.fn().mockRejectedValue(new Error("database unavailable"));
    const executor = { sql } as Parameters<
      typeof getNotificationPreferences
    >[1];

    await expect(getNotificationPreferences(userId, executor)).rejects.toThrow(
      "database unavailable"
    );
  });
});
