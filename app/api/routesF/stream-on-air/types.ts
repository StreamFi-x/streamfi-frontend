export interface OnAirState {
  creator_id: string;
  on_air: boolean;
  /** ISO timestamp of the last transition into the current state. */
  since: string;
}

export interface OnAirGetResponse {
  on_air: boolean;
  since: string | null;
  duration_seconds: number;
}

export interface OnAirSetResponse {
  on_air: boolean;
  since: string;
  changed: boolean;
}
