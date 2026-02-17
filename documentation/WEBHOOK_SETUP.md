# Mux Webhook Setup Guide

## Quick Start

### Option 1: Production Setup (Deployed App)

1. **Get your webhook URL:**

   ```
   https://your-domain.com/api/webhooks/mux
   ```

2. **Configure in Mux Dashboard:**
   - Go to: https://dashboard.mux.com/settings/webhooks
   - Click "Create New Webhook"
   - Enter your webhook URL
   - Select these events:
     - ✅ `video.live_stream.active` (stream goes live)
     - ✅ `video.live_stream.idle` (stream goes offline)
   - Click "Create Webhook"

3. **Done!** Your streams will now automatically be marked as live/offline.

---

### Option 2: Local Development (Using ngrok)

If you're testing locally on `localhost:3000`, you need to expose it:

1. **Install ngrok:**

   ```bash
   # macOS (Homebrew)
   brew install ngrok

   # Or download from: https://ngrok.com/download
   ```

2. **Start your Next.js dev server:**

   ```bash
   npm run dev
   # Server running on http://localhost:3000
   ```

3. **In a new terminal, start ngrok:**

   ```bash
   ngrok http 3000
   ```

   You'll see output like:

   ```
   Forwarding  https://abc123.ngrok.io -> http://localhost:3000
   ```

4. **Use the ngrok URL in Mux:**

   ```
   https://abc123.ngrok.io/api/webhooks/mux
   ```

5. **Configure in Mux Dashboard:**
   - Go to: https://dashboard.mux.com/settings/webhooks
   - Click "Create New Webhook"
   - Paste: `https://abc123.ngrok.io/api/webhooks/mux`
   - Select events: `video.live_stream.active` and `video.live_stream.idle`
   - Save

6. **Test it:**
   - Start streaming via OBS to your Mux RTMP URL
   - Watch the terminal logs for: `🔴 Stream going LIVE`
   - Your database `is_live` field will be set to `true` automatically

---

## Testing the Webhook

### 1. Check if webhook endpoint is working:

```bash
curl http://localhost:3000/api/webhooks/mux
```

Expected response:

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

### 2. Monitor webhook events:

- Watch your server logs when you start streaming
- You should see: `🔔 Mux webhook received: video.live_stream.active`
- Then: `✅ Stream marked as LIVE in database`

---

## What Events Do What?

| Event                      | What Happens                | Database Update                               |
| -------------------------- | --------------------------- | --------------------------------------------- |
| `video.live_stream.active` | You start streaming via OBS | `is_live = true`, `stream_started_at = NOW()` |
| `video.live_stream.idle`   | You stop streaming          | `is_live = false`, `stream_started_at = NULL` |

---

## Troubleshooting

### Webhook not receiving events?

1. ✅ Check Mux webhook URL is correct
2. ✅ If using ngrok, make sure it's still running (URLs expire)
3. ✅ Check Mux dashboard → Webhooks → View webhook logs
4. ✅ Verify events are selected: `video.live_stream.active` and `video.live_stream.idle`

### Stream not showing as live?

1. Check server logs for webhook events
2. Verify your `mux_stream_id` in database matches Mux stream ID
3. Test webhook endpoint manually (see testing section above)

### Still having issues?

- Check Mux webhook delivery logs in dashboard
- Look for webhook errors in your server logs
- Verify database connection is working

---

## Security (Optional but Recommended)

For production, you should verify webhook signatures:

```typescript
// In app/api/webhooks/mux/route.ts
const signature = req.headers.get("mux-signature");
// Add signature verification logic
```

Get your webhook signing secret from Mux dashboard and verify each request.

---

## Quick Commands Reference

```bash
# Start dev server
npm run dev

# Expose local server (in new terminal)
ngrok http 3000

# Test webhook endpoint
curl http://localhost:3000/api/webhooks/mux

# Check database live status
# (depends on your database setup)
```

---

**Next Steps:**

1. Choose Production or Local setup above
2. Configure webhook in Mux dashboard
3. Start streaming via OBS
4. Watch the magic happen! 🎉
