// SPDX-License-Identifier: MIT

import { rateLimit } from "../../../../utils/rate-limit";
import { validateEmail } from "../../../../utils/validators";
import { sql } from "@vercel/postgres";

const limiter = rateLimit({
  interval: 60 * 1000,
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
