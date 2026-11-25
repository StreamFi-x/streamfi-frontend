import { renderHook } from "@testing-library/react";
import useSWR from "swr";
import { KILL_SWITCH_FLAG_KEYS, useFeatureFlags } from "@/hooks/useFeatureFlags";

jest.mock("swr");

const mockedUseSWR = useSWR as jest.Mock;

describe("useFeatureFlags", () => {
  beforeEach(() => {
    mockedUseSWR.mockReset();
    mockedUseSWR.mockReturnValue({
      data: { flags: { clips: true } },
      error: undefined,
      isLoading: false,
    });
  });

  it("returns resolved flags from the SWR response", () => {
    const { result } = renderHook(() => useFeatureFlags(["clips"]));
    expect(result.current.flags).toEqual({ clips: true });
    expect(result.current.isLoading).toBe(false);
  });

  it("defaults to an empty flags object when data has not loaded yet", () => {
    mockedUseSWR.mockReturnValue({ data: undefined, error: undefined, isLoading: true });
    const { result } = renderHook(() => useFeatureFlags(["clips"]));
    expect(result.current.flags).toEqual({});
    expect(result.current.isLoading).toBe(true);
  });

  it("uses the slow 60s dedupe window and no focus revalidation for regular flags (#1714)", () => {
    renderHook(() => useFeatureFlags(["clips", "gifts"]));

    const [, , options] = mockedUseSWR.mock.calls[0];
    expect(options).toMatchObject({ revalidateOnFocus: false, dedupingInterval: 60_000 });
    expect(options.refreshInterval).toBeUndefined();
  });

  it("switches to a fast poll/dedupe window when a requested key is a kill-switch flag (#1714)", () => {
    // Register a kill-switch key for this test only, then restore it, so
    // this test doesn't depend on any key actually being registered yet.
    const testKillSwitchKey = "__test_kill_switch__";
    (KILL_SWITCH_FLAG_KEYS as Set<string>).add(testKillSwitchKey);
    try {
      renderHook(() => useFeatureFlags([testKillSwitchKey]));

      const [, , options] = mockedUseSWR.mock.calls[0];
      expect(options).toMatchObject({
        revalidateOnFocus: true,
        dedupingInterval: 5_000,
        refreshInterval: 5_000,
      });
    } finally {
      (KILL_SWITCH_FLAG_KEYS as Set<string>).delete(testKillSwitchKey);
    }
  });

  it("does not switch to the fast window when no requested key is a kill-switch flag", () => {
    renderHook(() => useFeatureFlags(["some_regular_flag"]));

    const [, , options] = mockedUseSWR.mock.calls[0];
    expect(options.dedupingInterval).toBe(60_000);
  });
});
