export type Operation = "both" | "gcd" | "lcm";

export interface GcdLcmInput {
  numbers: number[];
  operation?: Operation;
}

export interface GcdLcmResponse {
  gcd?: number;
  lcm?: number;
  n_count: number;
}
