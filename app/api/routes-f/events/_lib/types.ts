export interface AnalyticsEvent {
  name: string;
  timestamp: number;
  properties?: Record<string, any>;
}

export interface EventSubmission {
  event?: AnalyticsEvent;
  events?: AnalyticsEvent[];
}

export interface EventBuffer {
  events: AnalyticsEvent[];
  maxSize: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedEvents {
  events: AnalyticsEvent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
