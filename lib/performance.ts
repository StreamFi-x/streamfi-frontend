// Performance monitoring utilities

interface PerformanceMetric {
  name: string;
  value: number;
  category: "navigation" | "resource" | "paint" | "layout" | "custom";
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];

  // Track page load performance
  trackPageLoad() {
    if (typeof window !== "undefined" && "performance" in window) {
      const navigation = performance.getEntriesByType(
        "navigation"
      )[0] as PerformanceNavigationTiming;

      if (navigation) {
        this.addMetric(
          "DOMContentLoaded",
          navigation.domContentLoadedEventEnd -
            navigation.domContentLoadedEventStart,
          "navigation"
        );
        this.addMetric(
          "LoadComplete",
          navigation.loadEventEnd - navigation.loadEventStart,
          "navigation"
        );
        this.addMetric("FirstPaint", this.getFirstPaint(), "paint");
        this.addMetric(
          "FirstContentfulPaint",
          this.getFirstContentfulPaint(),
          "paint"
        );
      }
    }
  }

  // Track custom performance metrics
  trackCustomMetric(
    name: string,
    value: number,
    category: PerformanceMetric["category"] = "custom"
  ) {
    this.addMetric(name, value, category);
  }

  // Track API response times
  trackApiCall(url: string, duration: number) {
    this.addMetric(`API: ${url}`, duration, "custom");
  }

  // Track component render times
  trackComponentRender(componentName: string, duration: number) {
    this.addMetric(`Component: ${componentName}`, duration, "custom");
  }

  private addMetric(
    name: string,
    value: number,
    category: PerformanceMetric["category"]
  ) {
    const metric: PerformanceMetric = {
      name,
      value,
      category,
      timestamp: Date.now(),
    };

    this.metrics.push(metric);

    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log(`📊 Performance: ${name} = ${value}ms`);
    }

    // Send to analytics service in production
    if (process.env.NODE_ENV === "production") {
      this.sendToAnalytics(metric);
    }
  }

  private getFirstPaint(): number {
    if (typeof window !== "undefined" && "performance" in window) {
      const paintEntries = performance.getEntriesByType("paint");
      const firstPaint = paintEntries.find(
        entry => entry.name === "first-paint"
      );
      return firstPaint ? firstPaint.startTime : 0;
    }
    return 0;
  }

  private getFirstContentfulPaint(): number {
    if (typeof window !== "undefined" && "performance" in window) {
      const paintEntries = performance.getEntriesByType("paint");
      const firstContentfulPaint = paintEntries.find(
        entry => entry.name === "first-contentful-paint"
      );
      return firstContentfulPaint ? firstContentfulPaint.startTime : 0;
    }
    return 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private sendToAnalytics(_metric: PerformanceMetric) {
    // Send to your analytics service (e.g., Google Analytics, Sentry, etc.)
    // Example:
    // gtag('event', 'performance', {
    //   metric_name: _metric.name,
    //   metric_value: _metric.value,
    //   metric_category: _metric.category,
    // });
  }

  // Get all metrics
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  // Clear metrics
  clearMetrics() {
    this.metrics = [];
  }
}

// Create a singleton instance
export const performanceMonitor = new PerformanceMonitor();

import * as React from "react";

// React hook for tracking component performance
export const usePerformanceTracking = (componentName: string) => {
  const startTime = React.useRef<number>(Date.now());

  React.useEffect(() => {
    const duration = Date.now() - startTime.current;
    performanceMonitor.trackComponentRender(componentName, duration);
  });

  return {
    trackCustomMetric: (name: string, value: number) => {
      performanceMonitor.trackCustomMetric(`${componentName}: ${name}`, value);
    },
  };
};
