export interface PerfectPowerQuery {
  n: string;
}

export interface PerfectPowerResult {
  is_square: boolean;
  sqrt?: number;
  is_cube: boolean;
  cbrt?: number;
  is_perfect_power: boolean;
  base?: number;
  exponent?: number;
}
