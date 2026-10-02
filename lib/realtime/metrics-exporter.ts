import { ConnectionMetrics, ConnectionAlert } from './connection-manager';
import { logger } from '@/lib/tracing/logger';

/**
 * Exported metrics in Prometheus format
 */
export interface PrometheusMetrics {
  timestamp: number;
  metrics: string;
}

/**
 * Metrics aggregator for multiple instances
 */
export interface AggregatedMetrics {
  timestamp: Date;
  instances: Map<string, ConnectionMetrics>;
  totalActiveConnections: number;
  totalCapacity: number;
  globalLoadPercentage: number;
  overCapacityInstances: string[];
}

/**
 * Export connection metrics in Prometheus text format
 */
export function toPrometheusFormat(metrics: ConnectionMetrics): string {
  const timestamp = metrics.lastUpdatedAt.getTime();

  return `
# HELP streamfi_connections_active Active WebSocket connections
# TYPE streamfi_connections_active gauge
streamfi_connections_active{instance="${metrics.instanceId}"} ${metrics.activeConnections}

# HELP streamfi_connections_total Total connections created
# TYPE streamfi_connections_total counter
streamfi_connections_total{instance="${metrics.instanceId}"} ${metrics.totalConnections}

# HELP streamfi_connections_peak Peak concurrent connections
# TYPE streamfi_connections_peak gauge
streamfi_connections_peak{instance="${metrics.instanceId}"} ${metrics.peakConnections}

# HELP streamfi_connections_rejected Rejected connections (capacity exceeded)
# TYPE streamfi_connections_rejected counter
streamfi_connections_rejected{instance="${metrics.instanceId}"} ${metrics.rejectedConnections}

# HELP streamfi_connections_shed Shed connections
# TYPE streamfi_connections_shed counter
streamfi_connections_shed{instance="${metrics.instanceId}"} ${metrics.shedConnections}

# HELP streamfi_instance_uptime Instance uptime in seconds
# TYPE streamfi_instance_uptime gauge
streamfi_instance_uptime{instance="${metrics.instanceId}"} ${metrics.uptime / 1000}

# TIMESTAMP ${timestamp}
`.trim();
}

/**
 * Export metrics as JSON (for API endpoints)
 */
export function toJSON(metrics: ConnectionMetrics): Record<string, any> {
  return {
    instanceId: metrics.instanceId,
    activeConnections: metrics.activeConnections,
    totalConnections: metrics.totalConnections,
    peakConnections: metrics.peakConnections,
    rejectedConnections: metrics.rejectedConnections,
    shedConnections: metrics.shedConnections,
    uptime: `${(metrics.uptime / 1000).toFixed(2)}s`,
    createdAt: metrics.createdAt.toISOString(),
    lastUpdatedAt: metrics.lastUpdatedAt.toISOString(),
  };
}

/**
 * Metrics collector that aggregates across multiple instances
 */
export class MetricsCollector {
  private instances: Map<string, ConnectionMetrics> = new Map();
  private alerts: ConnectionAlert[] = [];
  private maxAlertsHistory: number = 1000;

  /**
   * Update metrics for an instance
   */
  updateInstanceMetrics(metrics: ConnectionMetrics): void {
    this.instances.set(metrics.instanceId, metrics);

    logger.debug('Instance metrics updated', {
      operation: 'updateInstanceMetrics',
      instanceId: metrics.instanceId,
      activeConnections: metrics.activeConnections,
    });
  }

  /**
   * Record alert
   */
  recordAlert(alert: ConnectionAlert & { instanceId?: string }): void {
    this.alerts.push(alert);

    // Keep only recent alerts
    if (this.alerts.length > this.maxAlertsHistory) {
      this.alerts = this.alerts.slice(-this.maxAlertsHistory);
    }

    logger.warn('Capacity alert recorded', {
      operation: 'recordAlert',
      instanceId: alert.instanceId || 'unknown',
      alertType: alert.type,
      severity: alert.severity,
    });
  }

  /**
   * Get aggregated metrics across all instances
   */
  getAggregatedMetrics(): AggregatedMetrics {
    let totalActive = 0;
    let totalCapacity = 0;
    const overCapacity: string[] = [];

    for (const metrics of this.instances.values()) {
      totalActive += metrics.activeConnections;
      // Assuming capacity is tracked per instance; adjust as needed
      totalCapacity += 10000; // placeholder
    }

    return {
      timestamp: new Date(),
      instances: this.instances,
      totalActiveConnections: totalActive,
      totalCapacity,
      globalLoadPercentage: (totalActive / totalCapacity) * 100,
      overCapacityInstances: overCapacity,
    };
  }

  /**
   * Get alerts for a time window
   */
  getAlerts(fromTime?: Date): ConnectionAlert[] {
    if (!fromTime) {
      return this.alerts;
    }

    return this.alerts.filter(a => {
      const alertTime = new Date(a as any).getTime();
      return alertTime >= fromTime.getTime();
    });
  }

  /**
   * Export metrics for all instances in Prometheus format
   */
  toPrometheusFormat(): string {
    const lines: string[] = [];

    for (const metrics of this.instances.values()) {
      lines.push(toPrometheusFormat(metrics));
    }

    return lines.join('\n\n');
  }

  /**
   * Export metrics as JSON
   */
  toJSON(): Record<string, any> {
    const instanceMetrics: Record<string, any> = {};

    for (const [instanceId, metrics] of this.instances.entries()) {
      instanceMetrics[instanceId] = toJSON(metrics);
    }

    return {
      timestamp: new Date().toISOString(),
      aggregated: this.getAggregatedMetrics(),
      instances: instanceMetrics,
      recentAlerts: this.alerts.slice(-50),
    };
  }
}

/**
 * Alert sink that integrates with monitoring systems
 */
export class AlertSink {
  private handlers: Array<(alert: ConnectionAlert & { instanceId?: string }) => Promise<void>> = [];

  /**
   * Register alert handler (e.g., send to Datadog, PagerDuty, etc.)
   */
  registerHandler(handler: (alert: ConnectionAlert & { instanceId?: string }) => Promise<void>): void {
    this.handlers.push(handler);
  }

  /**
   * Emit alert to all handlers
   */
  async emit(alert: ConnectionAlert & { instanceId?: string }): Promise<void> {
    logger.info('Emitting alert to sinks', {
      operation: 'emit',
      instanceId: alert.instanceId,
      alertType: alert.type,
    });

    const results = await Promise.allSettled(
      this.handlers.map(handler => handler(alert))
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        logger.error('Alert handler failed', {
          errorMessage: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    }
  }
}
