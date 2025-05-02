/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";
import nodemailer from "nodemailer";
import WelcomeUserEmail from "@/components/templates/WelcomeUserEmail";
import { render } from "@react-email/render";
import React from "react";

export async function sendWelcomeRegistrationEmail(email: any, name: any) {
  const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const htmlContent = await render(
    React.createElement(WelcomeUserEmail, { name })
  );

  const mailOptions = {
    from: process.env.EMAIL_USER,
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

export async function sendWelcomeEmail(email: any, name: any) {
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
  const recipientName = name || "there";

  const emailTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>StreamFi - Your Waitlist Confirmation</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Poly:ital@0;1&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; color: #333333; line-height: 1.6;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; border: 1px solid #E0E0E0;">
        <!-- Header with Logo -->
        <tr>
            <td style="background-color: #F8F7FB; padding: 25px 35px; text-align: left;">
                <img src="${logoUrl}" alt="StreamFi" style="width: 130px; height: auto; border: 0;">
            </td>
        </tr>
        
        <!-- Main Content - High text-to-image ratio -->
        <tr>
            <td style="padding: 35px; background-color: #FFFFFF;">
                <h1 style="font-family: Arial, sans-serif; font-size: 24px; font-weight: bold; margin: 0 0 25px; color: #333333;">Your StreamFi Waitlist Confirmation</h1>
                
                <p style="font-family: Arial, sans-serif; font-size: 16px; margin: 0 0 20px; color: #333333;">Hi ${recipientName},</p>
                
                <p style="font-family: Arial, sans-serif; font-size: 16px; margin: 0 0 20px; color: #333333;">Thank you for joining the StreamFi waitlist. We've recorded your email and will keep you updated on our progress.</p>
                
                <p style="font-family: Arial, sans-serif; font-size: 16px; margin: 0 0 20px; color: #333333;">To ensure you receive our communications, please add <a href="mailto:${process.env.EMAIL_USER}" style="color: #5A189A; text-decoration: underline;">${process.env.EMAIL_USER}</a> to your contacts.</p>
                
                <p style="font-family: Arial, sans-serif; font-size: 16px; margin: 25px 0 15px; color: #333333; font-weight: bold;">As a waitlist member, you'll receive:</p>
                
                <ul style="padding-left: 25px; margin: 0 0 25px;">
                    <li style="font-family: Arial, sans-serif; font-size: 16px; margin-bottom: 12px; color: #333333;">Early access when we launch our platform</li>
                    <li style="font-family: Arial, sans-serif; font-size: 16px; margin-bottom: 12px; color: #333333;">Product updates and development news</li>
                    <li style="font-family: Arial, sans-serif; font-size: 16px; margin-bottom: 12px; color: #333333;">Special benefits reserved for our early supporters</li>
                </ul>
                
                <p style="font-family: Arial, sans-serif; font-size: 16px; margin: 0 0 30px; color: #333333;">StreamFi is building a better way for creators to stream, earn, and connect with their communities. We're excited to have you with us on this journey.</p>
                
                <!-- CTA Button -->
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0;">
                    <tr>
                        <td align="center">
                            <a href="https://streamfi.xyz" style="display: inline-block; background-color: #5A189A; color: #FFFFFF; font-weight: bold; text-decoration: none; padding: 12px 25px; border-radius: 6px; font-size: 16px; font-family: Arial, sans-serif;">Visit Our Website</a>
                        </td>
                    </tr>
                </table>
                
                <p style="font-family: Arial, sans-serif; font-size: 16px; margin: 30px 0 10px; color: #333333;">Regards,</p>
                <p style="font-family: Arial, sans-serif; font-size: 16px; margin: 0; color: #333333;">The StreamFi Team</p>
            </td>
        </tr>
        
        <!-- Footer -->
        <tr>
            <td style="padding: 25px 35px; border-top: 1px solid #E0E0E0; background-color: #F8F8F8; text-align: center;">
                <!-- Social Icons with Text Fallbacks -->
                <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 20px;">
                    <tr>
                        <td style="padding: 0 8px;">
                            <a href="https://twitter.com/streamfi">
                                <img src="${twitterIconUrl}" alt="Twitter/X" style="width: 24px; height: 24px; border: 0;">
                            </a>
                        </td>
                        <td style="padding: 0 8px;">
                            <a href="https://discord.gg/streamfi">
                                <img src="${discordIconUrl}" alt="Discord" style="width: 24px; height: 24px; border: 0;">
                            </a>
                        </td>
                        <td style="padding: 0 8px;">
                            <a href="https://facebook.com/streamfi">
                                <img src="${facebookIconUrl}" alt="Facebook" style="width: 24px; height: 24px; border: 0;">
                            </a>
                        </td>
                    </tr>
                </table>
                
                <!-- Clear notice about why they're receiving this -->
                <p style="font-family: Arial, sans-serif; font-size: 13px; color: #666666; margin: 0 0 15px;">
                    You're receiving this email because you signed up for the StreamFi waitlist.
                </p>
                
                <!-- Prominent unsubscribe link -->
                <p style="font-family: Arial, sans-serif; font-size: 13px; color: #666666; margin: 0 0 15px;">
                    <a href="https://streamfi.xyz/unsubscribe?email=${encodeURIComponent(email)}&id=${messageId}" style="color: #5A189A; text-decoration: underline;">Unsubscribe</a> | 
                    <a href="https://streamfi.xyz/privacy" style="color: #5A189A; text-decoration: underline;">Privacy Policy</a>
                </p>
                
                <!-- Physical address - required by CAN-SPAM -->
                <p style="font-family: Arial, sans-serif; font-size: 12px; color: #999999; margin: 0;">
                    &copy; 2025 StreamFi Inc., 123 Tech Blvd, San Francisco, CA 94107
                </p>
            </td>
        </tr>
    </table>
</body>
</html>
  `;

  const mailOptions = {
    from: {
      name: "StreamFi", // Shorter sender name is less spammy
      address: process.env.EMAIL_USER || "support@streamfi.xyz", // Use a branded email address
    },
    to: email,
    subject: "Your StreamFi Waitlist Confirmation", // Clear, concise subject
    html: emailTemplate,
    headers: {
      "Message-ID": `<${messageId}>`,
      "List-Unsubscribe": `<https://streamfi.xyz/unsubscribe?email=${encodeURIComponent(email)}&id=${messageId}>`,
      Precedence: "bulk", // Can be removed for non-bulk emails
      "X-Mailer": "StreamFi Mailer", // Could be more neutral
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
