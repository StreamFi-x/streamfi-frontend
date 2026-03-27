import { verifyAdminSession, adminUnauthorized } from "@/lib/admin-auth";

export async function GET(): Promise<Response> {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) {
    return adminUnauthorized();
  }
  return Response.json({ ok: true });
}
