import { createHmac } from "crypto";
import { rateLimit } from "../../../../utils/rate-limit";
import { validateEmail } from "../../../../utils/validators";
import { sql } from "@vercel/postgres";

const limiter = rateLimit({
  interval: 60 * 1000,
});

/**
 * Generate a deterministic verification token for a subscriber email (#1728).
 * Ensures unsubscribing requires possession of the unique link/token sent to that address.
 */
export function generateUnsubscribeToken(email: string): string {
  const secret =
    process.env.WAITLIST_UNSUBSCRIBE_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "streamfi-waitlist-unsubscribe-token";
  return createHmac("sha256", secret).update(email.toLowerCase().trim()).digest("hex");
}

export async function POST(req: Request) {
  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    // If not json, fall back to empty
  }

  const url = new URL(req.url);
  const email = (body.email || url.searchParams.get("email") || "").trim().toLowerCase();
  const token = (body.token || url.searchParams.get("token") || "").trim();

  if (!email) {
    return new Response(JSON.stringify({ error: "Email is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!validateEmail(email)) {
    return new Response(JSON.stringify({ error: "Invalid email format" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!token) {
    return new Response(
      JSON.stringify({ error: "Verification token is required to unsubscribe" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    // Use email as token for rate-limiting
    await limiter.check(
      {
        setHeader: () => {},
      },
      5,
      email
    );
  } catch {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { rows } = await sql`
      SELECT id, email, unsubscribed_at FROM subscribers 
      WHERE LOWER(email) = ${email}
      LIMIT 1
    `;

    if (rows.length === 0 || rows[0].unsubscribed_at) {
      return new Response(
        JSON.stringify({ error: "Email not found or already unsubscribed" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const subscriber = rows[0];
    const expectedToken = generateUnsubscribeToken(email);
    const isTokenValid = token === subscriber.id || token === expectedToken;

    if (!isTokenValid) {
      return new Response(
        JSON.stringify({ error: "Invalid or unauthorized unsubscribe token" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    await sql`
      UPDATE subscribers 
      SET unsubscribed_at = NOW(), updated_at = NOW() 
      WHERE LOWER(email) = ${email}
    `;

    return new Response(
      JSON.stringify({ success: true, message: "Successfully unsubscribed" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unsubscribe error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process unsubscription" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function GET(req: Request) {
  return POST(req);
}
