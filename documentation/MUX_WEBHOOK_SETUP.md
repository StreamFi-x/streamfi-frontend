# Mux Webhook Setup Guide

## ✅ Auto-Create Stream on Signup - IMPLEMENTED!

Users now automatically get a stream key when they sign up. No manual action needed!

---

## 🔔 Setting Up Mux Webhooks (Auto-Detect Live Status)

To automatically detect when streams go live/offline, you need to configure Mux webhooks.

### Step 1: Get Your Webhook URL

**Local Development:**

```
http://localhost:3000/api/webhooks/mux
```

**Production:**

```
https://yourdomain.com/api/webhooks/mux
```

For local testing, you'll need to use a tunnel service like:

- **ngrok**: `ngrok http 3000`
- **cloudflared**: `cloudflared tunnel --url localhost:3000`

### Step 2: Configure Webhook in Mux Dashboard

1. **Go to Mux Dashboard**
   - Visit: https://dashboard.mux.com/
   - Login with your account

2. **Navigate to Webhooks**
   - Click on **Settings** in the left sidebar
   - Click on **Webhooks**

3. **Create New Webhook**
   - Click **"Create New Webhook"** button
   - Enter your webhook URL:
     - Local (with ngrok): `https://your-ngrok-url.ngrok.io/api/webhooks/mux`
     - Production: `https://yourdomain.com/api/webhooks/mux`

4. **Select Events**

   Select these two critical events:

   ✅ **video.live_stream.active** - Triggers when stream goes live

   ✅ **video.live_stream.idle** - Triggers when stream goes offline

   Optional events (useful for monitoring):
   - `video.live_stream.created` - New stream created
   - `video.live_stream.deleted` - Stream deleted

5. **Save Webhook**
   - Click **"Create Webhook"**
   - Copy the **Webhook Signing Secret** (for production use)

### Step 3: Test the Webhook

**Test Health Check:**

```bash
curl http://localhost:3000/api/webhooks/mux
```

**Expected Response:**

```json
{
  "status": "ok",
  "message": "Mux webhook endpoint is active",
  "events": [
    "video.live_stream.active",
    "video.live_stream.idle",
    "video.live_stream.created",
    "video.live_stream.deleted"
  ]
}
```

### Step 4: Test with Real Stream

1. **Start OBS with your stream key**
2. **Watch the server logs:**
   ```
   🔔 Mux webhook received: video.live_stream.active
   🔴 Stream going LIVE: EK6c2a8D...
   ✅ Stream marked as LIVE in database
   ```
3. **Stop OBS**
4. **Watch the server logs:**
   ```
   🔔 Mux webhook received: video.live_stream.idle
   ⚫ Stream going OFFLINE: EK6c2a8D...
   ✅ Stream marked as OFFLINE in database
   ```

---

## 🔒 Production Security (Optional)

### Verify Webhook Signatures

For production, verify webhook signatures to prevent unauthorized requests:

```typescript
// In /app/api/webhooks/mux/route.ts
import crypto from "crypto";

function verifyMuxSignature(
  signature: string,
  body: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(body);
  const digest = hmac.digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

export async function POST(req: Request) {
  const signature = req.headers.get("mux-signature");
  const body = await req.text();

  if (!verifyMuxSignature(signature, body, process.env.MUX_WEBHOOK_SECRET!)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(body);
  // ... rest of handler
}
```

**Add to `.env.local`:**

```bash
MUX_WEBHOOK_SECRET=your_webhook_signing_secret_from_mux
```

---

## 🎯 How It Works

### User Signs Up Flow:

```
1. User fills signup form
   └─> POST /api/users/register

2. Server creates user in database
   └─> Generates UUID, saves email, username, wallet

3. Server auto-creates Mux stream
   └─> Calls createMuxStream()
   └─> Mux returns: stream_id, playback_id, stream_key

4. Server saves stream data to user
   └─> Updates user record with Mux data

5. User receives confirmation
   └─> Can immediately go to /settings/stream-preference
   └─> Stream key is ready to use!
```

### User Starts Streaming Flow:

```
1. User opens OBS
   └─> Configured with RTMP URL + Stream Key

2. User clicks "Start Streaming"
   └─> OBS sends video to Mux

3. Mux detects stream is active
   └─> Sends webhook: video.live_stream.active

4. Your server receives webhook
   └─> POST /api/webhooks/mux
   └─> Updates database: is_live = true

5. Dashboard auto-updates
   └─> Polls /api/streams/key every 10 seconds
   └─> Shows "🔴 LIVE" indicator
   └─> Mux Player displays live video
```

### User Stops Streaming Flow:

```
1. User clicks "Stop Streaming" in OBS
   └─> OBS stops sending video

2. Mux detects stream is idle
   └─> Sends webhook: video.live_stream.idle

3. Your server receives webhook
   └─> Updates database: is_live = false

4. Dashboard auto-updates
   └─> Shows "OFFLINE" indicator
   └─> Mux Player shows offline state
```

---

## 🧪 Testing Without Webhooks (Development)

If you can't set up webhooks yet, you can manually trigger the live status:

**Manually mark stream as live:**

```bash
curl -X POST http://localhost:3000/api/streams/start \
  -H "Content-Type: application/json" \
  -d '{"wallet": "your_wallet_address"}'
```

**Manually mark stream as offline:**

```bash
curl -X DELETE http://localhost:3000/api/streams/start \
  -H "Content-Type: application/json" \
  -d '{"wallet": "your_wallet_address"}'
```

---

## 📊 Monitoring Webhooks

### View Webhook Logs in Mux Dashboard

1. Go to **Settings → Webhooks**
2. Click on your webhook
3. View **Recent Deliveries**
4. Check for:
   - ✅ Success (200 status)
   - ❌ Failures (4xx/5xx status)
   - 🔄 Retries

### Server Logs

Watch your server logs for webhook activity:

```bash
# Development
npm run dev

# Look for these logs:
🔔 Mux webhook received: video.live_stream.active
🔴 Stream going LIVE: EK6c2a8D...
✅ Stream marked as LIVE in database
```

---

## 🐛 Troubleshooting

### Webhook Not Receiving Events

**Issue:** No webhooks received when stream goes live

**Solutions:**

1. **Check webhook URL is accessible**

   ```bash
   curl https://your-ngrok-url.ngrok.io/api/webhooks/mux
   # Should return: {"status": "ok", ...}
   ```

2. **Verify webhook is enabled in Mux**
   - Go to Mux Dashboard → Settings → Webhooks
   - Check webhook status is "Active"

3. **Check selected events**
   - Ensure `video.live_stream.active` and `video.live_stream.idle` are selected

4. **View webhook delivery logs**
   - Mux Dashboard → Settings → Webhooks → Your Webhook
   - Check "Recent Deliveries" for errors

### Stream Not Marked as Live

**Issue:** Webhook received but stream still shows offline

**Solutions:**

1. **Check database update**

   ```sql
   SELECT wallet, username, is_live, mux_stream_id
   FROM users
   WHERE wallet = 'your_wallet';
   ```

2. **Check server logs for errors**

   ```
   ❌ Failed to update stream status: ...
   ```

3. **Verify stream ID matches**
   - Webhook event.data.id should match mux_stream_id in database

### Ngrok URL Changes

**Issue:** Webhook stops working after restarting ngrok

**Solution:**

- Ngrok free tier generates new URL each time
- Update webhook URL in Mux Dashboard after each restart
- Or use **ngrok authtoken** for persistent domains (paid plan)

---

## ✅ Verification Checklist

Before going live, verify everything works:

- [ ] User can sign up successfully
- [ ] Stream key is automatically created
- [ ] Stream key visible in `/settings/stream-preference`
- [ ] Webhook endpoint responds to health check
- [ ] Webhook configured in Mux Dashboard
- [ ] Webhook events selected (active, idle)
- [ ] OBS configured with RTMP URL + stream key
- [ ] Starting OBS triggers "LIVE" status
- [ ] Stopping OBS triggers "OFFLINE" status
- [ ] Dashboard shows correct live/offline status
- [ ] Mux Player displays live video when streaming

---

## 📚 Additional Resources

- [Mux Webhooks Documentation](https://docs.mux.com/guides/system/listen-for-webhooks)
- [Mux Live Streaming Guide](https://docs.mux.com/guides/video/stream-live-video)
- [Ngrok Setup Guide](https://ngrok.com/docs/getting-started)

---

## 🎉 Summary

**Signup Flow:**

1. ✅ User signs up → Stream auto-created
2. ✅ Stream key saved to account
3. ✅ Immediately ready to stream

**Streaming Flow:**

1. ✅ User starts OBS → Webhook triggers
2. ✅ Auto-marks as live in database
3. ✅ Dashboard shows LIVE indicator
4. ✅ No manual API calls needed!

**Everything is automatic!** 🚀
