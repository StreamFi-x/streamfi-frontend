export type UnixDateMode = "to_iso" | "to_unix";
export type UnixDateUnit = "s" | "ms";

export interface UnixDateRequest {
  mode: UnixDateMode;
  value: unknown;
  unit?: UnixDateUnit;
}

export interface UnixDateResponse {
  result: string | number;
  unit: UnixDateUnit;
}
