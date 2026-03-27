import { evaluateBadgeIds } from "@/lib/routes-f/badges";

describe("evaluateBadgeIds", () => {
  it("awards badges when thresholds are met", () => {
    const badges = evaluateBadgeIds(
      {
        totalStreams: 1,
        totalTipCount: 1,
        totalGiftCount: 1,
        followerCount: 1000,
        totalStreamedSeconds: 100 * 60 * 60,
        totalEarningsUsdc: 1200,
      },
      new Set(["first_tip"])
    );

    expect(badges).toEqual([
      "first_stream",
      "first_gift",
      "hundred_followers",
      "thousand_followers",
      "ten_hours_streamed",
      "hundred_hours_streamed",
      "top_earner",
    ]);
  });

  it("returns an empty list when nothing new qualifies", () => {
    const badges = evaluateBadgeIds(
      {
        totalStreams: 0,
        totalTipCount: 0,
        totalGiftCount: 0,
        followerCount: 5,
        totalStreamedSeconds: 60,
        totalEarningsUsdc: 5,
      },
      new Set()
    );

    expect(badges).toEqual([]);
  });
});
