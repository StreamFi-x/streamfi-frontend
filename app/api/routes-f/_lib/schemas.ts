/**
 * Shared Zod schemas reused across routes-f endpoints.
 *
 * Import individual schemas or the full `schemas` object:
 *   import { usernameSchema, paginationSchema } from "@/app/api/routes-f/_lib/schemas";
 */

import { z } from "zod";

export const stellarPublicKeySchema = z
  .string()
  .regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar public key");

export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be at most 30 characters")
  .regex(
    /^[a-zA-Z0-9_]+$/,
    "Username may only contain letters, numbers and underscores"
  );

export const usdcAmountSchema = z
  .string()
  .regex(
    /^\d+(\.\d{1,2})?$/,
    "Amount must be a number with up to 2 decimal places"
  )
  .refine(v => parseFloat(v) > 0, "Amount must be greater than 0");

export const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export const periodSchema = z.enum(["7d", "30d", "90d", "all"]);

export const emailSchema = z
  .string()
  .email("Invalid email address")
  .max(255, "Email must be at most 255 characters");

export const urlSchema = z
  .string()
  .url("Invalid URL")
  .max(2048, "URL must be at most 2048 characters");

export const uuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "Invalid UUID"
  );
