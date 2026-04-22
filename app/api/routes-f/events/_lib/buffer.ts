import { AnalyticsEvent, EventBuffer, PaginatedEvents, PaginationParams } from "./types";

const MAX_BUFFER_SIZE = 10000;

class EventBufferManager {
  private buffer: AnalyticsEvent[] = [];
  private maxSize: number = MAX_BUFFER_SIZE;

  addEvents(events: AnalyticsEvent[]): void {
    const totalEvents = events.length;
    
    // If adding these events would exceed the buffer, remove oldest events first
    if (this.buffer.length + totalEvents > this.maxSize) {
      const overflow = this.buffer.length + totalEvents - this.maxSize;
      this.buffer.splice(0, overflow);
    }
    
    // Add new events
    this.buffer.push(...events);
  }

  getEvents(params: PaginationParams): PaginatedEvents {
    const page = params.page || 1;
    const limit = params.limit || 50;
    
    // Sort events by timestamp (newest first)
    const sortedEvents = [...this.buffer].sort((a, b) => b.timestamp - a.timestamp);
    
    const total = sortedEvents.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedEvents = sortedEvents.slice(startIndex, endIndex);
    
    return {
      events: paginatedEvents,
      pagination: {
        page,
        limit,
        total,
        hasNext: endIndex < total,
        hasPrev: page > 1,
      },
    };
  }

  getBufferSize(): number {
    return this.buffer.length;
  }

  clearBuffer(): void {
    this.buffer = [];
  }

  // Get buffer statistics
  getStats() {
    return {
      size: this.buffer.length,
      maxSize: this.maxSize,
      utilization: (this.buffer.length / this.maxSize) * 100,
    };
  }
}

// Export the class for testing
export { EventBufferManager };

// Singleton instance for the entire application
export const eventBuffer = new EventBufferManager();
