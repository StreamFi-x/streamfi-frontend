/**
 * useTransak against a stand-in for the Transak SDK (the external boundary):
 * every order event reaches the right callback, listeners are registered
 * once per active widget however many hook instances exist, and errors are reported.
 */
const mockListeners = new Map<string, (payload: unknown) => void>();
const mockOn = jest.fn((event: string, cb: (payload: unknown) => void) => {
  mockListeners.set(event, cb);
});
const mockInit = jest.fn();
const mockClose = jest.fn();
const mockCleanup = jest.fn();
jest.mock("@transak/transak-sdk", () => {
  const EVENTS = {
    TRANSAK_ORDER_CREATED: "TRANSAK_ORDER_CREATED",
    TRANSAK_ORDER_SUCCESSFUL: "TRANSAK_ORDER_SUCCESSFUL",
    TRANSAK_ORDER_FAILED: "TRANSAK_ORDER_FAILED",
    TRANSAK_ORDER_CANCELLED: "TRANSAK_ORDER_CANCELLED",
    TRANSAK_WIDGET_CLOSE: "TRANSAK_WIDGET_CLOSE",
  };
  class Transak {
    static EVENTS = EVENTS;
    static on = mockOn;
    init = mockInit;
    close = mockClose;
    cleanup = mockCleanup;
  }
  return { Transak };
});

import { act, renderHook } from "@testing-library/react";
import { resetTransakListenersForTests, useTransak } from "@/hooks/useTransak";

const WALLET = `G${"WALLET".padEnd(55, "A")}`;
const order = { id: "order-1", cryptoAmount: 10, cryptoCurrency: "XLM" };

function emit(event: string, payload: unknown = { status: order }) {
  act(() => mockListeners.get(event)?.(payload));
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_TRANSAK_API_KEY = "sentinel-transak-key";
  resetTransakListenersForTests();
  mockListeners.clear();
  jest.clearAllMocks();
  mockClose.mockReset().mockImplementation(() => mockListeners.clear());
  mockInit.mockReset();
});

it("opens the widget and maps each Transak event to its callback", async () => {
  const callbacks = {
    onOrderCreated: jest.fn(),
    onSuccess: jest.fn(),
    onOrderFailed: jest.fn(),
    onOrderCancelled: jest.fn(),
    onClose: jest.fn(),
  };
  const { result } = renderHook(() =>
    useTransak({ walletAddress: WALLET, ...callbacks })
  );

  let opened = false;
  await act(async () => {
    opened = await result.current.openTransak();
  });
  expect(opened).toBe(true);
  expect(mockInit).toHaveBeenCalled();
  expect(result.current.isOpen).toBe(true);

  emit("TRANSAK_ORDER_CREATED");
  emit("TRANSAK_ORDER_SUCCESSFUL");
  emit("TRANSAK_ORDER_FAILED");
  emit("TRANSAK_ORDER_CANCELLED");
  expect(callbacks.onOrderCreated).toHaveBeenCalledWith(order);
  expect(callbacks.onSuccess).toHaveBeenCalledWith(order);
  expect(callbacks.onOrderFailed).toHaveBeenCalledWith(order);
  expect(callbacks.onOrderCancelled).toHaveBeenCalledWith(order);

  emit("TRANSAK_WIDGET_CLOSE", undefined);
  expect(callbacks.onClose).toHaveBeenCalledTimes(1);
  expect(result.current.isOpen).toBe(false);
});

it("re-registers after SDK close and only notifies the instance that opened the widget", async () => {
  const first = { onSuccess: jest.fn() };
  const second = { onSuccess: jest.fn() };
  const a = renderHook(() => useTransak({ walletAddress: WALLET, ...first }));
  const b = renderHook(() => useTransak({ walletAddress: WALLET, ...second }));

  await act(async () => {
    await a.result.current.openTransak();
  });
  emit("TRANSAK_WIDGET_CLOSE", undefined);
  await act(async () => {
    await b.result.current.openTransak();
  });
  emit("TRANSAK_ORDER_SUCCESSFUL");

  expect(
    mockOn.mock.calls.filter(([e]) => e === "TRANSAK_ORDER_SUCCESSFUL")
  ).toHaveLength(2);
  expect(first.onSuccess).not.toHaveBeenCalled();
  expect(second.onSuccess).toHaveBeenCalledTimes(1);
});

it("uses the latest callbacks, not the ones from the first render", async () => {
  const early = jest.fn();
  const late = jest.fn();
  const { result, rerender } = renderHook(
    ({ onSuccess }) => useTransak({ walletAddress: WALLET, onSuccess }),
    { initialProps: { onSuccess: early } }
  );
  await act(async () => {
    await result.current.openTransak();
  });
  rerender({ onSuccess: late });
  emit("TRANSAK_ORDER_SUCCESSFUL");
  expect(early).not.toHaveBeenCalled();
  expect(late).toHaveBeenCalledWith(order);
});

it("reports a missing configuration instead of failing silently", async () => {
  delete process.env.NEXT_PUBLIC_TRANSAK_API_KEY;
  const onError = jest.fn();
  const { result } = renderHook(() =>
    useTransak({ walletAddress: WALLET, onError })
  );
  let opened = true;
  await act(async () => {
    opened = await result.current.openTransak();
  });
  expect(opened).toBe(false);
  expect(onError).toHaveBeenCalledWith(expect.any(Error));
  expect(mockInit).not.toHaveBeenCalled();
});

it("reports a missing wallet address", async () => {
  const onError = jest.fn();
  const { result } = renderHook(() =>
    useTransak({ walletAddress: null, onError })
  );
  await act(async () => {
    await result.current.openTransak();
  });
  expect(onError).toHaveBeenCalled();
});

it("closes the widget through the SDK's close()", async () => {
  const onClose = jest.fn();
  const { result } = renderHook(() =>
    useTransak({ walletAddress: WALLET, onClose })
  );
  await act(async () => {
    await result.current.openTransak();
  });
  act(() => result.current.closeTransak());
  expect(mockClose).toHaveBeenCalled();
  expect(onClose).toHaveBeenCalled();
  expect(result.current.isOpen).toBe(false);
});

it("rejects competing and repeated opens without changing the callback owner", async () => {
  const first = jest.fn();
  const second = jest.fn();
  const error = jest.fn();
  const a = renderHook(() =>
    useTransak({ walletAddress: WALLET, onSuccess: first })
  );
  const b = renderHook(() =>
    useTransak({ walletAddress: WALLET, onSuccess: second, onError: error })
  );
  await act(async () => {
    const results = await Promise.all([
      a.result.current.openTransak(),
      b.result.current.openTransak(),
    ]);
    expect(results).toEqual([true, false]);
    expect(await a.result.current.openTransak()).toBe(false);
  });
  emit("TRANSAK_ORDER_SUCCESSFUL");
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).not.toHaveBeenCalled();
  expect(mockInit).toHaveBeenCalledTimes(1);
  expect(error).toHaveBeenCalledWith(expect.any(Error));
});

it("notifies close once when SDK close emits synchronously", async () => {
  mockClose.mockImplementationOnce(() =>
    mockListeners.get("TRANSAK_WIDGET_CLOSE")?.(null)
  );
  const onClose = jest.fn();
  const a = renderHook(() => useTransak({ walletAddress: WALLET, onClose }));
  await act(async () => {
    await a.result.current.openTransak();
  });
  act(() => a.result.current.closeTransak());
  emit("TRANSAK_WIDGET_CLOSE");
  expect(onClose).toHaveBeenCalledTimes(1);
});

it("cleans up the owner on unmount and lets another instance open", async () => {
  const onSuccess = jest.fn();
  const a = renderHook(() => useTransak({ walletAddress: WALLET, onSuccess }));
  await act(async () => {
    await a.result.current.openTransak();
  });
  a.unmount();
  expect(mockClose).toHaveBeenCalledTimes(1);
  emit("TRANSAK_ORDER_SUCCESSFUL");
  expect(onSuccess).not.toHaveBeenCalled();
  const b = renderHook(() => useTransak({ walletAddress: WALLET }));
  await act(async () => {
    expect(await b.result.current.openTransak()).toBe(true);
  });
});

it("does not initialize after unmount while loading the SDK", async () => {
  const a = renderHook(() => useTransak({ walletAddress: WALLET }));
  await act(async () => {
    const opening = a.result.current.openTransak();
    a.unmount();
    expect(await opening).toBe(false);
  });
  expect(mockInit).not.toHaveBeenCalled();
});

it("releases ownership and reports initialization failures", async () => {
  mockInit.mockImplementationOnce(() => {
    throw new Error("init failed");
  });
  const onError = jest.fn();
  const a = renderHook(() => useTransak({ walletAddress: WALLET, onError }));
  await act(async () => {
    expect(await a.result.current.openTransak()).toBe(false);
  });
  expect(onError).toHaveBeenCalledWith(new Error("init failed"));
  expect(mockClose).toHaveBeenCalled();
  await act(async () => {
    expect(await a.result.current.openTransak()).toBe(true);
  });
});
