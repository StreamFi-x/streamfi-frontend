"use server";
import nodemailer from "nodemailer";
import WelcomeUserEmail from "@/components/templates/WelcomeUserEmail";
import VerifyEmailCode from "@/components/templates/VerifyEmailCode";
import { WaitlistConfirmation } from "@/components/templates/WaitlistConfirm";
import { executeEmailWithRetryAndDeadLetter } from "@/lib/email/reliable-sender";
import { logger } from "@/lib/tracing/logger";

export interface TransactionalSendOptions {
  maxRetries?: number;
  initialBackoffMs?: number;
}

export async function sendWelcomeRegistrationEmail(
  email: string,
  name: string,
  options?: TransactionalSendOptions
) {
  const htmlContent = WelcomeUserEmail(name);
  const subject = "Welcome to Streamfi!";

  const mailOptions = {
    from: {
      name: "StreamFi",
      address: process.env.EMAIL_USER || "support@streamfi.xyz",
    },
    to: email,
    subject,
    html: htmlContent,
  };

  const outcome = await executeEmailWithRetryAndDeadLetter(
    async () => {
      const transporter = nodemailer.createTransport({
        service: "Gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });
      await transporter.sendMail(mailOptions);
      return true;
    },
    {
      emailType: "welcome_registration",
      recipientEmail: email,
      subject,
      payload: { name },
      maxRetries: options?.maxRetries,
      initialBackoffMs: options?.initialBackoffMs,
    }
  );

  if (!outcome.success) {
    throw new Error(outcome.error || "Error sending registration email");
  }
  return true;
}

export async function sendEmailVerificationToken(
  email: string,
  token: string,
  options?: TransactionalSendOptions
) {
  const htmlContent = VerifyEmailCode(email, token);
  const subject = "StreamFi Email Verification";
  const mailOptions = {
    from: {
      name: "StreamFi",
      address: process.env.EMAIL_USER || "support@streamfi.xyz",
    },
    to: email,
    subject,
    html: htmlContent,
  };

  const outcome = await executeEmailWithRetryAndDeadLetter(
    async () => {
      const transporter = nodemailer.createTransport({
        service: "Gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        dkim: {
          domainName:
            process.env.EMAIL_DOMAIN || "https://streamfi.netlify.app",
          keySelector: "default",
          privateKey: process.env.DKIM_PRIVATE_KEY || "",
        },
      });
      const info = await transporter.sendMail(mailOptions);
      logger.info("Email verification token sent", {
        recipientEmail: email,
        response: info?.response,
      });
      return true;
    },
    {
      emailType: "email_verification_token",
      recipientEmail: email,
      subject,
      maxRetries: options?.maxRetries,
      initialBackoffMs: options?.initialBackoffMs,
    }
  );

  return outcome.success;
}

export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string,
  options?: TransactionalSendOptions
) {
  const subject = "Reset your StreamFi password";
  const mailOptions = {
    from: {
      name: "StreamFi",
      address: process.env.EMAIL_USER || "support@streamfi.xyz",
    },
    to: email,
    subject,
    html: `
      <p>We received a request to reset your StreamFi password.</p>
      <p><a href="${resetUrl}">Click here to choose a new password</a></p>
      <p>This link expires in 30 minutes. If you didn't request this, you can safely ignore this email.</p>
    `,
  };

  const outcome = await executeEmailWithRetryAndDeadLetter(
    async () => {
      const transporter = nodemailer.createTransport({
        service: "Gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        dkim: {
          domainName:
            process.env.EMAIL_DOMAIN || "https://streamfi.netlify.app",
          keySelector: "default",
          privateKey: process.env.DKIM_PRIVATE_KEY || "",
        },
      });
      const info = await transporter.sendMail(mailOptions);
      logger.info("Password reset email sent", {
        recipientEmail: email,
        response: info?.response,
      });
      return true;
    },
    {
      emailType: "password_reset",
      recipientEmail: email,
      subject,
      maxRetries: options?.maxRetries,
      initialBackoffMs: options?.initialBackoffMs,
    }
  );

  if (!outcome.success) {
    throw new Error(outcome.error || "Error sending password reset email");
  }
}

export async function sendEmailVerificationLink(
  email: string,
  verifyUrl: string,
  options?: TransactionalSendOptions
) {
  const subject = "Verify your StreamFi email address";
  const mailOptions = {
    from: {
      name: "StreamFi",
      address: process.env.EMAIL_USER || "support@streamfi.xyz",
    },
    to: email,
    subject,
    html: `
      <p>Confirm this email address to finish updating your StreamFi account.</p>
      <p><a href="${verifyUrl}">Click here to verify your email</a></p>
      <p>This link expires in 24 hours. If you didn't request this, you can safely ignore this email.</p>
    `,
  };

  const outcome = await executeEmailWithRetryAndDeadLetter(
    async () => {
      const transporter = nodemailer.createTransport({
        service: "Gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        dkim: {
          domainName:
            process.env.EMAIL_DOMAIN || "https://streamfi.netlify.app",
          keySelector: "default",
          privateKey: process.env.DKIM_PRIVATE_KEY || "",
        },
      });
      const info = await transporter.sendMail(mailOptions);
      logger.info("Email verification link sent", {
        recipientEmail: email,
        response: info?.response,
      });
      return true;
    },
    {
      emailType: "email_verification_link",
      recipientEmail: email,
      subject,
      maxRetries: options?.maxRetries,
      initialBackoffMs: options?.initialBackoffMs,
    }
  );

  if (!outcome.success) {
    throw new Error(outcome.error || "Error sending email verification link");
  }
}

export async function sendMagicLinkEmail(
  email: string,
  magicLinkUrl: string,
  options?: TransactionalSendOptions
) {
  const subject = "Your StreamFi sign-in link";
  const mailOptions = {
    from: {
      name: "StreamFi",
      address: process.env.EMAIL_USER || "support@streamfi.xyz",
    },
    to: email,
    subject,
    html: `
      <p>Click the link below to sign in to StreamFi.</p>
      <p><a href="${magicLinkUrl}">Click here to sign in</a></p>
      <p>This link expires in 15 minutes and can only be used once. If you didn't request this, you can safely ignore this email.</p>
    `,
  };

  const outcome = await executeEmailWithRetryAndDeadLetter(
    async () => {
      const transporter = nodemailer.createTransport({
        service: "Gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        dkim: {
          domainName:
            process.env.EMAIL_DOMAIN || "https://streamfi.netlify.app",
          keySelector: "default",
          privateKey: process.env.DKIM_PRIVATE_KEY || "",
        },
      });
      const info = await transporter.sendMail(mailOptions);
      logger.info("Magic link email sent", {
        recipientEmail: email,
        response: info?.response,
      });
      return true;
    },
    {
      emailType: "magic_link",
      recipientEmail: email,
      subject,
      maxRetries: options?.maxRetries,
      initialBackoffMs: options?.initialBackoffMs,
    }
  );

  if (!outcome.success) {
    throw new Error(outcome.error || "Error sending magic link email");
  }
}

export async function sendWelcomeEmail(
  email: string,
  name: string,
  options?: TransactionalSendOptions
) {
  const htmlContent = WaitlistConfirmation(name, email);
  const subject = "Your StreamFi Waitlist Confirmation";

  // Generate a unique message ID for this email
  const messageId = `${Date.now()}.${Math.random().toString(36).substring(2)}@streamfi.xyz`;

  const mailOptions = {
    from: {
      name: "StreamFi",
      address: process.env.EMAIL_USER || "support@streamfi.xyz",
    },
    to: email,
    subject,
    html: htmlContent,
    headers: {
      "Message-ID": `<${messageId}>`,
      "List-Unsubscribe": `<https://streamfi.xyz/unsubscribe?email=${encodeURIComponent(email)}&id=${messageId}>`,
      Precedence: "bulk",
      "X-Mailer": "StreamFi Mailer",
      "X-Entity-Ref-ID": messageId,
      "Feedback-ID": `waitlist:streamfi:${messageId}`,
    },
  };

  const outcome = await executeEmailWithRetryAndDeadLetter(
    async () => {
      const transporter = nodemailer.createTransport({
        service: "Gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        dkim: {
          domainName: process.env.EMAIL_DOMAIN || "streamfi.xyz",
          keySelector: "default",
          privateKey: process.env.DKIM_PRIVATE_KEY || "",
        },
      });
      await transporter.sendMail(mailOptions);
      return true;
    },
    {
      emailType: "waitlist_welcome",
      recipientEmail: email,
      subject,
      payload: { name },
      maxRetries: options?.maxRetries,
      initialBackoffMs: options?.initialBackoffMs,
    }
  );

  return outcome.success;
}
