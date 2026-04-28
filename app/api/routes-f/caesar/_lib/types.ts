export type CaesarMode = 'encode' | 'decode';

export interface CaesarRequest {
  text: string;
  shift: number;
  mode: CaesarMode;
}

export interface CaesarResponse {
  result: string;
  shift_used: number;
  warning?: string;
}