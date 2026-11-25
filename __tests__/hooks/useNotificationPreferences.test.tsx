import { act, renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { getDefaultPreferences } from "@/lib/notifications/preferences";

function createWrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
    );
  };
}

describe("useNotificationPreferences", () => {
  const userId = "c0110000-0000-4000-8000-000000000001";
  let persisted = getDefaultPreferences(userId);

  beforeEach(() => {
    persisted = getDefaultPreferences(userId);
    Object.defineProperty(global, "fetch", {
      configurable: true,
      value: jest.fn(async (_input, init) => {
        if (init?.method === "PUT") {
          persisted = {
            ...persisted,
            ...JSON.parse(String(init.body)),
          };
        }

        return new Response(JSON.stringify(persisted), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    });
  });

  afterEach(() => {
    delete (global as { fetch?: typeof fetch }).fetch;
  });

  it("persists a partial update and reloads the stored value", async () => {
    const first = renderHook(() => useNotificationPreferences(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(first.result.current.preferences).not.toBeNull();
    });

    await act(async () => {
      await first.result.current.update({ notify_clip_created: false });
    });
    expect(persisted.notify_clip_created).toBe(false);
    first.unmount();

    const reloaded = renderHook(() => useNotificationPreferences(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => {
      expect(reloaded.result.current.preferences?.notify_clip_created).toBe(
        false
      );
    });
  });

  it("reverts the optimistic value when the server rejects an update", async () => {
    const fetchMock = global.fetch as jest.Mock;
    const initialFetch = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (input, init) => {
      if (init?.method === "PUT") {
        return new Response(JSON.stringify({ error: "save failed" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
      return initialFetch!(input, init);
    });

    const { result } = renderHook(() => useNotificationPreferences(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => {
      expect(result.current.preferences).not.toBeNull();
    });

    await act(async () => {
      await expect(
        result.current.update({ notify_live: false })
      ).rejects.toThrow("Request failed (500): save failed");
    });

    expect(result.current.preferences?.notify_live).toBe(true);
  });
});
