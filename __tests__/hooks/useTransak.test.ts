/**
 * useTransak against a stand-in for the Transak SDK (the external boundary):
 * every order event reaches the right callback, listeners are registered
 * once however many hook instances exist, and errors are reported.
 */
const mockListeners = new Map<string, (payload: unknown) => void>();
const mockOn = jest.fn((event: string, cb: (payload: unknown) => void) => {
  mockListeners.set(event, cb);
});
const mockInit = jest.fn();
const mockClose = jest.fn();
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
    cleanup = jest.fn();
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

it("registers the static listeners once and only notifies the instance that opened the widget", async () => {
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
  ).toHaveLength(1);
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
