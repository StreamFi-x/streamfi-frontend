"use server";
import nodemailer from "nodemailer";
import WelcomeUserEmail from "@/components/templates/WelcomeUserEmail";
import VerifyEmailCode from "@/components/templates/VerifyEmailCode";
import { WaitlistConfirmation } from "@/components/templates/WaitlistConfirm";
export async function sendWelcomeRegistrationEmail(
  email: string,
  name: string
) {
  const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const htmlContent = WelcomeUserEmail(name);

  const mailOptions = {
    from: "process.env.EMAIL_USER",
    to: email,
    subject: "Welcome to Streamfi!",
    html: htmlContent,
  };
  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Error sending registration email:", error);
    throw error;
  }
}

export async function sendEmailVerificationToken(email: string, token: string) {
  const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    dkim: {
      domainName: process.env.EMAIL_DOMAIN || "https://streamfi.netlify.app",
      keySelector: "default",
      privateKey: process.env.DKIM_PRIVATE_KEY || "",
    },
  });

  const htmlContent = VerifyEmailCode(email, token);
  const mailOptions = {
    from: {
      name: "StreamFi",
      address: process.env.EMAIL_USER || "support@streamfi.xyz",
    },
    to: email,
    subject: "StreamFi Email Verification",
    // text: `Your verification token is: ${token}`,
    html: htmlContent,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}
export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    dkim: {
      domainName: process.env.EMAIL_DOMAIN || "https://streamfi.netlify.app",
      keySelector: "default",
      privateKey: process.env.DKIM_PRIVATE_KEY || "",
    },
  });

  const mailOptions = {
    from: {
      name: "StreamFi",
      address: process.env.EMAIL_USER || "support@streamfi.xyz",
    },
    to: email,
    subject: "Reset your StreamFi password",
    html: `
      <p>We received a request to reset your StreamFi password.</p>
      <p><a href="${resetUrl}">Click here to choose a new password</a></p>
      <p>This link expires in 30 minutes. If you didn't request this, you can safely ignore this email.</p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Password reset email sent:", info.response);
  } catch (error) {
    console.error("Error sending password reset email:", error);
    throw error;
  }
}

export async function sendEmailVerificationLink(email: string, verifyUrl: string) {
  const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    dkim: {
      domainName: process.env.EMAIL_DOMAIN || "https://streamfi.netlify.app",
      keySelector: "default",
      privateKey: process.env.DKIM_PRIVATE_KEY || "",
    },
  });

  const mailOptions = {
    from: {
      name: "StreamFi",
      address: process.env.EMAIL_USER || "support@streamfi.xyz",
    },
    to: email,
    subject: "Verify your StreamFi email address",
    html: `
      <p>Confirm this email address to finish updating your StreamFi account.</p>
      <p><a href="${verifyUrl}">Click here to verify your email</a></p>
      <p>This link expires in 24 hours. If you didn't request this, you can safely ignore this email.</p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email verification link sent:", info.response);
  } catch (error) {
    console.error("Error sending email verification link:", error);
    throw error;
  }
}

export async function sendMagicLinkEmail(email: string, magicLinkUrl: string) {
  const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    dkim: {
      domainName: process.env.EMAIL_DOMAIN || "https://streamfi.netlify.app",
      keySelector: "default",
      privateKey: process.env.DKIM_PRIVATE_KEY || "",
    },
  });

  const mailOptions = {
    from: {
      name: "StreamFi",
      address: process.env.EMAIL_USER || "support@streamfi.xyz",
    },
    to: email,
    subject: "Your StreamFi sign-in link",
    html: `
      <p>Click the link below to sign in to StreamFi.</p>
      <p><a href="${magicLinkUrl}">Click here to sign in</a></p>
      <p>This link expires in 15 minutes and can only be used once. If you didn't request this, you can safely ignore this email.</p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Magic link email sent:", info.response);
  } catch (error) {
    console.error("Error sending magic link email:", error);
    throw error;
  }
}

export async function sendWelcomeEmail(email: string, name: string) {
  const htmlContent = WaitlistConfirmation(name, email);
  // Create a more professional transporter with additional configuration
  const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    // Adding DKIM and SPF info in headers
    dkim: {
      domainName: process.env.EMAIL_DOMAIN || "streamfi.xyz",
      keySelector: "default",
      privateKey: process.env.DKIM_PRIVATE_KEY || "",
    },
  });

  // Cloudinary URLs
  const cloudName = "dwjnkuvqv";
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const logoUrl = `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/streamfi_pu5tfp.png`;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const twitterIconUrl = `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/x_ha8udb.png`;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const discordIconUrl = `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/discord_sekzwp.png`;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const facebookIconUrl = `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/facebook_cdmnek.png`;

  // Generate a unique message ID for this email
  const messageId = `${Date.now()}.${Math.random().toString(36).substring(2)}@streamfi.xyz`;

  const mailOptions = {
    from: {
      name: "StreamFi",
      address: process.env.EMAIL_USER || "support@streamfi.xyz",
    },
    to: email,
    subject: "Your StreamFi Waitlist Confirmation",
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

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Error sending waitlist email:", error);
    return false;
  }
}
