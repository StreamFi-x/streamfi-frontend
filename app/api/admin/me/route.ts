import type { NextRequest } from "next/server";
import { authorizeAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest): Promise<Response> {
  const { response: adminDenied } = await authorizeAdmin(req, "admin/me");
  if (adminDenied) {
    return adminDenied;
  }
  return Response.json({ ok: true });
}
