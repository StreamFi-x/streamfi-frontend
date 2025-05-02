/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";
import nodemailer from "nodemailer";
import WelcomeUserEmail from "@/components/templates/WelcomeUserEmail";
import { render } from "@react-email/render";
import React from "react";

export async function sendWelcomeEmail(email: any, name: any) {
  const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Welcome to Our Waitlist!",
    html: `<p>Hello ${name || "there"},</p>
               <p>Thank you for subscribing to our waitlist! We appreciate your interest and will keep you updated on our launch and future developments.</p>
               <p>Stay tuned for exciting updates!</p>
               <p>Best regards, <br/> The Team</p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Error sending welcome email:", error);
    throw error;
  }
}

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
