import nodemailer from "nodemailer";
import { render } from "@react-email/render";
import TipReceivedEmail from "@/components/templates/TipReceivedEmail";

interface SendTipReceivedNotificationEmailInput {
  email: string;
  username: string;
  amount: string;
  senderLabel: string;
}

function createTransport() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user,
      pass,
    },
  });
}

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "https://streamfi.xyz";
}

export async function sendTipReceivedNotificationEmail(
  input: SendTipReceivedNotificationEmailInput
) {
  const transporter = createTransport();

  if (!transporter) {
    console.warn("[notifications] Email transporter not configured");
    return;
  }

  const html = await render(
    TipReceivedEmail({
      username: input.username,
      amount: input.amount,
      senderLabel: input.senderLabel,
      dashboardUrl: `${getBaseUrl()}/dashboard/payout`,
    })
  );

  await transporter.sendMail({
    from: {
      name: "StreamFi",
      address: process.env.EMAIL_USER || "support@streamfi.xyz",
    },
    to: input.email,
    subject: `You received ${input.amount} XLM on StreamFi`,
    html,
  });
}
