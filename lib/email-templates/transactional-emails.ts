/**
 * Transactional email templates for StreamFi notification events.
 * Each template exports both HTML and plain-text versions for maximum compatibility.
 */

/**
 * Email template for "new follower" notification
 */
export interface NewFollowerEmailData {
  recipientName: string;
  followerName: string;
  followerUsername: string;
  followerProfileUrl: string;
  creatorProfileUrl: string;
}

export function getNewFollowerEmail(data: NewFollowerEmailData) {
  const { recipientName, followerName, followerUsername, followerProfileUrl, creatorProfileUrl } = data;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; }
    .footer { background: #e9e9e9; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 20px; }
    .highlight { color: #667eea; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 New Follower!</h1>
    </div>
    <div class="content">
      <p>Hi ${recipientName},</p>
      <p>Great news! <span class="highlight">${followerName}</span> (@${followerUsername}) just started following you on StreamFi.</p>
      <p>You now have a new supporter! Check out their profile to see what they're interested in.</p>
      <a href="${followerProfileUrl}" class="button">View Profile</a>
      <p style="margin-top: 30px; font-size: 14px; color: #666;">
        You're receiving this email because you have email notifications enabled for follower events. 
        <a href="${creatorProfileUrl}/settings/notifications">Manage your notification preferences</a>
      </p>
    </div>
    <div class="footer">
      <p>© StreamFi • Keep creating</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const textContent = `
Hi ${recipientName},

Great news! ${followerName} (@${followerUsername}) just started following you on StreamFi.

You now have a new supporter! View their profile at: ${followerProfileUrl}

---
You're receiving this email because you have email notifications enabled for follower events.
Manage your preferences at: ${creatorProfileUrl}/settings/notifications

© StreamFi
  `.trim();

  return {
    subject: `${followerName} started following you on StreamFi`,
    htmlContent,
    textContent,
  };
}

/**
 * Email template for "creator went live" notification
 */
export interface CreatorWentLiveEmailData {
  recipientName: string;
  creatorName: string;
  creatorUsername: string;
  streamTitle: string;
  streamUrl: string;
  preferencesUrl: string;
  category?: string;
}

export function getCreatorWentLiveEmail(data: CreatorWentLiveEmailData) {
  const { recipientName, creatorName, creatorUsername, streamTitle, streamUrl, preferencesUrl, category } = data;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; }
    .footer { background: #e9e9e9; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #f5576c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 20px; }
    .highlight { color: #f5576c; font-weight: bold; }
    .live-badge { display: inline-block; background: #f5576c; color: white; padding: 4px 8px; border-radius: 3px; font-weight: bold; font-size: 12px; margin-left: 8px; }
    .stream-title { font-size: 18px; font-weight: bold; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔴 LIVE <span class="live-badge">NOW</span></h1>
    </div>
    <div class="content">
      <p>Hi ${recipientName},</p>
      <p><span class="highlight">${creatorName}</span> (@${creatorUsername}) is now live on StreamFi!</p>
      ${category ? `<p><strong>Category:</strong> ${category}</p>` : ""}
      <div class="stream-title">"${streamTitle}"</div>
      <p>Don't miss out! Join the stream now.</p>
      <a href="${streamUrl}" class="button">Watch Stream</a>
      <p style="margin-top: 30px; font-size: 14px; color: #666;">
        You're receiving this email because you have email notifications enabled for live alerts. 
        <a href="${preferencesUrl}">Manage your notification preferences</a>
      </p>
    </div>
    <div class="footer">
      <p>© StreamFi • Don't miss a stream</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const textContent = `
🔴 LIVE NOW

Hi ${recipientName},

${creatorName} (@${creatorUsername}) is now live on StreamFi!

${category ? `Category: ${category}\n` : ""}
"${streamTitle}"

Don't miss out! Watch the stream at: ${streamUrl}

---
You're receiving this email because you have email notifications enabled for live alerts.
Manage your preferences at: ${preferencesUrl}

© StreamFi
  `.trim();

  return {
    subject: `${creatorName} just went live on StreamFi!`,
    htmlContent,
    textContent,
  };
}

/**
 * Email template for "large tip received" notification
 */
export interface LargeTipReceivedEmailData {
  recipientName: string;
  tipperName: string;
  tipperUsername: string;
  tipAmount: string; // e.g., "100.50"
  currency: string; // e.g., "USDC"
  message?: string;
  tipperProfileUrl: string;
  preferencesUrl: string;
}

export function getLargeTipReceivedEmail(data: LargeTipReceivedEmailData) {
  const { recipientName, tipperName, tipperUsername, tipAmount, currency, message, tipperProfileUrl, preferencesUrl } = data;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; }
    .footer { background: #e9e9e9; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #fa709a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 20px; }
    .tip-amount { font-size: 36px; font-weight: bold; color: #fa709a; margin: 20px 0; }
    .highlight { color: #fa709a; font-weight: bold; }
    .message-box { background: #fff; border-left: 4px solid #fa709a; padding: 15px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💰 You Received a Tip!</h1>
    </div>
    <div class="content">
      <p>Hi ${recipientName},</p>
      <p><span class="highlight">${tipperName}</span> (@${tipperUsername}) just sent you a tip!</p>
      <div class="tip-amount">${tipAmount} ${currency}</div>
      ${message ? `<div class="message-box"><strong>Their message:</strong><p>${message}</p></div>` : ""}
      <p>A huge thanks to your supporter!</p>
      <a href="${tipperProfileUrl}" class="button">View Supporter</a>
      <p style="margin-top: 30px; font-size: 14px; color: #666;">
        You're receiving this email because you have email notifications enabled for large tips. 
        <a href="${preferencesUrl}">Manage your notification preferences</a>
      </p>
    </div>
    <div class="footer">
      <p>© StreamFi • Thank you for the support</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const textContent = `
💰 You Received a Tip!

Hi ${recipientName},

${tipperName} (@${tipperUsername}) just sent you a tip!

${tipAmount} ${currency}

${message ? `Their message: "${message}"\n` : ""}
A huge thanks to your supporter!

View their profile at: ${tipperProfileUrl}

---
You're receiving this email because you have email notifications enabled for large tips.
Manage your preferences at: ${preferencesUrl}

© StreamFi
  `.trim();

  return {
    subject: `💰 You received a ${tipAmount} ${currency} tip from ${tipperName}`,
    htmlContent,
    textContent,
  };
}

/**
 * Email template for "comment reply" notification
 */
export interface CommentReplyEmailData {
  recipientName: string;
  replierName: string;
  replierUsername: string;
  originalCommentContext: string; // snippet of the original comment
  replyText: string; // the new reply
  commentUrl: string;
  preferencesUrl: string;
}

export function getCommentReplyEmail(data: CommentReplyEmailData) {
  const { recipientName, replierName, replierUsername, originalCommentContext, replyText, commentUrl, preferencesUrl } = data;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; }
    .footer { background: #e9e9e9; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #fed6e3; color: #333; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 20px; }
    .highlight { color: #ff6b9d; font-weight: bold; }
    .comment-box { background: #fff; border-left: 4px solid #ff6b9d; padding: 15px; margin: 20px 0; font-style: italic; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💬 New Reply to Your Comment</h1>
    </div>
    <div class="content">
      <p>Hi ${recipientName},</p>
      <p><span class="highlight">${replierName}</span> (@${replierUsername}) replied to your comment!</p>
      <div class="comment-box">
        <strong>Your comment:</strong><br>
        "${originalCommentContext}"
      </div>
      <div class="comment-box">
        <strong>${replierName}'s reply:</strong><br>
        "${replyText}"
      </div>
      <a href="${commentUrl}" class="button">View Conversation</a>
      <p style="margin-top: 30px; font-size: 14px; color: #666;">
        You're receiving this email because you have email notifications enabled for comment replies. 
        <a href="${preferencesUrl}">Manage your notification preferences</a>
      </p>
    </div>
    <div class="footer">
      <p>© StreamFi • Stay connected</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const textContent = `
💬 New Reply to Your Comment

Hi ${recipientName},

${replierName} (@${replierUsername}) replied to your comment!

Your comment: "${originalCommentContext}"

${replierName}'s reply: "${replyText}"

View the conversation at: ${commentUrl}

---
You're receiving this email because you have email notifications enabled for comment replies.
Manage your preferences at: ${preferencesUrl}

© StreamFi
  `.trim();

  return {
    subject: `${replierName} replied to your comment`,
    htmlContent,
    textContent,
  };
}
