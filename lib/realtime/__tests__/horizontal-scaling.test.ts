import {
  publishRealtimeMessage,
  subscribeLocal,
  resetRealtimeForTests,
} from "../pubsub";
import {
  ConnectionManager,
  CapacityConfig,
} from "../connection-manager";

describe("Realtime Horizontal Scaling & Cross-Instance Delivery (#1135)", () => {
  beforeEach(() => {
    resetRealtimeForTests();
  });

  it("ensures message delivery between viewers connected across multiple instances", async () => {
    const channel = "stream:stream-cross-instance:chat";
    const instance1Messages: any[] = [];
    const instance2Messages: any[] = [];

    // Viewer on instance 1 subscribes
    const unsubInstance1 = subscribeLocal(channel, (msg) => {
      instance1Messages.push(msg);
    });

    // Viewer on instance 2 subscribes to the same channel
    const unsubInstance2 = subscribeLocal(channel, (msg) => {
      instance2Messages.push(msg);
    });

    // Viewer on instance 1 broadcasts message
    const published = await publishRealtimeMessage(channel, "chat:message", {
      sender: "Alice",
      text: "Cross-instance greeting",
    });

    expect(instance1Messages).toHaveLength(1);
    expect(instance2Messages).toHaveLength(1);
    expect(instance1Messages[0].data.text).toBe("Cross-instance greeting");
    expect(instance2Messages[0].data.text).toBe("Cross-instance greeting");
    expect(instance1Messages[0].seq).toBe(published.seq);
    expect(instance2Messages[0].seq).toBe(published.seq);

    unsubInstance1();
    unsubInstance2();
  });

  it("handles graceful connection draining during rolling deployment", () => {
    const config: CapacityConfig = {
      instanceId: "worker-node-1",
      maxConnections: 500,
      warningThreshold: 80,
      shedThreshold: 90,
      shedStrategy: "shed_least_active",
      gracefulShutdownWindow: 2000,
    };

    const manager = new ConnectionManager(config);
    manager.addConnection("conn-1", "user-1");
    manager.addConnection("conn-2", "user-2");

    expect(manager.getMetrics().activeConnections).toBe(2);

    // Start graceful shutdown
    manager.startGracefulShutdown();

    // New connections should be rejected during draining
    const allowed = manager.addConnection("conn-3", "user-3");
    expect(allowed).toBe(false);
  });
});
