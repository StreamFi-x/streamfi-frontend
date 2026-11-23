import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import {
  useUserPreferences,
  type UserPreferences,
} from "@/hooks/useUserPreferences";

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
    );
  };
}

describe("useUserPreferences", () => {
  let persisted: UserPreferences;

  beforeEach(() => {
    persisted = {
      user_id: "c0110000-0000-4000-8000-000000000001",
      stream_quality: "auto",
      theme: "dark",
      language: "en",
      chat_font_size: "medium",
      show_timestamps: false,
      updated_at: "",
    };

    Object.defineProperty(global, "fetch", {
      configurable: true,
      value: jest.fn(async (_input, init) => {
        if (init?.method === "PATCH") {
          persisted = { ...persisted, ...JSON.parse(String(init.body)) };
        }

        return new Response(JSON.stringify({ preferences: persisted }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    });
  });

  afterEach(() => {
    delete (global as { fetch?: typeof fetch }).fetch;
  });

  it("persists a language code and reloads the same preference", async () => {
    const first = renderHook(() => useUserPreferences(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => {
      expect(first.result.current.preferences?.language).toBe("en");
    });

    await act(async () => {
      await first.result.current.update({ language: "fr" });
    });
    expect(persisted.language).toBe("fr");
    first.unmount();

    const reloaded = renderHook(() => useUserPreferences(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => {
      expect(reloaded.result.current.preferences?.language).toBe("fr");
    });
  });
});
