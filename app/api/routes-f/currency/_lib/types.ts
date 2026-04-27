export interface CurrencyRequest {
  from: string;
  to: string;
  amount: number;
}

export interface CurrencyResponse {
  converted: number;
  rate: number;
  as_of: string;
}
