import { renderHook, act } from "@testing-library/react";
import {
  useTypingIndicator,
  TYPING_BACKOFF_MS,
} from "../useTypingIndicator";
import {
  TYPING_EMIT_INTERVAL_MS,
  TYPING_EXPIRY_MS,
  TYPING_IDLE_MS,
  TYPING_STOP_GRACE_MS,
} from "@/lib/chat-typing";

let pushHandler: ((msg: unknown) => void) | undefined;
let pushChannel: string | null | undefined;
jest.mock("@/hooks/useRealtime", () => ({
  useRealtimeChannel: (
    channel: string | null,
    onMessage?: (m: unknown) => void
  ) => {
    pushChannel = channel;
    pushHandler = onMessage;
    return { connectionState: "connected", reconnect: jest.fn() };
  },
}));

const fetchMock = jest.fn();

const typingMsg = (wallet: string, username: string, state = "typing") => ({
  event: "chat:typing",
  data: { state, wallet, username },
});

const sentStates = () =>
  fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).state);

const setup = (enabled = true) =>
  renderHook(() =>
    useTypingIndicator({ playbackId: "pb1", wallet: "0xME", enabled })
  );

beforeEach(() => {
  jest.useFakeTimers();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    status: 202,
    json: async () => ({ broadcast: true }),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  pushHandler = undefined;
  pushChannel = undefined;
});

afterEach(() => {
  jest.useRealTimers();
});

describe("outgoing events", () => {
  it("posts to the typing endpoint, not the chat endpoint", () => {
    const { result } = setup();
    act(() => result.current.onInputChange("h"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/streams/chat/typing");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      playbackId: "pb1",
      state: "typing",
    });
  });

  it("throttles keystrokes to one event per interval", () => {
    const { result } = setup();
    act(() => {
      for (const v of ["h", "he", "hel", "hell", "hello"]) {
        result.current.onInputChange(v);
      }
    });
    expect(sentStates()).toEqual(["typing"]);

    act(() => {
      jest.advanceTimersByTime(TYPING_EMIT_INTERVAL_MS);
      result.current.onInputChange("hello!");
    });
    expect(sentStates()).toEqual(["typing", "typing"]);
  });

  it("sends 'stopped' after the idle timeout", () => {
    const { result } = setup();
    act(() => result.current.onInputChange("h"));
    act(() => {
      jest.advanceTimersByTime(TYPING_IDLE_MS);
    });
    expect(sentStates()).toEqual(["typing", "stopped"]);
  });

  it("each keystroke postpones the idle 'stopped'", () => {
    const { result } = setup();
    act(() => result.current.onInputChange("h"));
    act(() => {
      jest.advanceTimersByTime(1500);
      result.current.onInputChange("he");
      jest.advanceTimersByTime(1500);
    });
    expect(sentStates()).toEqual(["typing"]);
  });

  it("sends 'stopped' immediately when the input is cleared", () => {
    const { result } = setup();
    act(() => result.current.onInputChange("h"));
    act(() => result.current.onInputChange(""));
    expect(sentStates()).toEqual(["typing", "stopped"]);
  });

  it("does not send 'stopped' when nothing was typed", () => {
    const { result } = setup();
    act(() => result.current.onInputChange("   "));
    act(() => result.current.onMessageSent());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends 'stopped' once when the message is submitted, and restarts at once after", () => {
    const { result } = setup();
    act(() => result.current.onInputChange("hi"));
    act(() => result.current.onMessageSent());
    expect(sentStates()).toEqual(["typing", "stopped"]);

    act(() => result.current.onInputChange("next"));
    expect(sentStates()).toEqual(["typing", "stopped", "typing"]);
  });

  it("sends nothing when disabled", () => {
    const { result } = setup(false);
    act(() => result.current.onInputChange("hi"));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(pushChannel).toBeNull();
  });

  it("goes quiet after the server suppresses typing", async () => {
    fetchMock.mockResolvedValue({
      status: 202,
      json: async () => ({ broadcast: false, reason: "viewer-cutoff" }),
    });
    const { result } = setup();
    await act(async () => {
      result.current.onInputChange("h");
    });
    await act(async () => {
      jest.advanceTimersByTime(TYPING_EMIT_INTERVAL_MS);
    });
    act(() => result.current.onInputChange("he"));
    expect(sentStates()).toEqual(["typing"]);

    act(() => {
      jest.advanceTimersByTime(TYPING_BACKOFF_MS);
      result.current.onInputChange("hey");
    });
    expect(sentStates().filter(s => s === "typing")).toHaveLength(2);
  });

  it("goes quiet after a 429", async () => {
    fetchMock.mockResolvedValue({ status: 429, json: async () => ({}) });
    const { result } = setup();
    await act(async () => {
      result.current.onInputChange("h");
    });
    act(() => {
      jest.advanceTimersByTime(TYPING_EMIT_INTERVAL_MS);
      result.current.onInputChange("he");
    });
    expect(sentStates()).toEqual(["typing"]);
  });

  it("swallows network failures", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const { result } = setup();
    await act(async () => {
      result.current.onInputChange("h");
    });
    expect(result.current.typingLabel).toBeNull();
  });
});

describe("incoming events", () => {
  it("subscribes to the ephemeral typing channel", () => {
    setup();
    expect(pushChannel).toBe("stream:pb1:typing");
  });

  it("shows one typist", () => {
    const { result } = setup();
    act(() => pushHandler!(typingMsg("0xA", "Alice")));
    expect(result.current.typingLabel).toBe("Alice is typing…");
  });

  it("aggregates several typists", () => {
    const { result } = setup();
    act(() => {
      pushHandler!(typingMsg("0xA", "Alice"));
      pushHandler!(typingMsg("0xB", "Bob"));
    });
    expect(result.current.typingLabel).toBe("Alice and Bob are typing…");

    act(() => pushHandler!(typingMsg("0xC", "Cara")));
    expect(result.current.typingLabel).toBe("3 people are typing…");
  });

  it("counts a repeated typist once", () => {
    const { result } = setup();
    act(() => {
      pushHandler!(typingMsg("0xA", "Alice"));
      pushHandler!(typingMsg("0xa", "Alice"));
    });
    expect(result.current.typingLabel).toBe("Alice is typing…");
  });

  it("never shows the viewer their own indicator", () => {
    const { result } = setup();
    act(() => pushHandler!(typingMsg("0xme", "Me")));
    expect(result.current.typingLabel).toBeNull();
  });

  it("expires a typist with no update and no 'stopped' event", () => {
    const { result } = setup();
    act(() => pushHandler!(typingMsg("0xA", "Alice")));
    expect(result.current.typingLabel).not.toBeNull();

    act(() => {
      jest.advanceTimersByTime(TYPING_EXPIRY_MS + 10);
    });
    expect(result.current.typingLabel).toBeNull();
  });

  it("clears an explicit 'stopped' only after the grace period", () => {
    const { result } = setup();
    act(() => pushHandler!(typingMsg("0xA", "Alice")));
    act(() => pushHandler!(typingMsg("0xA", "Alice", "stopped")));
    expect(result.current.typingLabel).toBe("Alice is typing…");

    act(() => {
      jest.advanceTimersByTime(TYPING_STOP_GRACE_MS + 10);
    });
    expect(result.current.typingLabel).toBeNull();
  });

  it("does not flicker when a typist stops and restarts inside the grace period", () => {
    const { result } = setup();
    act(() => pushHandler!(typingMsg("0xA", "Alice")));
    act(() => pushHandler!(typingMsg("0xA", "Alice", "stopped")));
    act(() => {
      jest.advanceTimersByTime(TYPING_STOP_GRACE_MS / 2);
    });
    act(() => pushHandler!(typingMsg("0xA", "Alice")));
    act(() => {
      jest.advanceTimersByTime(TYPING_STOP_GRACE_MS * 2);
    });
    expect(result.current.typingLabel).toBe("Alice is typing…");
  });

  it("ignores unrelated events and malformed payloads", () => {
    const { result } = setup();
    act(() => {
      pushHandler!({ event: "chat:message", data: { wallet: "0xA" } });
      pushHandler!({ event: "chat:typing" });
      pushHandler!({ event: "chat:typing", data: { state: "typing" } });
    });
    expect(result.current.typingLabel).toBeNull();
  });

  it("drops indicators when typing becomes disabled", () => {
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useTypingIndicator({ playbackId: "pb1", wallet: "0xME", enabled }),
      { initialProps: { enabled: true } }
    );
    act(() => pushHandler!(typingMsg("0xA", "Alice")));
    expect(result.current.typingLabel).not.toBeNull();

    rerender({ enabled: false });
    expect(result.current.typingLabel).toBeNull();
  });
});
