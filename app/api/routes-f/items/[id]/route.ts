import { NextResponse } from "next/server";

// Mock data for Routes-F items
const MOCK_ITEMS = [
    {
        id: "1",
        name: "Standard Fast Route",
        description: "High-speed data transfer route optimized for low latency.",
        status: "active",
        capacity: "10Gbps",
    },
    {
        id: "2",
        name: "Secure Tunnel F",
        description: "Encrypted route for sensitive financial transactions.",
        status: "active",
        capacity: "5Gbps",
    },
    {
        id: "3",
        name: "Bulk Storage Path",
        description: "High-capacity route for large-scale data migrations.",
        status: "maintenance",
        capacity: "100Gbps",
    },
];

/**
 * GET /api/routes-f/items/[id]
 * Returns a single Routes-F item by ID.
 */
export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    const { id } = params;

    // 1. Missing id returns 404
    if (!id) {
        return NextResponse.json(
            { error: "Routes-F item ID is missing." },
            { status: 404 }
        );
    }

    // 2. Validate ID format (must be numeric). Invalid id returns 400.
    if (!/^\d+$/.test(id)) {
        return NextResponse.json(
            { error: "Invalid ID format. ID must be a numeric string." },
            { status: 400 }
        );
    }

    // 3. Find the item. Returns item or 404.
    const item = MOCK_ITEMS.find((i) => i.id === id);

    if (!item) {
        return NextResponse.json(
            { error: "Routes-F item not found." },
            { status: 404 }
        );
    }

    // 3. Generate ETag for cacheability
    // Using a simple hash of the stringified item content
    const contentString = JSON.stringify(item);
    const etag = `W/"${Buffer.from(contentString).toString("base64").substring(0, 20)}"`;

    // 4. Return response with ETag header
    return NextResponse.json(item, {
        status: 200,
        headers: {
            ETag: etag,
            "Cache-Control": "public, max-age=3600",
        },
    });
}
