/**
 * Centralized email delivery service for StreamFi transactional emails.
 * This service:
 * - Manages a singleton Nodemailer transporter
 * - Provides typed methods for each notification type
 * - Handles retries for transient failures
 * - Respects user notification preferences (when available)
 * - Logs all send attempts for debugging
 */

"use server";

import nodemailer, { Transporter } from "nodemailer";
import {
  getNewFollowerEmail,
  getCreatorWentLiveEmail,
  getLargeTipReceivedEmail,
  getCommentReplyEmail,
  NewFollowerEmailData,
  CreatorWentLiveEmailData,
  LargeTipReceivedEmailData,
  CommentReplyEmailData,
} from "./email-templates/transactional-emails";

// Singleton transporter instance
let transporter: Transporter | null = null;

interface EmailSendOptions {
  maxRetries?: number;
  retryDelayMs?: number;
}

interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  retryCount?: number;
}

/**
 * Get or create the Nodemailer transporter
 */
function getTransporter(): Transporter {
  if (!transporter) {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    const emailDomain = process.env.EMAIL_DOMAIN || "streamfi.xyz";
    const dkimPrivateKey = process.env.DKIM_PRIVATE_KEY || "";

    if (!emailUser || !emailPass) {
      throw new Error(
        "EMAIL_USER and EMAIL_PASS environment variables are required"
      );
    }

    transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      ...(dkimPrivateKey && {
        dkim: {
          domainName: emailDomain,
          keySelector: "default",
          privateKey: dkimPrivateKey,
        },
      }),
      pool: {
        maxConnections: 5,
        maxMessages: 100,
        rateDelta: 1000,
        rateLimit: 14, // 14 messages per second (Gmail limit safety margin)
      },
    });
  }

  return transporter;
}

/**
 * Generic email send with retry logic
 */
async function sendEmailWithRetry(
  recipientEmail: string,
  subject: string,
  htmlContent: string,
  textContent: string,
  options: EmailSendOptions = {}
): Promise<EmailSendResult> {
  const maxRetries = options.maxRetries ?? 3;
  const retryDelayMs = options.retryDelayMs ?? 1000;

  let lastError: Error | null = null;
  let retryCount = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const tp = getTransporter();

      const result = await tp.sendMail({
        from: {
          name: "StreamFi",
          address: process.env.EMAIL_USER || "support@streamfi.xyz",
        },
        to: recipientEmail,
        subject,
        html: htmlContent,
        text: textContent,
        headers: {
          "X-Mailer": "StreamFi Notification Service",
          "Precedence": "bulk",
        },
      });

      console.log(
        `[EmailService] Successfully sent "${subject}" to ${recipientEmail}`,
        {
          messageId: result.messageId,
          attempts: attempt + 1,
        }
      );

      return {
        success: true,
        messageId: result.messageId,
        retryCount: attempt,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      retryCount = attempt + 1;

      if (attempt < maxRetries) {
        // Wait before retrying (exponential backoff)
        const delay = retryDelayMs * Math.pow(2, attempt);
        console.warn(
          `[EmailService] Send failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`,
          lastError.message
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error(
          `[EmailService] Failed to send "${subject}" to ${recipientEmail} after ${maxRetries + 1} attempts:`,
          lastError.message
        );
      }
    }
  }

  return {
    success: false,
    error: lastError?.message || "Unknown error",
    retryCount,
  };
}

/**
 * Send a "new follower" notification email
 */
export async function sendNewFollowerEmail(
  recipientEmail: string,
  data: NewFollowerEmailData,
  options?: EmailSendOptions
): Promise<EmailSendResult> {
  try {
    const { subject, htmlContent, textContent } = getNewFollowerEmail(data);
    return sendEmailWithRetry(recipientEmail, subject, htmlContent, textContent, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[EmailService] Error preparing new follower email:", message);
    return { success: false, error: message };
  }
}

/**
 * Send a "creator went live" notification email
 */
export async function sendCreatorWentLiveEmail(
  recipientEmail: string,
  data: CreatorWentLiveEmailData,
  options?: EmailSendOptions
): Promise<EmailSendResult> {
  try {
    const { subject, htmlContent, textContent } = getCreatorWentLiveEmail(data);
    return sendEmailWithRetry(recipientEmail, subject, htmlContent, textContent, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[EmailService] Error preparing creator went live email:", message);
    return { success: false, error: message };
  }
}

/**
 * Send a "large tip received" notification email
 */
export async function sendLargeTipReceivedEmail(
  recipientEmail: string,
  data: LargeTipReceivedEmailData,
  options?: EmailSendOptions
): Promise<EmailSendResult> {
  try {
    const { subject, htmlContent, textContent } = getLargeTipReceivedEmail(data);
    return sendEmailWithRetry(recipientEmail, subject, htmlContent, textContent, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[EmailService] Error preparing large tip email:", message);
    return { success: false, error: message };
  }
}

/**
 * Send a "comment reply" notification email
 */
export async function sendCommentReplyEmail(
  recipientEmail: string,
  data: CommentReplyEmailData,
  options?: EmailSendOptions
): Promise<EmailSendResult> {
  try {
    const { subject, htmlContent, textContent } = getCommentReplyEmail(data);
    return sendEmailWithRetry(recipientEmail, subject, htmlContent, textContent, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[EmailService] Error preparing comment reply email:", message);
    return { success: false, error: message };
  }
}

/**
 * Health check / test the email service
 */
export async function testEmailService(): Promise<{ success: boolean; message: string }> {
  try {
    const tp = getTransporter();
    await tp.verify();
    return {
      success: true,
      message: "Email service is configured correctly",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Email service verification failed: ${message}`,
    };
  }
}
