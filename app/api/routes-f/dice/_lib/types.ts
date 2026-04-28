export interface DiceRequest {
  notation: string;
  seed?: number;
}

export interface DiceResponse {
  total: number;
  rolls: number[];
  dropped?: number[];
  notation: string;
}

export interface DiceError {
  error: string;
}

export interface ParsedNotation {
  count: number;
  sides: number;
  modifier: number;
  keepHighest?: number;
  dropLowest?: number;
}
