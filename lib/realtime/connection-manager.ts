import { logger } from '@/lib/tracing/logger';
import { getCurrentTraceContext } from '@/lib/tracing/trace-context';

/**
 * Per-instance connection metrics
 */
export interface ConnectionMetrics {
  instanceId: string;
  totalConnections: number;
  activeConnections: number;
  peakConnections: number;
  rejectedConnections: number;
  shedConnections: number;
  uptime: number; // milliseconds
  createdAt: Date;
  lastUpdatedAt: Date;
}

/**
 * Configuration for connection limits and capacity management
 */
export interface CapacityConfig {
  instanceId: string;
  maxConnections: number; // Hard limit
  warningThreshold: number; // Percentage (0-100) at which to start alerting
  shedThreshold: number; // Percentage (0-100) at which to start shedding new connections
  shedStrategy: 'reject_new' | 'shed_oldest' | 'shed_least_active'; // Strategy when at capacity
  gracefulShutdownWindow: number; // milliseconds - time to drain connections during shutdown
}

/**
 * Individual connection record
 */
export interface Connection {
  connectionId: string;
  userId?: string;
  channels: Set<string>; // Subscribed channels
  connectedAt: Date;
  lastActivityAt: Date;
  dataTransferred: number; // bytes
  messageCount: number;
  priority: 'high' | 'normal' | 'low'; // For shedding decisions
}

/**
 * Connection shedding decision
 */
export interface ShedDecision {
  connectionId: string;
  reason: 'capacity_exceeded' | 'graceful_shutdown' | 'manual';
  severity: 'warning' | 'error';
}

/**
 * Per-instance connection manager
 * Tracks concurrent connections and enforces capacity limits
 */
export class ConnectionManager {
  private connections: Map<string, Connection> = new Map();
  private metrics: ConnectionMetrics;
  private config: CapacityConfig;
  private alertCallbacks: Array<(alert: ConnectionAlert) => void> = [];
  private startTime: number = Date.now();

  constructor(config: CapacityConfig) {
    this.config = config;
    this.metrics = {
      instanceId: config.instanceId,
      totalConnections: 0,
      activeConnections: 0,
      peakConnections: 0,
      rejectedConnections: 0,
      shedConnections: 0,
      uptime: 0,
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
    };

    logger.info('Connection manager initialized', {
      operation: 'ConnectionManager.constructor',
      instanceId: config.instanceId,
      maxConnections: config.maxConnections,
      warningThreshold: config.warningThreshold,
    });
  }

  /**
   * Add a new connection (with capacity check)
   */
  addConnection(connectionId: string, userId?: string, priority: 'high' | 'normal' | 'low' = 'normal'): boolean {
    const currentLoad = (this.connections.size / this.config.maxConnections) * 100;

    // Check if at shed threshold
    if (currentLoad >= this.config.shedThreshold) {
      logger.warn('Connection rejected: shed threshold reached', {
        operation: 'addConnection',
        instanceId: this.config.instanceId,
        currentLoad,
        shedThreshold: this.config.shedThreshold,
        connectionId,
      });

      this.metrics.rejectedConnections++;
      this.emitAlert({
        type: 'capacity_limit_exceeded',
        severity: 'error',
        currentLoad,
        maxConnections: this.config.maxConnections,
      });

      return false;
    }

    // Add connection
    this.connections.set(connectionId, {
      connectionId,
      userId,
      channels: new Set(),
      connectedAt: new Date(),
      lastActivityAt: new Date(),
      dataTransferred: 0,
      messageCount: 0,
      priority,
    });

    this.metrics.totalConnections++;
    this.metrics.activeConnections = this.connections.size;
    this.metrics.peakConnections = Math.max(this.metrics.peakConnections, this.connections.size);
    this.metrics.lastUpdatedAt = new Date();

    logger.debug('Connection added', {
      operation: 'addConnection',
      instanceId: this.config.instanceId,
      connectionId,
      activeConnections: this.connections.size,
    });

    // Check if warning threshold reached
    if (currentLoad >= this.config.warningThreshold) {
      this.emitAlert({
        type: 'capacity_warning',
        severity: 'warning',
        currentLoad,
        maxConnections: this.config.maxConnections,
      });
    }

    return true;
  }

  /**
   * Remove connection
   */
  removeConnection(connectionId: string): boolean {
    const removed = this.connections.delete(connectionId);

    if (removed) {
      this.metrics.activeConnections = this.connections.size;
      this.metrics.lastUpdatedAt = new Date();

      logger.debug('Connection removed', {
        operation: 'removeConnection',
        instanceId: this.config.instanceId,
        connectionId,
        activeConnections: this.connections.size,
      });
    }

    return removed;
  }

  /**
   * Get connection by ID
   */
  getConnection(connectionId: string): Connection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Update connection activity
   */
  updateActivity(connectionId: string, dataTransferred: number = 0): boolean {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      return false;
    }

    conn.lastActivityAt = new Date();
    conn.messageCount++;
    conn.dataTransferred += dataTransferred;

    return true;
  }

  /**
   * Subscribe connection to channel
   */
  subscribeToChannel(connectionId: string, channel: string): boolean {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      return false;
    }

    conn.channels.add(channel);
    return true;
  }

  /**
   * Unsubscribe connection from channel
   */
  unsubscribeFromChannel(connectionId: string, channel: string): boolean {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      return false;
    }

    conn.channels.delete(channel);
    return true;
  }

  /**
   * Get all connections for a user
   */
  getUserConnections(userId: string): Connection[] {
    return Array.from(this.connections.values()).filter(c => c.userId === userId);
  }

  /**
   * Get all connections subscribed to a channel
   */
  getChannelSubscribers(channel: string): Connection[] {
    return Array.from(this.connections.values()).filter(c => c.channels.has(channel));
  }

  /**
   * Check if capacity limit is approaching
   */
  isCapacityWarning(): boolean {
    const load = (this.connections.size / this.config.maxConnections) * 100;
    return load >= this.config.warningThreshold;
  }

  /**
   * Check if at shedding threshold
   */
  isAtCapacityLimit(): boolean {
    const load = (this.connections.size / this.config.maxConnections) * 100;
    return load >= this.config.shedThreshold;
  }

  /**
   * Get connections to shed based on strategy
   */
  getConnectionsToShed(count: number = 1): ShedDecision[] {
    if (this.connections.size === 0) {
      return [];
    }

    const toShed: ShedDecision[] = [];
    const sheddable = Array.from(this.connections.values());

    // Sort based on shedding strategy
    if (this.config.shedStrategy === 'shed_oldest') {
      sheddable.sort((a, b) => a.connectedAt.getTime() - b.connectedAt.getTime());
    } else if (this.config.shedStrategy === 'shed_least_active') {
      sheddable.sort((a, b) => a.lastActivityAt.getTime() - b.lastActivityAt.getTime());
    }

    // Prioritize shedding low-priority connections first
    const lowPriority = sheddable.filter(c => c.priority === 'low');
    const normalPriority = sheddable.filter(c => c.priority === 'normal');
    const highPriority = sheddable.filter(c => c.priority === 'high');

    const shedOrder = [...lowPriority, ...normalPriority, ...highPriority];

    for (let i = 0; i < Math.min(count, shedOrder.length); i++) {
      toShed.push({
        connectionId: shedOrder[i].connectionId,
        reason: 'capacity_exceeded',
        severity: 'warning',
      });
    }

    return toShed;
  }

  /**
   * Execute shedding
   */
  shedConnections(decisions: ShedDecision[]): string[] {
    const shedIds: string[] = [];

    for (const decision of decisions) {
      if (this.removeConnection(decision.connectionId)) {
        shedIds.push(decision.connectionId);
        this.metrics.shedConnections++;

        logger.warn('Connection shed', {
          operation: 'shedConnections',
          instanceId: this.config.instanceId,
          connectionId: decision.connectionId,
          reason: decision.reason,
        });
      }
    }

    return shedIds;
  }

  /**
   * Graceful shutdown: drain connections over time window
   */
  async gracefulShutdown(): Promise<{ drainedConnections: number; remainingConnections: number }> {
    logger.info('Graceful shutdown initiated', {
      operation: 'gracefulShutdown',
      instanceId: this.config.instanceId,
      activeConnections: this.connections.size,
    });

    const startCount = this.connections.size;
    const drainTimePerConnection = this.config.gracefulShutdownWindow / Math.max(startCount, 1);

    // Emit shutdown signal to all connections
    for (const conn of this.connections.values()) {
      // In production, send "server is shutting down" message to connection
      logger.debug('Shutdown signal sent to connection', {
        connectionId: conn.connectionId,
      });
    }

    // Wait for gradual drain
    await new Promise(resolve => setTimeout(resolve, this.config.gracefulShutdownWindow));

    const remaining = this.connections.size;

    logger.info('Graceful shutdown completed', {
      operation: 'gracefulShutdown',
      instanceId: this.config.instanceId,
      drainedConnections: startCount - remaining,
      remainingConnections: remaining,
    });

    return {
      drainedConnections: startCount - remaining,
      remainingConnections: remaining,
    };
  }

  /**
   * Get current metrics
   */
  getMetrics(): ConnectionMetrics {
    this.metrics.activeConnections = this.connections.size;
    this.metrics.uptime = Date.now() - this.startTime;
    this.metrics.lastUpdatedAt = new Date();

    return this.metrics;
  }

  /**
   * Get connection load percentage
   */
  getLoadPercentage(): number {
    return (this.connections.size / this.config.maxConnections) * 100;
  }

  /**
   * Register alert callback
   */
  onAlert(callback: (alert: ConnectionAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Emit alert
   */
  private emitAlert(alert: ConnectionAlert): void {
    logger.warn('Connection capacity alert', {
      operation: 'emitAlert',
      instanceId: this.config.instanceId,
      alertType: alert.type,
      severity: alert.severity,
      currentLoad: alert.currentLoad,
    });

    for (const callback of this.alertCallbacks) {
      try {
        callback(alert);
      } catch (error) {
        logger.error('Alert callback failed', {
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Get all connections (for monitoring/debugging)
   */
  getAllConnections(): Connection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Reset metrics (testing only)
   */
  resetMetrics(): void {
    this.metrics = {
      instanceId: this.config.instanceId,
      totalConnections: 0,
      activeConnections: 0,
      peakConnections: 0,
      rejectedConnections: 0,
      shedConnections: 0,
      uptime: 0,
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
    };
    this.startTime = Date.now();
  }
}

/**
 * Connection capacity alert
 */
export interface ConnectionAlert {
  type: 'capacity_warning' | 'capacity_limit_exceeded' | 'shed_initiated';
  severity: 'warning' | 'error';
  currentLoad: number; // percentage 0-100
  maxConnections: number;
}
