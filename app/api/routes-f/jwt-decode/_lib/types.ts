export interface JwtDecodeRequest {
  token: string;
}

export interface JwtDecodeResponse {
  header: object;
  payload: object;
  signature: string;
  warnings: string[];
}
