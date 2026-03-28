import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { listUnreadNotificationsSince } from "@/lib/notifications";
import type { NotificationCursor } from "@/types/notifications";

const encoder = new TextEncoder();
const initialCursorId = "00000000-0000-0000-0000-000000000000";

function encodeSseChunk(payload: string) {
  return encoder.encode(payload);
}

export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let cursor: NotificationCursor = {
        createdAt: new Date().toISOString(),
        id: initialCursorId,
      };

      const close = () => {
        if (closed) {
          return;
        }

        closed = true;
        clearInterval(intervalId);
        req.signal.removeEventListener("abort", close);
        controller.close();
      };

      const poll = async () => {
        try {
          const notifications = await listUnreadNotificationsSince(
            session.userId,
            cursor,
            50
          );

          if (notifications.length === 0) {
            controller.enqueue(encodeSseChunk(": keep-alive\n\n"));
            return;
          }

          for (const notification of notifications) {
            controller.enqueue(
              encodeSseChunk(`data: ${JSON.stringify(notification)}\n\n`)
            );
          }

          const lastNotification = notifications[notifications.length - 1];
          cursor = {
            createdAt: lastNotification.createdAt,
            id: lastNotification.id,
          };
        } catch (error) {
          console.error("Notification SSE polling error:", error);
          controller.enqueue(
            encodeSseChunk(
              `event: error\ndata: ${JSON.stringify({ message: "Polling failed" })}\n\n`
            )
          );
        }
      };

      controller.enqueue(encodeSseChunk(": connected\n\n"));
      void poll();

      const intervalId = setInterval(() => {
        void poll();
      }, 5_000);

      req.signal.addEventListener("abort", close);
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
