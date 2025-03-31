import { rateLimit } from "../../utils/rate-limit";
import { validateEmail } from "../../utils/validators";
import { sendWelcomeEmail } from "../../utils/email-service"; 
import { Pool } from "@neondatabase/serverless";

// Rate limiter: 5 requests per minute
const limiter = rateLimit({
  interval: 60 * 1000, 
  uniqueTokenPerInterval: 500,
  max: 5,
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
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
    
    const checkExisting = await pool.query("SELECT * FROM subscribers WHERE email = $1", [email]);

    if (checkExisting.rowCount > 0) {
      const subscriber = checkExisting.rows[0];

      if (!subscriber.unsubscribed_at) {
        return res.status(200).json({ message: "Already subscribed", alreadySubscribed: true });
      }

      // Resubscribing user if they had unsubscribed
      await pool.query(
        "UPDATE subscribers SET unsubscribed_at = NULL, updated_at = NOW() WHERE email = $1",
        [email]
      );
    } else {
      // Inserting new subscriber
      await pool.query(
        "INSERT INTO subscribers (email, name) VALUES ($1, $2)",
        [email, name || null]
      );
    }

    
    await sendWelcomeEmail(email, name);

    return res.status(200).json({ message: "Subscription successful. Welcome email sent." });
  } catch (error) {
    console.error("Subscription error:", error);
    return res.status(500).json({ error: "Failed to process subscription" });
  }
}

