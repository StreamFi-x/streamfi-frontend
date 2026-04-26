export type TimezoneResponse = {
  converted: string;
  offset_hours: number;
};
type TimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};
export type { TimeParts };
