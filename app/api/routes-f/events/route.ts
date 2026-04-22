import { NextRequest, NextResponse } from "next/server";
import { EventSubmissionSchema, PaginationParamsSchema } from "./_lib/schema";
import { eventBuffer } from "./_lib/buffer";
import { ApiResponse, PaginatedEvents } from "./_lib/types";

// POST /api/routes-f/events - Accept single or batched events
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate the request body
    const validationResult = EventSubmissionSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Validation failed: " + validationResult.error.errors
            .map((e: any) => `${e.path.join('.')}: ${e.message}`)
            .join(", "),
        },
        { status: 400 }
      );
    }

    const { event, events } = validationResult.data;
    
    // Add events to buffer
    if (event) {
      eventBuffer.addEvents([event]);
    } else if (events) {
      eventBuffer.addEvents(events);
    }

    return NextResponse.json<ApiResponse>(
      { success: true, data: { received: event ? 1 : events?.length || 0 } },
      { status: 201 }
    );
  } catch (error) {
    // Log error for debugging (eslint-disable-next-line no-console)
    console.error("[events] POST error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/routes-f/events - Return recent events with pagination
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    // Parse pagination parameters
    const paginationParams = PaginationParamsSchema.parse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    });

    const result = eventBuffer.getEvents(paginationParams);

    return NextResponse.json<ApiResponse<PaginatedEvents>>(
      { success: true, data: result },
      { status: 200 }
    );
  } catch (error) {
    // Log error for debugging (eslint-disable-next-line no-console)
    console.error("[events] GET error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
