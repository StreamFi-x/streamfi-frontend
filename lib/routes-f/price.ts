import { getCachedXlmUsdPrice } from "@/lib/prices/xlm";

export async function getXlmUsdPrice(): Promise<number> {
  const result = await getCachedXlmUsdPrice();
  return result.price;
}
