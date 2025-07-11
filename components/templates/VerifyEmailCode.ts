export default function VerifyEmailCode(name: string, token: string) {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">
<head>
  <meta charset="UTF-8">
  <meta content="width=device-width, initial-scale=1" name="viewport">
  <meta name="x-apple-disable-message-reformatting">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta content="telephone=no" name="format-detection">
  <title>Email Verification</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f8f9fa;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      padding: 40px;
    }
    .logo {
      margin-bottom: 40px;
    }
    .logo img {
      height: 40px;
    }
    .heading {
      font-size: 32px;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0 0 32px 0;
      line-height: 1.2;
    }
    .body-text {
      font-size: 16px;
      color: #4a5568;
      line-height: 1.6;
      margin: 0 0 24px 0;
    }
    .code-section {
      margin: 32px 0;
    }
    .code-label {
      font-size: 16px;
      color: #4a5568;
      margin: 0 0 16px 0;
    }
    .code-box {
      background-color: #f3e8ff;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      margin: 0 0 24px 0;
      display: inline-block;
      min-width: 200px;
    }
    .code {
      font-size: 28px;
      font-weight: 600;
      color: #1a1a1a;
      letter-spacing: 8px;
      font-family: 'Courier New', monospace;
    }
    .expiry-text {
      font-size: 16px;
      color: #4a5568;
      margin: 0 0 8px 0;
    }
    .support-text {
      font-size: 16px;
      color: #4a5568;
      margin: 0 0 32px 0;
    }
    .support-link {
      color: #8b5cf6;
      text-decoration: none;
    }
    .support-link:hover {
      text-decoration: underline;
    }
    .separator {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 32px 0;
    }
    .closing {
      font-size: 16px;
      color: #4a5568;
      margin: 0 0 8px 0;
    }
    .signature {
      font-size: 16px;
      color: #4a5568;
      margin: 0 0 32px 0;
    }
    .heart {
      color: #8b5cf6;
    }
    .social-icons {
      text-align: center;
      margin: 32px 0;
    }
    .social-icons a {
      display: inline-block;
      margin: 0 12px;
      color: #8b5cf6;
      text-decoration: none;
    }
    .social-icons svg {
      width: 24px;
      height: 24px;
      fill: currentColor;
    }
    .footer {
      text-align: center;
      font-size: 14px;
      color: #9ca3af;
      margin-top: 32px;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Logo -->
    <div class="logo">
      <img src="https://streamfi.io/Images/STRMLogo.svg" alt="StreamFi Logo" />
    </div>

    <!-- Main Heading -->
    <h1 class="heading">VERIFY YOUR EMAIL ADDRESS</h1>

    <!-- Body Text -->
    <p class="body-text">Hey ${name},</p>
    <p class="body-text">
      You're just one step away from unlocking your personalized streaming experience on 
      StreamFi — the decentralized platform built for creators, gamers, and digital 
      communities shaping the future of entertainment.
    </p>

    <!-- Verification Code Section -->
    <div class="code-section">
      <p class="code-label">Use the verification code below:</p>
      
      <div class="code-box">
        <div class="code">${token}</div>
      </div>

      <p class="expiry-text">This code will expire in 5 minutes.</p>
      <p class="support-text">
        If you didn't request this verification, feel free to ignore this message and 
        <a href="https://streamfi.io/support" class="support-link">contact our support team</a>.
      </p>
    </div>

    <!-- Separator -->
    <hr class="separator" />

    <!-- Closing Message -->
    <p class="closing">We'll be in touch soon. Stay tuned, stay hyped.</p>
    <p class="signature">— The StreamFi Team <span class="heart">💜</span></p>

    <!-- Social Media Icons -->
    <div class="social-icons">
      <a href="https://twitter.com/streamfi">
        <svg viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </a>
      <a href="https://discord.gg/streamfi">
        <svg viewBox="0 0 24 24">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
        </svg>
      </a>
      <a href="https://facebook.com/streamfi">
        <svg viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      </a>
    </div>

    <!-- Footer -->
    <div class="footer">
      ©2025 StreamFi. All Rights Reserved.
    </div>
  </div>
</body>
</html>`;
}
