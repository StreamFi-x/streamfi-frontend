import { z } from "zod";

// Define the schema for environment variables
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Authentication
  NEXTAUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url(),

  // API Keys
  LIVEPEER_API_KEY: z.string().min(1),
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),

  // Email
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.string().transform(Number),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),

  // Optional variables
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  ANALYZE: z.string().optional(),
});

// Validate environment variables
const envParse = envSchema.safeParse(process.env);

if (!envParse.success) {
  // eslint-disable-next-line no-console
  console.error("❌ Invalid environment variables:");
  // eslint-disable-next-line no-console
  console.error(envParse.error.format());
  throw new Error("Invalid environment variables");
}

// Export validated environment variables
export const env = envParse.data;

// Type for environment variables
export type Env = z.infer<typeof envSchema>;
