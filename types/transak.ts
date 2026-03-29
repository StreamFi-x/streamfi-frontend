export type TransakCryptoCurrency = "XLM" | "USDC";

/** Minimal order shape when the embedded flow reports completion */
export type TransakOrderData = {
  id?: string;
  status?: string;
};
