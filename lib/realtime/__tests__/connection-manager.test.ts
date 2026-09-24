import {
  ConnectionManager,
  CapacityConfig,
  Connection,
  ShedDecision,
} from '../connection-manager';

describe('ConnectionManager', () => {
  let manager: ConnectionManager;
  const defaultConfig: CapacityConfig = {
    instanceId: 'test-instance',
    maxConnections: 1000,
    warningThreshold: 80,
    shedThreshold: 95,
    shedStrategy: 'shed_least_active',
    gracefulShutdownWindow: 5000,
  };

  beforeEach(() => {
    manager = new ConnectionManager(defaultConfig);
  });

  describe('Connection Tracking', () => {
    it('adds a new connection successfully', () => {
      const added = manager.addConnection('conn-1', 'user-1');
      expect(added).toBe(true);
      expect(manager.getConnection('conn-1')).toBeDefined();

      const metrics = manager.getMetrics();
      expect(metrics.activeConnections).toBe(1);
      expect(metrics.totalConnections).toBe(1);
    });

    it('rejects connection when at shed threshold', () => {
      const config = { ...defaultConfig, maxConnections: 10, shedThreshold: 80 };
      const testManager = new ConnectionManager(config);

      // Add 8 connections (80% = at threshold)
      for (let i = 0; i < 8; i++) {
        testManager.addConnection(`conn-${i}`, `user-${i}`);
      }

      // 9th connection should be rejected
      const added = testManager.addConnection('conn-8', 'user-8');
      expect(added).toBe(false);

      const metrics = testManager.getMetrics();
      expect(metrics.rejectedConnections).toBe(1);
    });

    it('removes a connection successfully', () => {
      manager.addConnection('conn-1', 'user-1');
      expect(manager.getConnection('conn-1')).toBeDefined();

      const removed = manager.removeConnection('conn-1');
      expect(removed).toBe(true);
      expect(manager.getConnection('conn-1')).toBeUndefined();

      const metrics = manager.getMetrics();
      expect(metrics.activeConnections).toBe(0);
    });

    it('tracks peak connections', () => {
      for (let i = 0; i < 50; i++) {
        manager.addConnection(`conn-${i}`);
      }

      let metrics = manager.getMetrics();
      expect(metrics.peakConnections).toBe(50);

      // Remove 10, then re-add 20
      for (let i = 0; i < 10; i++) {
        manager.removeConnection(`conn-${i}`);
      }

      for (let i = 50; i < 70; i++) {
        manager.addConnection(`conn-${i}`);
      }

      metrics = manager.getMetrics();
      expect(metrics.peakConnections).toBe(60);
    });
  });

  describe('Channel Subscriptions', () => {
    it('subscribes connection to channel', () => {
      manager.addConnection('conn-1', 'user-1');
      const subscribed = manager.subscribeToChannel('conn-1', 'channel-1');

      expect(subscribed).toBe(true);

      const conn = manager.getConnection('conn-1');
      expect(conn?.channels.has('channel-1')).toBe(true);
    });

    it('gets all subscribers of a channel', () => {
      manager.addConnection('conn-1', 'user-1');
      manager.addConnection('conn-2', 'user-2');
      manager.addConnection('conn-3', 'user-3');

      manager.subscribeToChannel('conn-1', 'news');
      manager.subscribeToChannel('conn-2', 'news');
      manager.subscribeToChannel('conn-3', 'sports');

      const newsSubscribers = manager.getChannelSubscribers('news');
      expect(newsSubscribers).toHaveLength(2);
      expect(newsSubscribers.map(s => s.connectionId)).toContain('conn-1');
      expect(newsSubscribers.map(s => s.connectionId)).toContain('conn-2');
    });

    it('unsubscribes connection from channel', () => {
      manager.addConnection('conn-1', 'user-1');
      manager.subscribeToChannel('conn-1', 'channel-1');

      const unsubscribed = manager.unsubscribeFromChannel('conn-1', 'channel-1');
      expect(unsubscribed).toBe(true);

      const conn = manager.getConnection('conn-1');
      expect(conn?.channels.has('channel-1')).toBe(false);
    });
  });

  describe('Activity Tracking', () => {
    it('updates connection activity', () => {
      manager.addConnection('conn-1', 'user-1');

      const updated = manager.updateActivity('conn-1', 1024);
      expect(updated).toBe(true);

      const conn = manager.getConnection('conn-1');
      expect(conn?.messageCount).toBe(1);
      expect(conn?.dataTransferred).toBe(1024);
    });

    it('accumulates data transferred across updates', () => {
      manager.addConnection('conn-1');

      manager.updateActivity('conn-1', 1024);
      manager.updateActivity('conn-1', 2048);
      manager.updateActivity('conn-1', 4096);

      const conn = manager.getConnection('conn-1');
      expect(conn?.messageCount).toBe(3);
      expect(conn?.dataTransferred).toBe(7168);
    });
  });

  describe('Capacity Monitoring', () => {
    it('detects warning threshold', () => {
      const config = { ...defaultConfig, maxConnections: 100, warningThreshold: 80 };
      const testManager = new ConnectionManager(config);

      for (let i = 0; i < 79; i++) {
        testManager.addConnection(`conn-${i}`);
      }

      expect(testManager.isCapacityWarning()).toBe(false);

      testManager.addConnection('conn-80');
      expect(testManager.isCapacityWarning()).toBe(true);
    });

    it('detects at-capacity threshold', () => {
      const config = { ...defaultConfig, maxConnections: 100, shedThreshold: 95 };
      const testManager = new ConnectionManager(config);

      for (let i = 0; i < 94; i++) {
        testManager.addConnection(`conn-${i}`);
      }

      expect(testManager.isAtCapacityLimit()).toBe(false);

      // 95th connection should be rejected
      const result = testManager.addConnection('conn-95');
      expect(result).toBe(false);
      expect(testManager.isAtCapacityLimit()).toBe(true);
    });

    it('calculates load percentage', () => {
      const config = { ...defaultConfig, maxConnections: 1000 };
      const testManager = new ConnectionManager(config);

      for (let i = 0; i < 250; i++) {
        testManager.addConnection(`conn-${i}`);
      }

      const load = testManager.getLoadPercentage();
      expect(load).toBe(25);
    });
  });

  describe('Connection Shedding', () => {
    it('sheds least active connections when using least_active strategy', () => {
      const config = { ...defaultConfig, shedStrategy: 'shed_least_active' };
      const testManager = new ConnectionManager(config);

      testManager.addConnection('conn-1');
      testManager.addConnection('conn-2');
      testManager.addConnection('conn-3');

      // Simulate activity on conn-2 and conn-3
      testManager.updateActivity('conn-2');
      testManager.updateActivity('conn-3');

      const toShed = testManager.getConnectionsToShed(1);
      expect(toShed[0].connectionId).toBe('conn-1'); // Least active
    });

    it('sheds oldest connections when using shed_oldest strategy', () => {
      const config = { ...defaultConfig, shedStrategy: 'shed_oldest' };
      const testManager = new ConnectionManager(config);

      testManager.addConnection('conn-1');
      testManager.addConnection('conn-2');
      testManager.addConnection('conn-3');

      const toShed = testManager.getConnectionsToShed(1);
      expect(toShed[0].connectionId).toBe('conn-1'); // Oldest
    });

    it('prioritizes shedding low-priority connections', () => {
      manager.addConnection('conn-1', 'user-1', 'high');
      manager.addConnection('conn-2', 'user-2', 'normal');
      manager.addConnection('conn-3', 'user-3', 'low');

      const toShed = manager.getConnectionsToShed(1);
      expect(toShed[0].connectionId).toBe('conn-3'); // Low priority
    });

    it('executes shedding decisions', () => {
      manager.addConnection('conn-1');
      manager.addConnection('conn-2');

      const decisions: ShedDecision[] = [
        { connectionId: 'conn-1', reason: 'capacity_exceeded', severity: 'warning' },
      ];

      const shedIds = manager.shedConnections(decisions);
      expect(shedIds).toContain('conn-1');
      expect(manager.getConnection('conn-1')).toBeUndefined();
      expect(manager.getMetrics().shedConnections).toBe(1);
    });
  });

  describe('User Connections', () => {
    it('gets all connections for a user', () => {
      manager.addConnection('conn-1', 'user-1');
      manager.addConnection('conn-2', 'user-1');
      manager.addConnection('conn-3', 'user-2');

      const user1Conns = manager.getUserConnections('user-1');
      expect(user1Conns).toHaveLength(2);
      expect(user1Conns.map(c => c.connectionId)).toEqual(['conn-1', 'conn-2']);

      const user2Conns = manager.getUserConnections('user-2');
      expect(user2Conns).toHaveLength(1);
    });
  });

  describe('Graceful Shutdown', () => {
    it('drains connections during graceful shutdown', async () => {
      for (let i = 0; i < 10; i++) {
        manager.addConnection(`conn-${i}`);
      }

      const metrics1 = manager.getMetrics();
      expect(metrics1.activeConnections).toBe(10);

      const result = await manager.gracefulShutdown();
      expect(result).toBeDefined();
    });
  });

  describe('Alerts', () => {
    it('emits alert callbacks', async () => {
      const alerts: any[] = [];
      manager.onAlert(alert => {
        alerts.push(alert);
      });

      const config = { ...defaultConfig, maxConnections: 10, warningThreshold: 80 };
      const testManager = new ConnectionManager(config);

      testManager.onAlert(alert => {
        alerts.push(alert);
      });

      // Add connection to trigger warning
      for (let i = 0; i < 9; i++) {
        testManager.addConnection(`conn-${i}`);
      }

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toMatch(/capacity_warning|capacity_limit_exceeded/);
    });
  });

  describe('Load Test: Ramp Up to Capacity', () => {
    it('handles ramp up to near capacity', () => {
      const config = {
        ...defaultConfig,
        maxConnections: 10000,
        warningThreshold: 80,
        shedThreshold: 95,
      };
      const testManager = new ConnectionManager(config);

      // Ramp up to 95% capacity
      let accepted = 0;
      for (let i = 0; i < 10000; i++) {
        if (testManager.addConnection(`conn-${i}`, `user-${i}`)) {
          accepted++;
        } else {
          break;
        }
      }

      const metrics = testManager.getMetrics();
      expect(metrics.activeConnections).toBeGreaterThan(9000);
      expect(metrics.activeConnections).toBeLessThanOrEqual(9500);
      expect(testManager.isCapacityWarning()).toBe(true);
    });

    it('rejects connections beyond shed threshold', () => {
      const config = {
        ...defaultConfig,
        maxConnections: 1000,
        shedThreshold: 95,
      };
      const testManager = new ConnectionManager(config);

      // Fill to 95%
      for (let i = 0; i < 950; i++) {
        testManager.addConnection(`conn-${i}`);
      }

      // Next 60 should be rejected
      let rejected = 0;
      for (let i = 950; i < 1010; i++) {
        if (!testManager.addConnection(`conn-${i}`)) {
          rejected++;
        }
      }

      expect(rejected).toBeGreaterThan(0);
      expect(testManager.getMetrics().rejectedConnections).toBeGreaterThan(0);
    });
  });
});
