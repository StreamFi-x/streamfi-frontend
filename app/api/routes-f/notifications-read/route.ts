import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

type NotificationRecord = {
  id: string;
  viewer_id: string;
  read: boolean;
};

let notifications: NotificationRecord[] = [
  { id: "n_001", viewer_id: "viewer_001", read: false },
  { id: "n_002", viewer_id: "viewer_001", read: false },
  { id: "n_003", viewer_id: "viewer_001", read: true },
  { id: "n_004", viewer_id: "viewer_001", read: false },
  { id: "n_101", viewer_id: "viewer_002", read: false },
  { id: "n_102", viewer_id: "viewer_002", read: false },
];

export function __resetNotificationsRead(): void {
  notifications = [
    { id: "n_001", viewer_id: "viewer_001", read: false },
    { id: "n_002", viewer_id: "viewer_001", read: false },
    { id: "n_003", viewer_id: "viewer_001", read: true },
    { id: "n_004", viewer_id: "viewer_001", read: false },
    { id: "n_101", viewer_id: "viewer_002", read: false },
    { id: "n_102", viewer_id: "viewer_002", read: false },
  ];
}

const bodySchema = z.object({
  viewer_id: z.string().min(1),
  ids: z.array(z.string()).optional(),
  all: z.boolean().optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const bodyResult = await validateBody(req, bodySchema);
  if (bodyResult instanceof NextResponse) return bodyResult;

  const { viewer_id, ids, all } = bodyResult.data;

  let updated_count = 0;

  for (const n of notifications) {
    if (n.viewer_id !== viewer_id) continue;
    if (n.read) continue;
    if (all || (ids && ids.includes(n.id))) {
      n.read = true;
      updated_count++;
    }
  }

  return NextResponse.json({ updated_count });
}