/* eslint-disable @typescript-eslint/no-explicit-any */
import { rateLimit } from "../../../../utils/rate-limit"; 
import { validateEmail } from "../../../../utils/validators";
import { sql } from '@vercel/postgres';

// Rate limiter: 5 requests per minute so as not to abuse it
const limiter = rateLimit({
  interval: 60 * 1000, 
//   uniqueTokenPerInterval: 500,
//   max: 5,
});

 async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await limiter.check(res, 5, "UNSUBSCRIBE_RATE_LIMIT");
  } catch {
    return res.status(429).json({ error: "Rate limit exceeded" });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  if (!validateEmail(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  try {
    const checkExisting = await sql`
      SELECT * FROM waitlist 
      WHERE email = ${email} AND unsubscribed_at IS NULL
    `;

    if (checkExisting.rows.length === 0) {
      return res.status(404).json({ error: "Email not found or already unsubscribed" });
    }

    await sql`
      UPDATE waitlist 
      SET unsubscribed_at = NOW(), updated_at = NOW() 
      WHERE email = ${email}
    `;

    return res.status(200).json({ message: "Successfully unsubscribed" });
  } catch (error) {
    console.error("Unsubscribe error:", error);
    return res.status(500).json({ error: "Failed to process unsubscription" });
  }
}

export {handler as POST, handler as GET};