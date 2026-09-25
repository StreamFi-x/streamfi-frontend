export interface CreatorEarningItem {
  id: string;
  type: 'tip' | 'subscription';
  amountXlm: number;
  xlmUsdRateAtReceipt: number;
  grossAmountUsd: number;
  platformFeeUsd: number;
  netAmountUsd: number;
  timestamp: string;
  txHash: string;
}

export interface TaxPeriodSummary {
  creatorId: string;
  taxYear: number;
  totalGrossEarningsUsd: number;
  totalPlatformFeesUsd: number;
  totalNetEarningsUsd: number;
  totalXlmReceived: number;
  itemizedEarnings: CreatorEarningItem[];
}

/**
 * Generates an itemized tax summary for a creator over a tax period.
 */
export function generateTaxSummary(
  creatorId: string,
  taxYear: number,
  earnings: CreatorEarningItem[]
): TaxPeriodSummary {
  const yearItems = earnings.filter((e) => new Date(e.timestamp).getFullYear() === taxYear);

  let totalGrossEarningsUsd = 0;
  let totalPlatformFeesUsd = 0;
  let totalNetEarningsUsd = 0;
  let totalXlmReceived = 0;

  for (const item of yearItems) {
    totalGrossEarningsUsd += item.grossAmountUsd;
    totalPlatformFeesUsd += item.platformFeeUsd;
    totalNetEarningsUsd += item.netAmountUsd;
    totalXlmReceived += item.amountXlm;
  }

  return {
    creatorId,
    taxYear,
    totalGrossEarningsUsd: Math.round(totalGrossEarningsUsd * 100) / 100,
    totalPlatformFeesUsd: Math.round(totalPlatformFeesUsd * 100) / 100,
    totalNetEarningsUsd: Math.round(totalNetEarningsUsd * 100) / 100,
    totalXlmReceived: Math.round(totalXlmReceived * 100) / 100,
    itemizedEarnings: yearItems,
  };
}

/**
 * Converts tax summary into standard CSV for creator download.
 */
export function exportTaxSummaryToCsv(summary: TaxPeriodSummary): string {
  const headers = [
    'Transaction ID',
    'Type',
    'Timestamp',
    'XLM Amount',
    'Historical XLM/USD Rate',
    'Gross (USD)',
    'Platform Fee (USD)',
    'Net (USD)',
    'Stellar TX Hash',
  ];

  const rows = summary.itemizedEarnings.map((item) =>
    [
      item.id,
      item.type,
      item.timestamp,
      item.amountXlm.toFixed(2),
      item.xlmUsdRateAtReceipt.toFixed(4),
      item.grossAmountUsd.toFixed(2),
      item.platformFeeUsd.toFixed(2),
      item.netAmountUsd.toFixed(2),
      item.txHash,
    ].join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}
