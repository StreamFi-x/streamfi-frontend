import {
  getRoutesFRecordById,
  updateRoutesFRecord,
  deleteRoutesFRecord,
} from "@/lib/routes-f/store";
import { routesFSuccess, routesFError } from "../../../routesF/response"

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const resolvedParams = await Promise.resolve(params);
  const { id } = resolvedParams;

  // Validate ID format (must start with rf-)
  if (!id.startsWith("rf-")) {
    return routesFError("Invalid ID format", 400);
  }

  const deleted = deleteRoutesFRecord(id);

  if (!deleted) {
    return routesFError("Item not found", 404);
  }

  // 204 No Content response
  return new Response(null, { status: 204 });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const resolvedParams = await Promise.resolve(params);
  const { id } = resolvedParams;

  const ifMatch = req.headers.get("if-match");
  if (!ifMatch) {
    return routesFError("If-Match header is missing", 428);
  }

  let updates;
  try {
    updates = await req.json();
  } catch {
    return routesFError("Invalid JSON body", 400);
  }

  try {
    const updated = updateRoutesFRecord(id, updates, ifMatch);

    if (!updated) {
      return routesFError("Item not found", 404);
    }

    const headers = new Headers();
    if (updated.etag) {
      headers.set("ETag", updated.etag);
    }

    return routesFSuccess(updated, 200, headers);
  } catch (e: any) {
    if (e.message === "ETAG_MISMATCH") {
      return routesFError("ETag mismatch", 412);
    }
    return routesFError("Internal Server Error", 500);
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const resolvedParams = await Promise.resolve(params);
  const { id } = resolvedParams;

  const record = getRoutesFRecordById(id);
  if (!record) {
    return routesFError("Item not found", 404);
  }

  const headers = new Headers();
  const etag = record.etag || `"${record.updatedAt || record.createdAt}"`;
  headers.set("ETag", etag);

  return routesFSuccess(record, 200, headers);
}