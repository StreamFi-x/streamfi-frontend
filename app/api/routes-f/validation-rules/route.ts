import { jsonResponse } from "@/lib/routes-f/version";
import { ROUTES_F_ALLOWED_METHODS } from "@/lib/routes-f/schema";

/**
 * GET /api/routes-f/validation-rules
 * Returns field-level validation metadata for Routes-F items.
 */
export async function GET() {
    const rules = {
        name: {
            type: "string",
            required: true,
            constraints: {
                minLength: 1,
                maxLength: 100,
            },
        },
        path: {
            type: "string",
            required: true,
            constraints: {
                minLength: 1,
                maxLength: 200,
                pattern: "^/",
            },
        },
        method: {
            type: "enum",
            required: true,
            constraints: {
                enum: ROUTES_F_ALLOWED_METHODS,
            },
        },
        priority: {
            type: "number",
            required: false,
            constraints: {
                min: 0,
                max: 100,
            },
        },
        enabled: {
            type: "boolean",
            required: false,
            constraints: {},
        },
        tags: {
            type: "array",
            required: false,
            constraints: {
                maxItems: 8,
            },
        },
        metadata: {
            type: "object",
            required: false,
            constraints: {},
        },
    };

    return jsonResponse(rules, { status: 200 });
}
