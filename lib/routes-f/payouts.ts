import { sql } from "@vercel/postgres";
import nodemailer from "nodemailer";
import { Horizon } from "@stellar/stellar-sdk";
import { getHorizonUrl, getStellarNetwork } from "@/lib/stellar/config";
import { toFixedAmount } from "@/lib/routes-f/format";

export const PAYOUT_METHODS = [
  "bank_transfer",
  "stellar_wallet",
  "mobile_money",
] as const;

export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

function createTransporter() {
  return nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

export async function getUsdcBalance(walletAddress: string): Promise<number> {
  const server = new Horizon.Server(getHorizonUrl(getStellarNetwork()));
  const account = await server.loadAccount(walletAddress);

  const usdcBalance = account.balances.find(balance => {
    return (
      balance.asset_type === "credit_alphanum4" && balance.asset_code === "USDC"
    );
  });

  return Number.parseFloat(usdcBalance?.balance ?? "0");
}

export async function sendPayoutConfirmationEmail(params: {
  email: string;
  username: string | null;
  amountUsdc: string;
  method: PayoutMethod;
  destination: string;
}): Promise<void> {
  if (!params.email || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return;
  }

  const transporter = createTransporter();
  await transporter.sendMail({
    from: {
      name: "StreamFi",
      address: process.env.EMAIL_USER,
    },
    to: params.email,
    subject: "StreamFi payout request received",
    html: `
      <p>Hello ${params.username ?? "creator"},</p>
      <p>We received your payout request for <strong>${params.amountUsdc} USDC</strong>.</p>
      <p>Method: ${params.method}</p>
      <p>Destination: ${params.destination}</p>
      <p>Our team has been notified and will process it shortly.</p>
    `,
  });
}

export async function notifyAdminOfPayout(params: {
  username: string | null;
  userId: string;
  amountUsdc: string;
  method: PayoutMethod;
  destination: string;
}): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL ?? process.env.EMAIL_USER;
  if (!adminEmail || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return;
  }

  const transporter = createTransporter();
  await transporter.sendMail({
    from: {
      name: "StreamFi",
      address: process.env.EMAIL_USER,
    },
    to: adminEmail,
    subject: "New StreamFi payout request",
    html: `
      <p>A new payout request is pending manual processing.</p>
      <ul>
        <li>User: ${params.username ?? "unknown"}</li>
        <li>User ID: ${params.userId}</li>
        <li>Amount: ${params.amountUsdc} USDC</li>
        <li>Method: ${params.method}</li>
        <li>Destination: ${params.destination}</li>
      </ul>
    `,
  });
}

export async function getPayoutHistory(userId: string) {
  const [{ rows: payouts }, { rows: totalRows }] = await Promise.all([
    sql`
      SELECT id, amount_usdc, fee_usdc, net_usdc, method, destination, status,
             initiated_at, completed_at, provider, provider_ref, notes
      FROM payouts
      WHERE user_id = ${userId}
      ORDER BY initiated_at DESC
    `,
    sql`
      SELECT COALESCE(SUM(net_usdc), 0) AS total_paid_out_usdc
      FROM payouts
      WHERE user_id = ${userId}
        AND status = 'completed'
    `,
  ]);

  return {
    payouts: payouts.map(row => ({
      id: String(row.id),
      amount_usdc: toFixedAmount(
        Number.parseFloat(String(row.amount_usdc ?? 0))
      ),
      fee_usdc: toFixedAmount(Number.parseFloat(String(row.fee_usdc ?? 0))),
      net_usdc: toFixedAmount(Number.parseFloat(String(row.net_usdc ?? 0))),
      method: String(row.method),
      destination: String(row.destination),
      status: String(row.status),
      initiated_at: new Date(String(row.initiated_at)).toISOString(),
      completed_at: row.completed_at
        ? new Date(String(row.completed_at)).toISOString()
        : null,
      provider: row.provider ?? null,
      provider_ref: row.provider_ref ?? null,
      notes: row.notes ?? null,
    })),
    total_paid_out_usdc: toFixedAmount(
      Number.parseFloat(String(totalRows[0]?.total_paid_out_usdc ?? 0))
    ),
  };
}

export async function getSinglePayout(userId: string, payoutId: string) {
  const result = await sql`
    SELECT id, amount_usdc, fee_usdc, net_usdc, method, destination, status,
           initiated_at, completed_at, provider, provider_ref, notes
    FROM payouts
    WHERE id = ${payoutId}::uuid AND user_id = ${userId}
    LIMIT 1
  `;

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: String(row.id),
    amount_usdc: toFixedAmount(Number.parseFloat(String(row.amount_usdc ?? 0))),
    fee_usdc: toFixedAmount(Number.parseFloat(String(row.fee_usdc ?? 0))),
    net_usdc: toFixedAmount(Number.parseFloat(String(row.net_usdc ?? 0))),
    method: String(row.method),
    destination: String(row.destination),
    status: String(row.status),
    initiated_at: new Date(String(row.initiated_at)).toISOString(),
    completed_at: row.completed_at
      ? new Date(String(row.completed_at)).toISOString()
      : null,
    provider: row.provider ?? null,
    provider_ref: row.provider_ref ?? null,
    notes: row.notes ?? null,
  };
}
