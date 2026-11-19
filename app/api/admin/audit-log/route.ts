import { authorizeAdmin } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";
import { queryAdminEvents } from "@/lib/audit/admin-events";

export async function GET(request: NextRequest): Promise<Response> {
  const { response } = await authorizeAdmin(request, "admin/audit-log");
  if (response) {
    return response;
  }

  const params = request.nextUrl.searchParams;
  try {
    const result = await queryAdminEvents({
      actorId: params.get("actor"),
      targetId: params.get("target"),
      from: params.get("from"),
      to: params.get("to"),
      cursor: params.get("cursor"),
      limit: Number(params.get("limit") ?? 50),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[admin/audit-log] query failed", error);
    return NextResponse.json(
      { error: "Unable to load audit log" },
      { status: 500 }
    );
  }
}
