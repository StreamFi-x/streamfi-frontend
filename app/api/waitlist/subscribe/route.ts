/* eslint-disable @typescript-eslint/no-explicit-any */
import { rateLimit } from "../../../../utils/rate-limit";
import { validateEmail } from "../../../../utils/validators";
import { sendWelcomeEmail } from "../../send-email/route";
import { sql } from '@vercel/postgres';

// Rate limiter: 5 requests per minute
const limiter = rateLimit({
  interval: 60 * 1000, 
  //uniqueTokenPerInterval: 500,
//   max: 5,
});

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await limiter.check(res, 5, "SUBSCRIBE_RATE_LIMIT");
  } catch {
    return res.status(429).json({ error: "Rate limit exceeded" });
  }

  const { email, name } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  if (!validateEmail(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  try {
    // Check if user already exists
    const checkExisting = await sql`
      SELECT * FROM waitlist WHERE email = ${email}
    `;

    if (checkExisting.rows.length > 0) {
      const subscriber = checkExisting.rows[0];

      if (!subscriber.unsubscribed_at) {
        return res.status(200).json({ message: "Already subscribed", alreadySubscribed: true });
      }

      // Resubscribing user if they had unsubscribed
      await sql`
        UPDATE waitlist 
        SET unsubscribed_at = NULL, updated_at = NOW() 
        WHERE email = ${email}
      `;
    } else {
      // Inserting new subscriber
      await sql`
        INSERT INTO waitlist (email, name) 
        VALUES (${email}, ${name || null})
      `;
    }
    
    // Send welcome email
    await sendWelcomeEmail(email, name);

    return res.status(200).json({ message: "Subscription successful. Welcome email sent." });
  } catch (error) {
    console.error("Subscription error:", error);
    return res.status(500).json({ error: "Failed to process subscription" });
  }
}