// SPDX-License-Identifier: MIT

import { createRateLimit } from "@/lib/rate-limit";
import { validateEmail } from "../../../../utils/validators";
import { sql } from "@vercel/postgres";

const limiter = createRateLimit({
  namespace: "waitlist:unsubscribe",
  limit: 5,
  windowMs: 60 * 1000,
});

export async function POST(req: Request) {
  const body = await req.json();
  const email = body.email;

  if (!email) {
    return new Response(JSON.stringify({ error: "Email is required" }), {
      status: 400,
    });
  }

  if (!validateEmail(email)) {
    return new Response(JSON.stringify({ error: "Invalid email format" }), {
      status: 400,
    });
  }

  const result = await limiter.check(email);
  if (!result.success) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
      },
    });
  }

  try {
    const checkExisting = await sql`
      SELECT * FROM subscribers 
      WHERE email = ${email} AND unsubscribed_at IS NULL
    `;

    if (checkExisting.rows.length === 0) {
      return new Response(
        JSON.stringify({ error: "Email not found or already unsubscribed" }),
        {
          status: 404,
        }
      );
    }

    await sql`
      UPDATE subscribers 
      SET unsubscribed_at = NOW(), updated_at = NOW() 
      WHERE email = ${email}
    `;

    return new Response(
      JSON.stringify({ message: "Successfully unsubscribed" }),
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("Unsubscribe error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process unsubscription" }),
      {
        status: 500,
      }
    );
  }
}
