import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { sql } from "@vercel/postgres";
import { logger } from "@/lib/tracing/logger";
import { getCurrentTraceContext } from "@/lib/tracing/trace-context";
import {
  apiBadRequest,
  apiInternalError,
  apiMethodNotAllowed,
  apiSuccess,
  apiValidationError,
} from "@/lib/api";

const bodySchema = z.object({
  fiat_amount_cents: z
    .number()
    .int()
    .positive("fiat_amount_cents must be a positive integer"),
  creator_id: z.string().uuid("creator_id must be a valid UUID"),
});

const QUOTE_TTL_SECONDS = 300; // 5 minutes

export async function POST(req: NextRequest): Promise<NextResponse> {
  const traceContext = getCurrentTraceContext();
  const traceId = traceContext?.traceId;
  const traceHeaders = { "x-request-id": traceId || "" };

  try {
    logger.info("Quote request received", {
      endpoint: "POST /api/tips/get-quote",
    });

    // 1. Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      logger.warn("Invalid JSON body", {
        endpoint: "POST /api/tips/get-quote",
      });
      return apiBadRequest("Invalid JSON body", { headers: traceHeaders });
    }

    const validation = bodySchema.safeParse(body);
    if (!validation.success) {
      logger.warn("Request validation failed", {
        errors: validation.error.issues.map(i => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
      return apiValidationError(
        "Invalid request body",
        validation.error.issues.map(i => ({
          field: i.path.join("."),
          message: i.message,
        })),
        { headers: traceHeaders }
      );
    }

    const { fiat_amount_cents, creator_id } = validation.data;

    logger.info("Request validated", {
      fiat_amount_cents,
      creator_id: creator_id.substring(0, 8),
    });

    // 2. Fetch current XLM/USD rate from the prices endpoint
    logger.debug("Fetching current XLM/USD rate");

    let xlmRate: number;
    try {
      const pricesResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/prices/xlm`,
        { headers: { Accept: "application/json" } }
      );

      if (!pricesResponse.ok) {
        throw new Error(`Prices endpoint returned ${pricesResponse.status}`);
      }

      const pricesData = (await pricesResponse.json()) as {
        price: number;
        stale?: boolean;
      };
      xlmRate = pricesData.price;

      if (!xlmRate || xlmRate <= 0) {
        throw new Error("Invalid price data received");
      }

      logger.info("XLM/USD rate fetched", {
        rate: xlmRate,
        stale: pricesData.stale || false,
      });
    } catch (error) {
      logger.error("Failed to fetch XLM/USD rate", {
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return apiInternalError("Failed to fetch exchange rate", {
        headers: traceHeaders,
      });
    }

    // 3. Compute quoted XLM amount: fiat_cents / 100 / rate, rounded to 7 decimals
    const fiatDollars = fiat_amount_cents / 100;
    const quotedXlmAmount = parseFloat((fiatDollars / xlmRate).toFixed(7));

    logger.debug("Computed quoted XLM amount", {
      fiatDollars,
      xlmRate,
      quotedXlmAmount,
    });

    // 4. Generate cryptographically secure quote token
    const quoteToken = randomBytes(32).toString("hex");

    logger.debug("Generated quote token", {
      tokenLength: quoteToken.length,
    });

    // 5. Calculate expiry time
    const now = new Date();
    const expiresAt = new Date(now.getTime() + QUOTE_TTL_SECONDS * 1000);

    // 6. Insert quote into database
    logger.debug("Inserting quote into database", {
      creator_id,
      fiat_amount_cents,
      quotedXlmAmount,
      expiresAt: expiresAt.toISOString(),
    });

    let quoteId: string;
    try {
      const result = await sql`
        INSERT INTO exchange_rate_quotes (
          creator_id,
          quoted_rate,
          quoted_xlm_amount,
          fiat_amount_cents,
          quote_token,
          expires_at,
          status
        )
        VALUES (
          ${creator_id},
          ${xlmRate},
          ${quotedXlmAmount},
          ${fiat_amount_cents},
          ${quoteToken},
          ${expiresAt.toISOString()},
          'issued'
        )
        RETURNING id
      `;

      if (!result.rows[0] || !result.rows[0].id) {
        throw new Error("Quote insertion did not return an id");
      }

      quoteId = result.rows[0].id as string;
      logger.info("Quote inserted successfully", {
        quoteId: quoteId.substring(0, 8),
      });
    } catch (error) {
      logger.error("Failed to insert quote into database", {
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return apiInternalError("Failed to create quote", {
        headers: traceHeaders,
      });
    }

    // 7. Return the quote response
    return apiSuccess(
      {
        quote_token: quoteToken,
        quote_id: quoteId,
        quoted_rate: xlmRate,
        quoted_xlm_amount: quotedXlmAmount,
        fiat_amount_cents,
        expires_at: expiresAt.toISOString(),
        ttl_seconds: QUOTE_TTL_SECONDS,
        requestId: traceId,
      },
      {
        meta: traceId ? { requestId: traceId } : undefined,
        headers: {
          ...traceHeaders,
          "Cache-Control": "private, no-store",
        },
        legacyFlat: true,
      }
    );
  } catch (error) {
    logger.error("Unhandled error in get-quote endpoint", {
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    return apiInternalError("Internal server error", {
      meta: traceId ? { requestId: traceId } : undefined,
      legacyExtra: traceId ? { requestId: traceId } : undefined,
      headers: traceHeaders,
    });
  }
}

// Only POST is supported
export async function GET() {
  return apiMethodNotAllowed("POST");
}
