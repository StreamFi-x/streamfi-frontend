import {
  fundingReducer,
  initialFundingMachine,
  showsEntryPoint,
  type FundingEvent,
  type FundingMachine,
} from "@/lib/onboarding/funding-machine";

function run(events: FundingEvent[], from = initialFundingMachine) {
  return events.reduce(fundingReducer, from);
}

const unfunded: FundingEvent = {
  type: "STATUS",
  eligible: true,
  funded: false,
  deferred: false,
};
const funded: FundingEvent = {
  type: "STATUS",
  eligible: false,
  funded: true,
  deferred: false,
};
const openIntro: FundingEvent[] = [unfunded, { type: "OPEN" }];
const toFunding: FundingEvent[] = [
  ...openIntro,
  { type: "NEXT" },
  { type: "NEXT" },
  { type: "START_FUNDING" },
];
const created: FundingEvent = {
  type: "ORDER_CREATED",
  orderId: "o1",
  at: 1000,
};
const successful: FundingEvent = {
  type: "ORDER_SUCCESSFUL",
  orderId: "o1",
  at: 2000,
};

describe("eligibility", () => {
  it("a never-funded custodial wallet is eligible", () => {
    expect(run([unfunded]).state).toBe("eligible");
  });

  it("a funded wallet (first load) is not targeted", () => {
    const m = run([funded]);
    expect(m.state).toBe("not_applicable");
    expect(showsEntryPoint(m)).toBe(false);
  });

  it("a non-custodial or wallet-less user is not targeted", () => {
    const m = run([
      { type: "STATUS", eligible: false, funded: false, deferred: false },
    ]);
    expect(m.state).toBe("not_applicable");
    expect(run([{ type: "OPEN" }], m).open).toBe(false);
  });

  it("a user who deferred earlier starts deferred but keeps the entry point", () => {
    const m = run([{ ...unfunded, deferred: true } as FundingEvent]);
    expect(m.state).toBe("deferred");
    expect(m.open).toBe(false);
    expect(showsEntryPoint(m)).toBe(true);
  });

  it("restores a pending purchase after a reload without reopening the dialog", () => {
    const m = run([
      {
        ...unfunded,
        pendingOrder: { orderId: "o9", since: 5 },
      } as FundingEvent,
    ]);
    expect(m).toMatchObject({
      state: "pending",
      open: false,
      orderId: "o9",
      pendingSince: 5,
    });
  });

  it("repeated status polls do not reset the flow", () => {
    const m = run([...toFunding, created, unfunded, unfunded]);
    expect(m.state).toBe("pending");
  });
});

describe("intro", () => {
  it("walks through the explanation steps and back", () => {
    let m = run(openIntro);
    expect(m).toMatchObject({ state: "intro", open: true, introStep: 0 });
    m = run([{ type: "BACK" }], m);
    expect(m.introStep).toBe(0);
    m = run([{ type: "NEXT" }, { type: "NEXT" }, { type: "NEXT" }], m);
    expect(m.introStep).toBe(2);
    m = run([{ type: "BACK" }], m);
    expect(m.introStep).toBe(1);
  });

  it("closing the intro defers it", () => {
    const m = run([...openIntro, { type: "CLOSE" }]);
    expect(m).toMatchObject({ state: "deferred", open: false });
  });

  it("'maybe later' defers, and the entry point reopens the intro", () => {
    let m = run([...openIntro, { type: "DEFER" }]);
    expect(m).toMatchObject({ state: "deferred", open: false });
    m = run([{ type: "OPEN" }], m);
    expect(m).toMatchObject({ state: "intro", open: true, introStep: 0 });
  });
});

describe("Transak outcomes", () => {
  it("an order Transak reports successful is pending, never success", () => {
    const m = run([...toFunding, successful]);
    expect(m.state).toBe("pending");
    expect(m.orderId).toBe("o1");
  });

  it("created then successful stays pending with the first timestamp", () => {
    const m = run([...toFunding, created, successful]);
    expect(m).toMatchObject({ state: "pending", pendingSince: 1000 });
  });

  it("closing the widget after paying keeps the purchase pending", () => {
    const m = run([...toFunding, created, { type: "WIDGET_CLOSED" }]);
    expect(m.state).toBe("pending");
    expect(m.open).toBe(true);
  });

  it("closing the widget before any order is abandoned, not failed", () => {
    const m = run([...toFunding, { type: "WIDGET_CLOSED" }]);
    expect(m).toMatchObject({ state: "abandoned", open: true });
  });

  it("a cancelled order is abandoned", () => {
    const m = run([...toFunding, { type: "ORDER_CANCELLED" }]);
    expect(m.state).toBe("abandoned");
  });

  it("a failed order is failed, from funding or from pending", () => {
    expect(run([...toFunding, { type: "ORDER_FAILED" }]).state).toBe("failed");
    expect(
      run([...toFunding, created, { type: "ORDER_FAILED" }])
    ).toMatchObject({ state: "failed", orderId: null, pendingSince: null });
  });

  it("Transak that cannot be opened is reported as unavailable", () => {
    const m = run([...toFunding, { type: "TRANSAK_UNAVAILABLE" }]);
    expect(m).toMatchObject({ state: "failed", unavailable: true });
  });

  it("abandoned and failed flows can be resumed", () => {
    for (const end of [
      { type: "WIDGET_CLOSED" },
      { type: "ORDER_FAILED" },
    ] as FundingEvent[]) {
      const m = run([...toFunding, end, { type: "START_FUNDING" }]);
      expect(m.state).toBe("funding");
    }
  });

  it("stray widget events outside a purchase change nothing", () => {
    const intro = run(openIntro);
    for (const event of [
      successful,
      created,
      { type: "ORDER_FAILED" },
      { type: "WIDGET_CLOSED" },
    ] as FundingEvent[]) {
      expect(run([event], intro)).toEqual(intro);
    }
  });
});

describe("pending and success", () => {
  const pending = run([...toFunding, created]);

  it("refuses to start a second purchase while one is pending", () => {
    expect(run([{ type: "START_FUNDING" }], pending)).toEqual(pending);
  });

  it("allows retrying only once the pending purchase is stalled", () => {
    const stalled = run([{ type: "PENDING_STALLED" }], pending);
    expect(stalled.stalled).toBe(true);
    expect(run([{ type: "START_FUNDING" }], stalled).state).toBe("funding");
  });

  it("succeeds only when the wallet balance confirms the funds", () => {
    expect(run([unfunded], pending).state).toBe("pending");
    const m = run([funded], pending);
    expect(m).toMatchObject({ state: "success", open: true });
    expect(showsEntryPoint(m)).toBe(false);
  });

  it("funds arriving from elsewhere also complete the onboarding", () => {
    expect(
      run([{ ...unfunded, deferred: true } as FundingEvent, funded]).state
    ).toBe("success");
  });

  it("closing the success message ends the onboarding", () => {
    const m: FundingMachine = run([{ type: "CLOSE" }], run([funded], pending));
    expect(m).toMatchObject({ state: "not_applicable", open: false });
  });
});
