import { requireAdminSession } from "@/lib/admin-auth";

export async function GET(): Promise<Response> {
  const adminDenied = await requireAdminSession("admin/me");
  if (adminDenied) {
    return adminDenied;
  }
  return Response.json({ ok: true });
}
