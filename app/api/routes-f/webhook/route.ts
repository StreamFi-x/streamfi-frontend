import crypto from "crypto";
import { withRoutesFLogging, hashPayload } from "@/lib/routes-f/logging";
import { routesFSuccess, routesFError } from "../../routesF/response";

const ROUTES_F_WEBHOOK_SECRET =
  process.env.ROUTES_F_WEBHOOK_SECRET || "";

const webhookStore: Array<{
  receivedAt: string;
  requestHash: string;
  payload: unknown;
}> = [];

function timingSafeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function isValidSignature(signatureHeader: string | null, body: string) {
  if (!ROUTES_F_WEBHOOK_SECRET || !signatureHeader) {
    return false;
  }

  const rawSignature = signatureHeader.startsWith("sha256=")
    ? signatureHeader.replace("sha256=", "")
    : signatureHeader;

  const expected = crypto
    .createHmac("sha256", ROUTES_F_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");

  return timingSafeEqual(rawSignature, expected);
}

export async function POST(req: Request) {
  return withRoutesFLogging(req, async (request) => {
    const bodyText = await request.text();
    const signature = request.headers.get("x-signature");

    if (!isValidSignature(signature, bodyText)) {
      return routesFError("Invalid signature", 401);
    }

    let payload: unknown = null;
    if (bodyText.trim().length > 0) {
      try {
        payload = JSON.parse(bodyText);
      } catch {
        payload = { raw: bodyText };
      }
    }

    const requestHash = hashPayload(bodyText);
    webhookStore.unshift({
      receivedAt: new Date().toISOString(),
      requestHash,
      payload,
    });

    if (webhookStore.length > 50) {
      webhookStore.pop();
    }

    console.log("[routes-f] webhook received", {
      requestHash,
      bytes: bodyText.length,
      stored: true,
    });

    return routesFSuccess({ received: true }, 200);
  });
}