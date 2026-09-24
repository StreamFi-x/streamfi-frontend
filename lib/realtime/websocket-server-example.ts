/**
 * Example WebSocket server integration with connection capacity management
 * 
 * This shows how to use ConnectionManager with a real WebSocket server
 * (e.g., using ws, uWebSockets, or similar library)
 * 
 * NOTE: This is a reference implementation. Actual deployment would depend on
 * chosen realtime infrastructure (managed provider vs self-hosted)
 */

import { ConnectionManager, CapacityConfig } from './connection-manager';
import { MetricsCollector, AlertSink } from './metrics-exporter';
import { logger } from '@/lib/tracing/logger';
import { getCurrentTraceContext } from '@/lib/tracing/trace-context';

/**
 * Example configuration for a WebSocket server instance
 */
const WEBSOCKET_CAPACITY_CONFIG: CapacityConfig = {
  instanceId: process.env.INSTANCE_ID || 'ws-instance-1',
  maxConnections: parseInt(process.env.WS_MAX_CONNECTIONS || '10000', 10),
  warningThreshold: 80, // Alert when 80% full
  shedThreshold: 95, // Start shedding at 95%
  shedStrategy: 'shed_least_active',
  gracefulShutdownWindow: 30000, // 30 seconds
};

/**
 * Simulated WebSocket server with connection management
 * (In production, this would be your actual WebSocket server implementation)
 */
export class ManagedWebSocketServer {
  private manager: ConnectionManager;
  private metricsCollector: MetricsCollector;
  private alertSink: AlertSink;
  private isShuttingDown: boolean = false;

  constructor(config: CapacityConfig = WEBSOCKET_CAPACITY_CONFIG) {
    this.manager = new ConnectionManager(config);
    this.metricsCollector = new MetricsCollector();
    this.alertSink = new AlertSink();

    // Register alert handlers
    this.manager.onAlert(alert => {
      this.handleCapacityAlert(alert);
    });

    // Export metrics periodically (for monitoring systems)
    this.startMetricsExport();

    logger.info('Managed WebSocket server initialized', {
      operation: 'ManagedWebSocketServer.constructor',
      instanceId: config.instanceId,
      maxConnections: config.maxConnections,
    });
  }

  /**
   * Handle new WebSocket connection
   */
  async handleNewConnection(connectionId: string, userId?: string): Promise<boolean> {
    if (this.isShuttingDown) {
      logger.warn('Rejected connection: server shutting down', {
        connectionId,
      });
      return false;
    }

    const allowed = this.manager.addConnection(connectionId, userId);

    if (allowed) {
      logger.info('Connection established', {
        operation: 'handleNewConnection',
        connectionId,
        userId,
        activeConnections: this.manager.getMetrics().activeConnections,
      });
    } else {
      logger.warn('Connection rejected: at capacity', {
        connectionId,
        load: this.manager.getLoadPercentage(),
      });
    }

    return allowed;
  }

  /**
   * Handle connection close
   */
  handleConnectionClose(connectionId: string): void {
    this.manager.removeConnection(connectionId);

    logger.debug('Connection closed', {
      operation: 'handleConnectionClose',
      connectionId,
      activeConnections: this.manager.getMetrics().activeConnections,
    });
  }

  /**
   * Handle incoming message from connection
   */
  handleMessage(connectionId: string, message: string | Buffer, dataSize: number): void {
    this.manager.updateActivity(connectionId, dataSize);

    // Process message (route to handlers, update channel subscriptions, etc.)
    try {
      const data = typeof message === 'string' ? JSON.parse(message) : message;

      if (data.action === 'subscribe') {
        this.manager.subscribeToChannel(connectionId, data.channel);
        logger.debug('Channel subscription', {
          connectionId,
          channel: data.channel,
        });
      } else if (data.action === 'unsubscribe') {
        this.manager.unsubscribeFromChannel(connectionId, data.channel);
      }
    } catch (error) {
      logger.error('Failed to process message', {
        connectionId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Broadcast message to all subscribers of a channel
   */
  broadcastToChannel(channel: string, message: any): void {
    const subscribers = this.manager.getChannelSubscribers(channel);

    logger.info('Broadcasting to channel', {
      operation: 'broadcastToChannel',
      channel,
      subscribers: subscribers.length,
    });

    for (const subscriber of subscribers) {
      // In production: send message to actual WebSocket connection
      // connection.send(JSON.stringify(message));
    }
  }

  /**
   * Handle capacity alert
   */
  private handleCapacityAlert(alert: any): void {
    const metrics = this.manager.getMetrics();

    logger.warn('Capacity alert triggered', {
      operation: 'handleCapacityAlert',
      alertType: alert.type,
      severity: alert.severity,
      currentLoad: alert.currentLoad,
      activeConnections: metrics.activeConnections,
    });

    if (alert.type === 'capacity_limit_exceeded') {
      // Implement shedding strategy
      const toShed = this.manager.getConnectionsToShed(10);
      const shedIds = this.manager.shedConnections(toShed);

      logger.warn('Connections shed due to capacity', {
        operation: 'handleCapacityAlert',
        shedCount: shedIds.length,
        remainingConnections: metrics.activeConnections - shedIds.length,
      });

      // Send close frames to shed connections
      for (const connectionId of shedIds) {
        // In production: send close frame with reason
        // connection.close(1008, 'Server at capacity');
      }
    }

    // Emit to external alerting system
    this.alertSink.emit({
      ...alert,
      instanceId: metrics.instanceId,
    });
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return this.manager.getMetrics();
  }

  /**
   * Start metrics export loop (for monitoring scraping)
   */
  private startMetricsExport(): void {
    setInterval(() => {
      const metrics = this.manager.getMetrics();
      this.metricsCollector.updateInstanceMetrics(metrics);

      logger.debug('Metrics exported', {
        operation: 'metricsExport',
        activeConnections: metrics.activeConnections,
        load: this.manager.getLoadPercentage().toFixed(2) + '%',
      });
    }, 10000); // Export every 10 seconds
  }

  /**
   * Graceful shutdown: drain connections and stop accepting new ones
   */
  async shutdown(): Promise<void> {
    logger.info('WebSocket server shutdown initiated', {
      operation: 'shutdown',
      activeConnections: this.manager.getMetrics().activeConnections,
    });

    this.isShuttingDown = true;

    // Send shutdown signal to all connections
    const metrics = this.manager.getMetrics();
    for (const conn of this.manager.getAllConnections()) {
      // In production: send shutdown message
      // connection.send(JSON.stringify({
      //   type: 'server_shutdown',
      //   message: 'Server shutting down, please reconnect shortly'
      // }));
    }

    // Wait for graceful drain
    const result = await this.manager.gracefulShutdown();

    logger.info('WebSocket server shutdown completed', {
      operation: 'shutdown',
      drainedConnections: result.drainedConnections,
      remainingConnections: result.remainingConnections,
    });
  }

  /**
   * Register monitoring alert sink (e.g., for Datadog, PagerDuty)
   */
  registerAlertHandler(handler: (alert: any) => Promise<void>): void {
    this.alertSink.registerHandler(handler);
  }
}

/**
 * Example: Initialize and export metrics endpoint
 */
export function createMetricsEndpoint(server: ManagedWebSocketServer) {
  return {
    path: '/metrics',
    handler: (req: any, res: any) => {
      const metrics = server.getMetrics();
      res.json({
        timestamp: new Date().toISOString(),
        metrics: {
          activeConnections: metrics.activeConnections,
          totalConnections: metrics.totalConnections,
          peakConnections: metrics.peakConnections,
          rejectedConnections: metrics.rejectedConnections,
          shedConnections: metrics.shedConnections,
          uptime: metrics.uptime,
          loadPercentage: (metrics.activeConnections / 10000) * 100,
        },
      });
    },
  };
}

/**
 * Example: Initialize and export health check endpoint
 */
export function createHealthCheckEndpoint(server: ManagedWebSocketServer) {
  return {
    path: '/health',
    handler: (req: any, res: any) => {
      const metrics = server.getMetrics();
      const load = (metrics.activeConnections / 10000) * 100;

      const status = load > 95 ? 'degraded' : load > 80 ? 'warning' : 'healthy';

      res.json({
        status,
        load: load.toFixed(2) + '%',
        activeConnections: metrics.activeConnections,
        timestamp: new Date().toISOString(),
      });
    },
  };
}
