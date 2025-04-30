/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import nodemailer from 'nodemailer';

export async function sendWelcomeEmail(email: any, name: any) {
  const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  // StreamFi waitlist email HTML template with inline styles
  const emailTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>StreamFi - You're on the Waitlist!</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Poly:ital@0;1&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; font-family: 'Poly', serif; color: #000000; line-height: 1.5;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; border: 1px solid #E0E0E0;">
        <!-- Header with Logo -->
        <tr>
            <td style="background-color: #F8F7FB; padding: 30px 40px;">
                <img src="https://res.cloudinary.com/dwjnkuvqv/image/upload/v1745940937/streamfi_pu5tfp.png" alt="StreamFi" style="width: 150px; height: auto;">
            </td>
        </tr>
        
        <!-- Main Content -->
        <tr>
            <td style="padding: 40px 40px 20px; background-color: #FFFFFF;">
                <h1 style="font-family: 'Bebas Neue', sans-serif; font-size: 32px; font-weight: bold; margin: 0 0 30px; line-height: 1.2;">YOU ARE ON THE WAITLIST! 🎉</h1>
                
                <p style="font-family: 'Poly', serif; font-size: 16px; margin: 0 0 20px;">Thanks for joining the waitlist! 🚀</p>
                
                <p style="font-family: 'Poly', serif; font-size: 16px; margin: 0 0 20px;">You're officially on the list, and we couldn't be more excited to have you here, ${name || "there"}! 🎊</p>
                
                <p style="font-family: 'Poly', serif; font-size: 16px; margin: 0 0 20px;">StreamFi is on a mission to redefine how creators stream, earn, and connect with their communities — and you're getting early access to all of it.</p>
                
                <p style="font-size: 16px; font-weight: bold; margin: 30px 0 20px; font-family: 'Bebas Neue', sans-serif;">Here's what's next:</p>
                
                <ul style="padding-left: 20px; margin: 0 0 30px;">
                    <li style="font-family: 'Poly', serif; font-size: 16px; margin-bottom: 15px;">⏳ You'll be among the first to know when we launch.</li>
                    <li style="font-family: 'Poly', serif; font-size: 16px; margin-bottom: 15px;">👀 Get exclusive sneak peeks and early updates.</li>
                    <li style="font-family: 'Poly', serif; font-size: 16px; margin-bottom: 15px;">🎁 Expect some surprises for our earliest supporters (yes, that's you 😉).</li>
                </ul>
                
                <p style="font-family: 'Poly', serif; font-size: 16px; margin: 0 0 40px;">In the meantime, spread the word and invite others to join the waitlist — the more, the merrier.</p>
                
                <!-- CTA Button -->
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 40px;">
                    <tr>
                        <td align="center">
                            <a href="#" style="display: inline-block; background-color: #5A189A; color: #FFFFFF; font-weight: bold; text-decoration: none; padding: 15px 30px; border-radius: 10px; font-size: 18px; font-family: 'Bebas Neue', sans-serif;">Learn More About StreamFi</a>
                        </td>
                    </tr>
                </table>
                
                <p style="font-family: 'Poly', serif; font-size: 16px; margin: 0 0 10px;">We'll be in touch soon. Stay tuned, stay hyped. 💜</p>
                <p style="font-family: 'Poly', serif; font-size: 16px; margin: 0 0 40px;">— The StreamFi Team</p>
            </td>
        </tr>
        
        <!-- Footer -->
        <tr>
            <td style="padding: 30px 40px; border-top: 1px solid #E0E0E0; background-color: #FFFFFF; text-align: center;">
                <p style="font-family: 'Poly', serif; font-size: 14px; color: #666666; margin: 0 0 20px;">If you do not want any emails from StreamFi? <a href="#" style="font-family: 'Poly', serif; color: #000000; text-decoration: underline;">Unsubscribe</a></p>
                
                <!-- Social Icons -->
                <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                    <tr>
                        <td style="padding: 0 10px;">
                            <a href="#"><img src="https://res.cloudinary.com/dwjnkuvqv/image/upload/v1745940938/x_ha8udb.png" alt="Twitter/X" style="width: 24px; height: 24px;"></a>
                        </td>
                        <td style="padding: 0 10px;">
                            <a href="#"><img src="https://res.cloudinary.com/dwjnkuvqv/image/upload/v1745940938/discord_sekzwp.png" alt="Discord" style="width: 24px; height: 24px;"></a>
                        </td>
                        <td style="padding: 0 10px;">
                            <a href="#"><img src="https://res.cloudinary.com/dwjnkuvqv/image/upload/v1745940938/facebook_cdmnek.png" alt="Facebook" style="width: 24px; height: 24px;"></a>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
  `;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "YOU ARE ON THE STREAMFI WAITLIST! 🎉",
    html: emailTemplate
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Error sending waitlist email:", error);
    throw error;
  }
}