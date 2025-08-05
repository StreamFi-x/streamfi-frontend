"use server";
import nodemailer from "nodemailer";
import WelcomeUserEmail from "@/components/templates/welcome-user-email";
import VerifyEmailCode from "@/components/templates/verify-email-code";
import { WaitlistConfirmation } from "@/components/templates/waitlist-confirm";
export async function sendWelcomeRegistrationEmail(
  email: string,
  name: string,
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
  const logoUrl = `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/streamfi_pu5tfp.png`;
  const twitterIconUrl = `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/x_ha8udb.png`;
  const discordIconUrl = `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/discord_sekzwp.png`;
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
