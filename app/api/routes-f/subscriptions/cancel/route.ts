import { NextRequest, NextResponse } from "next/server";
import { subscriptions } from "../route";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { subscription_id, subscriber_id } = body;
  if (!subscription_id || !subscriber_id) {
    return NextResponse.json(
      { error: "subscription_id and subscriber_id are required" },
      { status: 400 }
    );
  }

  const sub = subscriptions.get(subscription_id);
  if (!sub) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }

  if (sub.subscriber_id !== subscriber_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Mark status='cancelled' but keep expires_at intact
  const updatedSub = {
    ...sub,
    status: "cancelled" as const,
  };
  subscriptions.set(subscription_id, updatedSub);

  return NextResponse.json(updatedSub);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const subscriptionId = searchParams.get("subscription_id");
  if (!subscriptionId) {
    return NextResponse.json({ error: "subscription_id is required" }, { status: 400 });
  }

  const sub = subscriptions.get(subscriptionId);
  if (!sub) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }

  return NextResponse.json(sub);
}
