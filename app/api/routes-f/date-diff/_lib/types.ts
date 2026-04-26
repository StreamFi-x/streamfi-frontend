export type DateDiffUnit =
  | "years"
  | "months"
  | "weeks"
  | "days"
  | "hours"
  | "minutes"
  | "all";
export type DateDiffRequest = {
  from: string;
  to: string;
  unit?: DateDiffUnit;
};
export type DateBreakdown = {
  years: number;
  months: number;
  days: number;
  hours: number;
  minutes: number;
};
export type DateDiffResponse = {
  from: string;
  to: string;
  breakdown: DateBreakdown;
  total_seconds: number;
  human: string;
};
