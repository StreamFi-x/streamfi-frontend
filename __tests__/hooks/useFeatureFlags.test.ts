/**
 * Tests for useFeatureFlags and emergency kill-switch fast path (#1714)
 */

import { renderHook } from "@testing-library/react";
import { useFeatureFlags, useKillSwitch } from "@/hooks/useFeatureFlags";
import useSWR from "swr";

jest.mock("swr");

describe("useFeatureFlags & useKillSwitch (#1714)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses conservative 60-second deduping interval for regular feature flags", () => {
    (useSWR as jest.Mock).mockReturnValue({
      data: { flags: { clips: true } },
      error: undefined,
      isLoading: false,
    });

    const { result } = renderHook(() => useFeatureFlags(["clips"]));

    expect(result.current.flags).toEqual({ clips: true });
    expect(useSWR).toHaveBeenCalledWith(
      "/api/feature-flags?keys=clips",
      expect.any(Function),
      expect.objectContaining({
        revalidateOnFocus: false,
        dedupingInterval: 60_000,
      })
    );
  });

  it("activates fast-path polling and revalidateOnFocus for emergency kill-switches", () => {
    (useSWR as jest.Mock).mockReturnValue({
      data: { flags: { killswitch_payments: false } },
      error: undefined,
      isLoading: false,
    });

    const { result } = renderHook(() =>
      useFeatureFlags(["killswitch_payments"], { isKillSwitch: true, refreshInterval: 4_000 })
    );

    expect(result.current.flags).toEqual({ killswitch_payments: false });
    expect(useSWR).toHaveBeenCalledWith(
      "/api/feature-flags?keys=killswitch_payments",
      expect.any(Function),
      expect.objectContaining({
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 3_000,
        refreshInterval: 4_000,
      })
    );
  });

  it("useKillSwitch convenience hook defaults to 5s rapid polling", () => {
    (useSWR as jest.Mock).mockReturnValue({
      data: { flags: { emergency_stop: true } },
      error: undefined,
      isLoading: false,
    });

    const { result } = renderHook(() => useKillSwitch(["emergency_stop"]));

    expect(result.current.flags).toEqual({ emergency_stop: true });
    expect(useSWR).toHaveBeenCalledWith(
      "/api/feature-flags?keys=emergency_stop",
      expect.any(Function),
      expect.objectContaining({
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 3_000,
        refreshInterval: 5_000,
      })
    );
  });
});
