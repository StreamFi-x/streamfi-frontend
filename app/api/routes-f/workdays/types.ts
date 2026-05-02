export interface WorkdaysRequest {
  from: string;
  to: string;
  country?: string;
  custom_holidays?: string[];
  weekend_days?: number[];
}

export interface WorkdaysResponse {
  workdays: number;
  total_days: number;
  holidays_in_range: number;
  weekend_days_used: number;
}
