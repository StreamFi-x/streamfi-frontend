/**
 * POST /api/notifications/send-transactional-email
 *
 * Internal endpoint for triggering transactional emails for notification events.
 * This is called from other parts of the codebase when:
 * - A user follows a creator
 * - A creator goes live
 * - A user receives a large tip
 * - A user's comment receives a reply
 *
 * Request body:
 * {
 *   event_type: "new_follower" | "creator_went_live" | "large_tip" | "comment_reply",
 *   recipient_email: string,
 *   recipient_id?: string,
 *   data: { ... event-specific data }
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  sendNewFollowerEmail,
  sendCreatorWentLiveEmail,
  sendLargeTipReceivedEmail,
  sendCommentReplyEmail,
} from "@/lib/email-service";

// Validation schemas
const newFollowerSchema = z.object({
  event_type: z.literal("new_follower"),
  recipient_email: z.string().email(),
  recipient_id: z.string().optional(),
  data: z.object({
    recipient_name: z.string(),
    follower_name: z.string(),
    follower_username: z.string(),
    follower_profile_url: z.string().url(),
    creator_profile_url: z.string().url(),
  }),
});

const creatorWentLiveSchema = z.object({
  event_type: z.literal("creator_went_live"),
  recipient_email: z.string().email(),
  recipient_id: z.string().optional(),
  data: z.object({
    recipient_name: z.string(),
    creator_name: z.string(),
    creator_username: z.string(),
    stream_title: z.string(),
    stream_url: z.string().url(),
    preferences_url: z.string().url(),
    category: z.string().optional(),
  }),
});

const largeTipSchema = z.object({
  event_type: z.literal("large_tip"),
  recipient_email: z.string().email(),
  recipient_id: z.string().optional(),
  data: z.object({
    recipient_name: z.string(),
    tipper_name: z.string(),
    tipper_username: z.string(),
    tip_amount: z.string(),
    currency: z.string().default("USDC"),
    message: z.string().optional(),
    tipper_profile_url: z.string().url(),
    preferences_url: z.string().url(),
  }),
});

const commentReplySchema = z.object({
  event_type: z.literal("comment_reply"),
  recipient_email: z.string().email(),
  recipient_id: z.string().optional(),
  data: z.object({
    recipient_name: z.string(),
    replier_name: z.string(),
    replier_username: z.string(),
    original_comment_context: z.string(),
    reply_text: z.string(),
    comment_url: z.string().url(),
    preferences_url: z.string().url(),
  }),
});

type RequestBody =
  | z.infer<typeof newFollowerSchema>
  | z.infer<typeof creatorWentLiveSchema>
  | z.infer<typeof largeTipSchema>
  | z.infer<typeof commentReplySchema>;

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();

    // Validate event type and route to appropriate handler
    let validation;
    let result;

    switch (body.event_type) {
      case "new_follower":
        validation = newFollowerSchema.safeParse(body);
        if (!validation.success) {
          return NextResponse.json(
            {
              success: false,
              error: "Invalid request body for new_follower event",
              details: validation.error.errors,
            },
            { status: 400 }
          );
        }

        const nfData = validation.data as z.infer<typeof newFollowerSchema>;
        result = await sendNewFollowerEmail(nfData.recipient_email, {
          recipientName: nfData.data.recipient_name,
          followerName: nfData.data.follower_name,
          followerUsername: nfData.data.follower_username,
          followerProfileUrl: nfData.data.follower_profile_url,
          creatorProfileUrl: nfData.data.creator_profile_url,
        });
        break;

      case "creator_went_live":
        validation = creatorWentLiveSchema.safeParse(body);
        if (!validation.success) {
          return NextResponse.json(
            {
              success: false,
              error: "Invalid request body for creator_went_live event",
              details: validation.error.errors,
            },
            { status: 400 }
          );
        }

        const cwlData = validation.data as z.infer<typeof creatorWentLiveSchema>;
        result = await sendCreatorWentLiveEmail(cwlData.recipient_email, {
          recipientName: cwlData.data.recipient_name,
          creatorName: cwlData.data.creator_name,
          creatorUsername: cwlData.data.creator_username,
          streamTitle: cwlData.data.stream_title,
          streamUrl: cwlData.data.stream_url,
          preferencesUrl: cwlData.data.preferences_url,
          category: cwlData.data.category,
        });
        break;

      case "large_tip":
        validation = largeTipSchema.safeParse(body);
        if (!validation.success) {
          return NextResponse.json(
            {
              success: false,
              error: "Invalid request body for large_tip event",
              details: validation.error.errors,
            },
            { status: 400 }
          );
        }

        const ltData = validation.data as z.infer<typeof largeTipSchema>;
        result = await sendLargeTipReceivedEmail(ltData.recipient_email, {
          recipientName: ltData.data.recipient_name,
          tipperName: ltData.data.tipper_name,
          tipperUsername: ltData.data.tipper_username,
          tipAmount: ltData.data.tip_amount,
          currency: ltData.data.currency,
          message: ltData.data.message,
          tipperProfileUrl: ltData.data.tipper_profile_url,
          preferencesUrl: ltData.data.preferences_url,
        });
        break;

      case "comment_reply":
        validation = commentReplySchema.safeParse(body);
        if (!validation.success) {
          return NextResponse.json(
            {
              success: false,
              error: "Invalid request body for comment_reply event",
              details: validation.error.errors,
            },
            { status: 400 }
          );
        }

        const crData = validation.data as z.infer<typeof commentReplySchema>;
        result = await sendCommentReplyEmail(crData.recipient_email, {
          recipientName: crData.data.recipient_name,
          replierName: crData.data.replier_name,
          replierUsername: crData.data.replier_username,
          originalCommentContext: crData.data.original_comment_context,
          replyText: crData.data.reply_text,
          commentUrl: crData.data.comment_url,
          preferencesUrl: crData.data.preferences_url,
        });
        break;

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown event_type: ${body.event_type}`,
          },
          { status: 400 }
        );
    }

    if (result.success) {
      return NextResponse.json(
        {
          success: true,
          message: "Email sent successfully",
          messageId: result.messageId,
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to send email",
          details: result.error,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[Transactional Email API] Unhandled error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/notifications/send-transactional-email
 *
 * Health check endpoint to verify email service is working
 */
export async function GET(): Promise<NextResponse> {
  try {
    const { testEmailService } = await import("@/lib/email-service");
    const result = await testEmailService();

    return NextResponse.json(result, {
      status: result.success ? 200 : 500,
    });
  } catch (error) {
    console.error("[Transactional Email API] Health check failed:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Email service health check failed",
      },
      { status: 500 }
    );
  }
}
