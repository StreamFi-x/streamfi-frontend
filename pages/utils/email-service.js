import nodemailer from "nodemailer";

export async function sendWelcomeEmail(email, name) {
    const transporter = nodemailer.createTransport({
        service: "Gmail", 
        auth: {
            user: process.env.EMAIL_USER,  
            pass: process.env.EMAIL_PASS   
        }
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Welcome to Our Waitlist!",
        html: `<p>Hello ${name || "there"},</p>
               <p>Thank you for subscribing to our waitlist! We appreciate your interest and will keep you updated on our launch and future developments.</p>
               <p>Stay tuned for exciting updates!</p>
               <p>Best regards, <br/> The Team</p>`
    };

    try {
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error("Error sending welcome email:", error);
        throw error;
    }
}
