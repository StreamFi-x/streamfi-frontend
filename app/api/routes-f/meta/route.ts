import { NextResponse } from "next/server";
import { ROUTES_F_ALLOWED_METHODS } from "@/lib/routes-f/schema";

type RouteMetadata = {
  path: string;
  methods: string[];
  description: string;
  requestSchema?: {
    type: string;
    properties?: Record<string, unknown>;
  };
  responseSchema?: {
    type: string;
    properties?: Record<string, unknown>;
  };
  deprecated?: boolean;
};

export async function GET() {
  const routes: RouteMetadata[] = [
    {
      path: "/api/routes-f/health",
      methods: ["GET"],
      description: "Health check endpoint",
      responseSchema: {
        type: "object",
        properties: {
          status: { type: "string" },
          version: { type: "string" },
          timestamp: { type: "string" },
        },
      },
    },
    {
      path: "/api/routes-f/audit",
      methods: ["GET"],
      description: "Get audit trail with pagination",
      responseSchema: {
        type: "object",
        properties: {
          items: { type: "array" },
          cursor: { type: "string" },
        },
      },
    },
    {
      path: "/api/routes-f/search",
      methods: ["GET"],
      description: "Search routes-f records",
      responseSchema: {
        type: "object",
        properties: {
          total: { type: "number" },
          items: { type: "array" },
        },
      },
    },
    {
      path: "/api/routes-f/validate",
      methods: ["POST"],
      description: "Validate a routes-f record",
      requestSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          path: { type: "string" },
          method: { type: "string", enum: ROUTES_F_ALLOWED_METHODS },
          priority: { type: "number" },
          enabled: { type: "boolean" },
          tags: { type: "array" },
          metadata: { type: "object" },
        },
      },
      responseSchema: {
        type: "object",
        properties: {
          isValid: { type: "boolean" },
          errors: { type: "array" },
          warnings: { type: "array" },
        },
      },
    },
    {
      path: "/api/routes-f/import",
      methods: ["POST"],
      description: "Import multiple routes-f records",
      requestSchema: {
        type: "array",
      },
      responseSchema: {
        type: "object",
        properties: {
          imported: { type: "number" },
          failed: { type: "number" },
          results: { type: "array" },
          message: { type: "string" },
        },
      },
    },
    {
      path: "/api/routes-f/export",
      methods: ["GET"],
      description: "Export routes-f records as JSON or CSV",
      responseSchema: {
        type: "array",
      },
    },
    {
      path: "/api/routes-f/preferences",
      methods: ["GET", "POST"],
      description: "Get or update user preferences",
      requestSchema: {
        type: "object",
      },
      responseSchema: {
        type: "object",
        properties: {
          userId: { type: "string" },
          preferences: { type: "object" },
        },
      },
    },
    {
      path: "/api/routes-f/webhook",
      methods: ["POST"],
      description: "Receive webhook events with signature validation",
      requestSchema: {
        type: "object",
      },
      responseSchema: {
        type: "object",
        properties: {
          received: { type: "boolean" },
        },
      },
    },
    {
      path: "/api/routes-f/flags",
      methods: ["GET"],
      description: "Get feature flags",
      responseSchema: {
        type: "object",
        properties: {
          flags: { type: "object" },
          userId: { type: "string" },
        },
      },
    },
    {
      path: "/api/routes-f/metrics",
      methods: ["GET"],
      description: "Get metrics snapshot",
      responseSchema: {
        type: "object",
      },
    },
    {
      path: "/api/routes-f/maintenance",
      methods: ["GET", "POST"],
      description: "Get or create maintenance windows",
      requestSchema: {
        type: "object",
        properties: {
          start: { type: "string" },
          end: { type: "string" },
          reason: { type: "string" },
        },
      },
      responseSchema: {
        type: "object",
      },
    },
    {
      path: "/api/routes-f/items/:id",
      methods: ["GET", "PATCH", "DELETE"],
      description: "Get, update, or delete a specific item",
      requestSchema: {
        type: "object",
      },
      responseSchema: {
        type: "object",
      },
    },
    {
      path: "/api/routes-f/jobs/:id",
      methods: ["GET"],
      description: "Get job status by ID",
      responseSchema: {
        type: "object",
      },
    },
    {
      path: "/api/routes-f/meta",
      methods: ["GET"],
      description: "Get metadata for all routes-f endpoints",
      responseSchema: {
        type: "object",
        properties: {
          routes: { type: "array" },
        },
      },
    },
  ];

  return NextResponse.json({ routes }, { status: 200 });
}
