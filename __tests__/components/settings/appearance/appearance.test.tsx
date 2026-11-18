/**
 * Tests for the appearance settings page: single Theme section, server-side
 * persistence through /api/users/preferences and hydration on reload.
 */

import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { SWRConfig } from "swr";
import { toast } from "sonner";
import ThemeSettingsPage from "@/components/settings/appearance/appearance";
import { ThemeProvider } from "@/contexts/theme-context";

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const basePreferences = {
  user_id: "user-1",
  stream_quality: "auto",
  notify_live: true,
  notify_clips: true,
  notify_tips: true,
  theme: "light",
  language: "en",
  chat_font_size: "medium",
  show_timestamps: false,
  updated_at: "2026-11-18T00:00:00.000Z",
};

function mockFetch({
  serverTheme = "light",
  patchOk = true,
}: { serverTheme?: string; patchOk?: boolean } = {}) {
  global.fetch = jest.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "PATCH") {
      if (!patchOk) {
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: "Internal server error" }),
        };
      }
      const patch = JSON.parse(String(init.body));
      return {
        ok: true,
        status: 200,
        json: async () => ({ preferences: { ...basePreferences, ...patch } }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        preferences: { ...basePreferences, theme: serverTheme },
      }),
    };
  }) as unknown as typeof fetch;
}

function patchCalls() {
  return (global.fetch as jest.Mock).mock.calls.filter(
    ([, init]) => init?.method === "PATCH"
  );
}

function renderPage() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <ThemeProvider>
        <ThemeSettingsPage />
      </ThemeProvider>
    </SWRConfig>
  );
}

// The radio buttons have no text of their own; the label is the sibling span.
function optionButton(label: string) {
  const button = screen.getByText(label).parentElement?.querySelector("button");
  if (!button) {
    throw new Error(`Option button for "${label}" not found`);
  }
  return button;
}

describe("Appearance settings", () => {
  let alertSpy: jest.SpyInstance;

  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("light", "dark");
    alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it("renders a single Theme section and no duplicate Display section", async () => {
    mockFetch();
    renderPage();

    expect(screen.getByText("Theme")).toBeInTheDocument();
    expect(screen.queryByText("Display")).not.toBeInTheDocument();
    expect(
      screen.getAllByText("Choose between light and dark interface themes")
    ).toHaveLength(1);
    expect(screen.getAllByText("Dark Mode")).toHaveLength(1);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  });

  it("hydrates the theme from the saved server preference on reload", async () => {
    // Local storage says light, the server says dark: the server wins.
    localStorage.setItem("streamfi-theme", "light");
    mockFetch({ serverTheme: "dark" });

    renderPage();

    await waitFor(() =>
      expect(document.documentElement.classList.contains("dark")).toBe(true)
    );
    expect(localStorage.getItem("streamfi-theme")).toBe("dark");
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/users/preferences",
      expect.objectContaining({ credentials: "include" })
    );
    expect(patchCalls()).toHaveLength(0);
  });

  it("persists the selected theme server side and shows a success toast", async () => {
    mockFetch({ serverTheme: "light" });
    renderPage();

    await waitFor(() =>
      expect(document.documentElement.classList.contains("light")).toBe(true)
    );

    fireEvent.click(optionButton("Dark Mode"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    });

    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    const calls = patchCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe("/api/users/preferences");
    expect(JSON.parse(String(calls[0][1].body))).toEqual({ theme: "dark" });
    expect(toast.error).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Save Changes" })
    ).not.toBeDisabled();
  });

  it("shows an error toast when saving fails", async () => {
    mockFetch({ serverTheme: "light", patchOk: false });
    renderPage();

    await waitFor(() =>
      expect(document.documentElement.classList.contains("light")).toBe(true)
    );

    fireEvent.click(optionButton("Dark Mode"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    });

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(toast.success).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Save Changes" })
    ).not.toBeDisabled();
  });

  it("does not let a late server response override a theme picked on the page", async () => {
    let resolveGet: (value: unknown) => void = () => {};
    global.fetch = jest.fn(
      (_url: string, init?: RequestInit) =>
        new Promise(resolve => {
          if (init?.method === "PATCH") {
            resolve({ ok: true, status: 200, json: async () => ({}) });
            return;
          }
          resolveGet = resolve;
        })
    ) as unknown as typeof fetch;

    renderPage();
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    fireEvent.click(optionButton("Dark Mode"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    await act(async () => {
      resolveGet({
        ok: true,
        status: 200,
        json: async () => ({
          preferences: { ...basePreferences, theme: "light" },
        }),
      });
    });

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("streamfi-theme")).toBe("dark");
  });
});
