import { sql } from "@vercel/postgres";
import { addMonths } from "date-fns";
import { getCachedJson, setCachedJson } from "@/lib/routes-f/cache";
import {
  clampNumber,
  getInclusiveRange,
  getMonthRange,
  getPeriodKey,
  GroupBy,
  parseDateParam,
  toFixedAmount,
  toFixedXlm,
} from "@/lib/routes-f/format";
import { getXlmUsdPrice } from "@/lib/routes-f/price";

type SupportedSource = "tips" | "gifts" | "subscriptions";

type EarningTransaction = {
  id: string;
  source: SupportedSource;
  amount: number;
  asset: string;
  usdEquivalent: number;
  occurredAt: string;
  supporterUsername: string | null;
};

type SummaryBucket = {
  tips: { xlm: string; usd_equivalent: string };
  gifts: { usdc: string };
  subscriptions: { usdc: string };
  total_usd: string;
};

export type EarningsSeriesResponse = {
  series: Array<{
    period: string;
    tips_xlm: string;
    gifts_usdc: string;
    subscriptions_usdc: string;
    total_usd_equivalent: string;
  }>;
  totals: {
    tips_xlm: string;
    gifts_usdc: string;
    subscriptions_usdc: string;
    total_usd_equivalent: string;
  };
  transactions: Array<{
    id: string;
    source: SupportedSource;
    amount: string;
    asset: string;
    usd_equivalent: string;
    occurred_at: string;
    supporter_username: string | null;
  }>;
};

export type EarningsSummaryResponse = {
  all_time: SummaryBucket;
  this_month: SummaryBucket;
  last_month: SummaryBucket;
  top_supporters: Array<{
    username: string;
    total_usd: string;
    last_at: string;
  }>;
};

async function fetchTipTransactions(
  creatorId: string,
  from?: Date,
  to?: Date
): Promise<Array<Record<string, unknown>>> {
  if (from && to) {
    const result = await sql`
      SELECT tt.id, tt.amount_xlm, tt.created_at, u.username AS supporter_username
      FROM tip_transactions tt
      LEFT JOIN users u ON u.id = tt.supporter_id
      WHERE tt.creator_id = ${creatorId}
        AND tt.created_at BETWEEN ${from.toISOString()} AND ${to.toISOString()}
      ORDER BY tt.created_at DESC
    `;
    return result.rows;
  }

  const result = await sql`
    SELECT tt.id, tt.amount_xlm, tt.created_at, u.username AS supporter_username
    FROM tip_transactions tt
    LEFT JOIN users u ON u.id = tt.supporter_id
    WHERE tt.creator_id = ${creatorId}
    ORDER BY tt.created_at DESC
  `;
  return result.rows;
}

async function fetchGiftTransactions(
  creatorId: string,
  from?: Date,
  to?: Date
): Promise<Array<Record<string, unknown>>> {
  if (from && to) {
    const result = await sql`
      SELECT gt.id, gt.amount_usdc, gt.created_at, u.username AS supporter_username
      FROM gift_transactions gt
      LEFT JOIN users u ON u.id = gt.supporter_id
      WHERE gt.creator_id = ${creatorId}
        AND gt.created_at BETWEEN ${from.toISOString()} AND ${to.toISOString()}
      ORDER BY gt.created_at DESC
    `;
    return result.rows;
  }

  const result = await sql`
    SELECT gt.id, gt.amount_usdc, gt.created_at, u.username AS supporter_username
    FROM gift_transactions gt
    LEFT JOIN users u ON u.id = gt.supporter_id
    WHERE gt.creator_id = ${creatorId}
    ORDER BY gt.created_at DESC
  `;
  return result.rows;
}

async function fetchSubscriptionTransactions(
  creatorId: string,
  from?: Date,
  to?: Date
): Promise<Array<Record<string, unknown>>> {
  if (from && to) {
    const result = await sql`
      SELECT s.id, s.amount_usdc, COALESCE(s.last_charged_at, s.created_at) AS created_at,
             u.username AS supporter_username
      FROM subscriptions s
      LEFT JOIN users u ON u.id = s.supporter_id
      WHERE s.creator_id = ${creatorId}
        AND COALESCE(s.last_charged_at, s.created_at)
          BETWEEN ${from.toISOString()} AND ${to.toISOString()}
        AND s.status IN ('active', 'completed', 'cancelled')
      ORDER BY COALESCE(s.last_charged_at, s.created_at) DESC
    `;
    return result.rows;
  }

  const result = await sql`
    SELECT s.id, s.amount_usdc, COALESCE(s.last_charged_at, s.created_at) AS created_at,
           u.username AS supporter_username
    FROM subscriptions s
    LEFT JOIN users u ON u.id = s.supporter_id
    WHERE s.creator_id = ${creatorId}
      AND s.status IN ('active', 'completed', 'cancelled')
    ORDER BY COALESCE(s.last_charged_at, s.created_at) DESC
  `;
  return result.rows;
}

function buildSummaryBucket(
  tipsXlm: number,
  giftsUsdc: number,
  subscriptionsUsdc: number,
  xlmUsdPrice: number
): SummaryBucket {
  const tipsUsd = clampNumber(tipsXlm * xlmUsdPrice);
  const totalUsd = tipsUsd + giftsUsdc + subscriptionsUsdc;

  return {
    tips: {
      xlm: toFixedXlm(tipsXlm),
      usd_equivalent: toFixedAmount(tipsUsd),
    },
    gifts: { usdc: toFixedAmount(giftsUsdc) },
    subscriptions: { usdc: toFixedAmount(subscriptionsUsdc) },
    total_usd: toFixedAmount(totalUsd),
  };
}

function mapToTransactions(
  rows: Array<Record<string, unknown>>,
  source: SupportedSource,
  asset: string,
  amountField: "amount_xlm" | "amount_usdc",
  xlmUsdPrice: number
): EarningTransaction[] {
  return rows.map(row => {
    const amount = Number.parseFloat(String(row[amountField] ?? 0));
    const usdEquivalent = source === "tips" ? amount * xlmUsdPrice : amount;

    return {
      id: String(row.id),
      source,
      amount,
      asset,
      usdEquivalent,
      occurredAt: new Date(String(row.created_at)).toISOString(),
      supporterUsername:
        row.supporter_username === null ? null : String(row.supporter_username),
    };
  });
}

export async function getCreatorEarningsSeries(params: {
  creatorId: string;
  fromParam: string | null;
  toParam: string | null;
  groupByParam: string | null;
}): Promise<EarningsSeriesResponse> {
  const groupBy = (params.groupByParam ?? "day") as GroupBy;
  if (!["day", "week", "month"].includes(groupBy)) {
    throw new Error("group_by must be one of day, week, or month");
  }

  const fromDate = parseDateParam(params.fromParam, "from");
  const toDate = parseDateParam(params.toParam, "to");
  const { from, to } = getInclusiveRange(fromDate, toDate);
  const xlmUsdPrice = await getXlmUsdPrice();

  const [tipRows, giftRows, subscriptionRows] = await Promise.all([
    fetchTipTransactions(params.creatorId, from, to),
    fetchGiftTransactions(params.creatorId, from, to),
    fetchSubscriptionTransactions(params.creatorId, from, to),
  ]);

  const transactions = [
    ...mapToTransactions(tipRows, "tips", "XLM", "amount_xlm", xlmUsdPrice),
    ...mapToTransactions(giftRows, "gifts", "USDC", "amount_usdc", xlmUsdPrice),
    ...mapToTransactions(
      subscriptionRows,
      "subscriptions",
      "USDC",
      "amount_usdc",
      xlmUsdPrice
    ),
  ].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));

  const seriesMap = new Map<
    string,
    {
      tipsXlm: number;
      giftsUsdc: number;
      subscriptionsUsdc: number;
      totalUsdEquivalent: number;
    }
  >();

  for (const transaction of transactions) {
    const period = getPeriodKey(transaction.occurredAt, groupBy);
    const bucket = seriesMap.get(period) ?? {
      tipsXlm: 0,
      giftsUsdc: 0,
      subscriptionsUsdc: 0,
      totalUsdEquivalent: 0,
    };

    if (transaction.source === "tips") {
      bucket.tipsXlm += transaction.amount;
    } else if (transaction.source === "gifts") {
      bucket.giftsUsdc += transaction.amount;
    } else {
      bucket.subscriptionsUsdc += transaction.amount;
    }

    bucket.totalUsdEquivalent += transaction.usdEquivalent;
    seriesMap.set(period, bucket);
  }

  const sortedPeriods = Array.from(seriesMap.keys()).sort();
  const series = sortedPeriods.map(period => {
    const bucket = seriesMap.get(period)!;
    return {
      period,
      tips_xlm: toFixedXlm(bucket.tipsXlm),
      gifts_usdc: toFixedAmount(bucket.giftsUsdc),
      subscriptions_usdc: toFixedAmount(bucket.subscriptionsUsdc),
      total_usd_equivalent: toFixedAmount(bucket.totalUsdEquivalent),
    };
  });

  const totals = transactions.reduce(
    (accumulator, transaction) => {
      if (transaction.source === "tips") {
        accumulator.tipsXlm += transaction.amount;
      } else if (transaction.source === "gifts") {
        accumulator.giftsUsdc += transaction.amount;
      } else {
        accumulator.subscriptionsUsdc += transaction.amount;
      }

      accumulator.totalUsdEquivalent += transaction.usdEquivalent;
      return accumulator;
    },
    {
      tipsXlm: 0,
      giftsUsdc: 0,
      subscriptionsUsdc: 0,
      totalUsdEquivalent: 0,
    }
  );

  return {
    series,
    totals: {
      tips_xlm: toFixedXlm(totals.tipsXlm),
      gifts_usdc: toFixedAmount(totals.giftsUsdc),
      subscriptions_usdc: toFixedAmount(totals.subscriptionsUsdc),
      total_usd_equivalent: toFixedAmount(totals.totalUsdEquivalent),
    },
    transactions: transactions.map(transaction => ({
      id: transaction.id,
      source: transaction.source,
      amount:
        transaction.asset === "XLM"
          ? toFixedXlm(transaction.amount)
          : toFixedAmount(transaction.amount),
      asset: transaction.asset,
      usd_equivalent: toFixedAmount(transaction.usdEquivalent),
      occurred_at: transaction.occurredAt,
      supporter_username: transaction.supporterUsername,
    })),
  };
}

async function getSummaryWindowTotals(
  creatorId: string,
  from?: Date,
  to?: Date
): Promise<{ tipsXlm: number; giftsUsdc: number; subscriptionsUsdc: number }> {
  const [tipRows, giftRows, subscriptionRows] = await Promise.all([
    fetchTipTransactions(creatorId, from, to),
    fetchGiftTransactions(creatorId, from, to),
    fetchSubscriptionTransactions(creatorId, from, to),
  ]);

  return {
    tipsXlm: tipRows.reduce(
      (sum, row) => sum + Number.parseFloat(String(row.amount_xlm ?? 0)),
      0
    ),
    giftsUsdc: giftRows.reduce(
      (sum, row) => sum + Number.parseFloat(String(row.amount_usdc ?? 0)),
      0
    ),
    subscriptionsUsdc: subscriptionRows.reduce(
      (sum, row) => sum + Number.parseFloat(String(row.amount_usdc ?? 0)),
      0
    ),
  };
}

async function getTopSupporters(
  creatorId: string,
  xlmUsdPrice: number
): Promise<EarningsSummaryResponse["top_supporters"]> {
  const result = await sql`
    WITH supporter_totals AS (
      SELECT tt.supporter_id,
             COALESCE(u.username, 'unknown') AS username,
             SUM(tt.amount_xlm::numeric * ${xlmUsdPrice}) AS total_usd,
             MAX(tt.created_at) AS last_at
      FROM tip_transactions tt
      LEFT JOIN users u ON u.id = tt.supporter_id
      WHERE tt.creator_id = ${creatorId}
      GROUP BY tt.supporter_id, u.username

      UNION ALL

      SELECT gt.supporter_id,
             COALESCE(u.username, 'unknown') AS username,
             SUM(gt.amount_usdc::numeric) AS total_usd,
             MAX(gt.created_at) AS last_at
      FROM gift_transactions gt
      LEFT JOIN users u ON u.id = gt.supporter_id
      WHERE gt.creator_id = ${creatorId}
      GROUP BY gt.supporter_id, u.username

      UNION ALL

      SELECT s.supporter_id,
             COALESCE(u.username, 'unknown') AS username,
             SUM(s.amount_usdc::numeric) AS total_usd,
             MAX(COALESCE(s.last_charged_at, s.created_at)) AS last_at
      FROM subscriptions s
      LEFT JOIN users u ON u.id = s.supporter_id
      WHERE s.creator_id = ${creatorId}
        AND s.status IN ('active', 'completed', 'cancelled')
      GROUP BY s.supporter_id, u.username
    )
    SELECT username,
           SUM(total_usd) AS total_usd,
           MAX(last_at) AS last_at
    FROM supporter_totals
    GROUP BY username
    ORDER BY SUM(total_usd) DESC, MAX(last_at) DESC
    LIMIT 10
  `;

  return result.rows.map(row => ({
    username: String(row.username),
    total_usd: toFixedAmount(Number.parseFloat(String(row.total_usd ?? 0))),
    last_at: new Date(String(row.last_at)).toISOString(),
  }));
}

export async function getCreatorEarningsSummary(
  creatorId: string
): Promise<EarningsSummaryResponse> {
  const cacheKey = `routes-f:earnings:summary:${creatorId}`;
  const cached = await getCachedJson<EarningsSummaryResponse>(cacheKey);

  if (cached) {
    return cached;
  }

  const xlmUsdPrice = await getXlmUsdPrice();
  const now = new Date();
  const currentMonth = getMonthRange(now);
  const previousMonth = getMonthRange(addMonths(now, -1));

  const [allTime, thisMonth, lastMonth, topSupporters] = await Promise.all([
    getSummaryWindowTotals(creatorId),
    getSummaryWindowTotals(creatorId, currentMonth.from, currentMonth.to),
    getSummaryWindowTotals(creatorId, previousMonth.from, previousMonth.to),
    getTopSupporters(creatorId, xlmUsdPrice),
  ]);

  const payload = {
    all_time: buildSummaryBucket(
      allTime.tipsXlm,
      allTime.giftsUsdc,
      allTime.subscriptionsUsdc,
      xlmUsdPrice
    ),
    this_month: buildSummaryBucket(
      thisMonth.tipsXlm,
      thisMonth.giftsUsdc,
      thisMonth.subscriptionsUsdc,
      xlmUsdPrice
    ),
    last_month: buildSummaryBucket(
      lastMonth.tipsXlm,
      lastMonth.giftsUsdc,
      lastMonth.subscriptionsUsdc,
      xlmUsdPrice
    ),
    top_supporters: topSupporters,
  };

  await setCachedJson(cacheKey, payload, 300);

  return payload;
}
