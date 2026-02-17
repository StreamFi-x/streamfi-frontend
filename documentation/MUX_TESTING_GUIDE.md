# Mux Streaming - Local Testing Guide

## ✅ Migration Complete!

You've successfully migrated from Livepeer to Mux. Here's how to test everything locally.

---

## 🔧 Prerequisites

### 1. Database Migration

Run the migration script to add Mux columns to your database:

```bash
# Connect to your PostgreSQL database and run:
psql your_database_url < scripts/migrate-to-mux.sql

# Or use a database GUI tool (TablePlus, pgAdmin, etc.) and run the SQL from:
# scripts/migrate-to-mux.sql
```

### 2. Environment Variables

Your `.env.local` already has the Mux credentials set:

- ✅ `MUX_TOKEN_ID`
- ✅ `MUX_TOKEN_SECRET`

---

## 🚀 How to Test Streaming Locally

### Step 1: Start the Dev Server

```bash
npm run dev
```

The app should start at `http://localhost:3000`

### Step 2: Create a Stream

1. **Register/Login** with your wallet
2. **Navigate to Dashboard** or Stream Creation page
3. **Click "Create Stream"** or equivalent button
4. **Fill in stream details**:
   - Title: "My Test Stream"
   - Description: "Testing Mux integration"
   - Category: Your choice
   - Tags: Optional

5. **Submit** - The API will:
   - Call Mux to create a live stream
   - Return stream credentials (Stream Key, RTMP URL, Playback ID)
   - Save to database

### Step 3: Get Your RTMP Credentials

After creating a stream, you'll receive:

```
RTMP URL: rtmp://global-live.mux.com:5222/app
Stream Key: [unique key from Mux]
```

### Step 4: Set Up OBS Studio

1. **Download OBS Studio**: https://obsproject.com/download
2. **Open OBS** → Settings → Stream
3. **Configure**:
   - Service: **Custom**
   - Server: `rtmp://global-live.mux.com:5222/app`
   - Stream Key: `[paste your stream key]`

4. **Video Settings** (Settings → Video):
   - Base Resolution: 1920x1080
   - Output Resolution: 1920x1080
   - FPS: 30

5. **Output Settings** (Settings → Output):
   - Output Mode: Simple
   - Video Bitrate: 2500-6000 Kbps
   - Encoder: x264
   - Audio Bitrate: 160

6. **Click Apply → OK**

### Step 5: Start Streaming

1. **In OBS**: Add a source (Display Capture, Window Capture, or Camera)
2. **Click "Start Streaming"** in OBS
3. **Wait 10-15 seconds** for Mux to process the stream

### Step 6: View the Stream

1. **Navigate to your stream page** in the app
2. **The Mux Player** should automatically load
3. **You should see**:
   - Your live video
   - "LIVE" indicator
   - Playback controls

---

## 🎥 Mux Player Features

The Mux Player (`components/MuxVideoPlayer.tsx`) includes:

- ✅ Automatic adaptive bitrate (ABR)
- ✅ Low-latency mode
- ✅ Built-in playback controls
- ✅ Thumbnail generation
- ✅ Browser compatibility (Chrome, Firefox, Safari, Edge)

---

## 🧪 Test API Endpoints

### Test Stream Creation

```bash
curl -X POST http://localhost:3000/api/streams/create \
  -H "Content-Type: application/json" \
  -d '{
    "wallet": "your_wallet_address",
    "title": "Test Stream",
    "description": "Testing Mux",
    "category": "Technology"
  }'
```

Expected Response:

```json
{
  "message": "Stream created successfully",
  "streamData": {
    "streamId": "mux_stream_id",
    "playbackId": "playback_id",
    "streamKey": "your_stream_key",
    "rtmpUrl": "rtmp://global-live.mux.com:5222/app",
    "title": "Test Stream",
    "isActive": false
  }
}
```

### Test Get Stream

```bash
curl http://localhost:3000/api/streams/your_wallet_address
```

### Test Playback URL

```bash
curl http://localhost:3000/api/streams/playback/your_playback_id
```

Expected Response:

```json
{
  "success": true,
  "playbackId": "your_playback_id",
  "src": "https://stream.mux.com/your_playback_id.m3u8",
  "urls": {
    "hls": "https://stream.mux.com/your_playback_id.m3u8",
    "thumbnail": "https://image.mux.com/your_playback_id/thumbnail.jpg"
  }
}
```

---

## 🐛 Troubleshooting

### Issue: "Mux credentials not configured"

**Solution**: Check that `.env.local` has `MUX_TOKEN_ID` and `MUX_TOKEN_SECRET` set.

### Issue: Database column errors

**Solution**: Run the migration script:

```bash
psql your_database_url < scripts/migrate-to-mux.sql
```

### Issue: Stream not appearing in player

**Possible causes**:

1. **OBS not streaming**: Check OBS status bar shows "LIVE"
2. **10-15 second delay**: Mux needs time to process the stream
3. **Firewall blocking RTMP**: Check port 5222 is open
4. **Wrong stream key**: Verify you copied the correct key from the API response

### Issue: "Stream not found"

**Solution**:

- Verify the stream was created successfully in the database
- Check Mux dashboard: https://dashboard.mux.com/

### Issue: Player shows loading indefinitely

**Solutions**:

1. Open browser console (F12) and check for errors
2. Verify playback ID is correct
3. Check network tab for failed requests
4. Ensure stream is actually broadcasting (check OBS)

---

## 📊 Verify in Mux Dashboard

1. Go to: https://dashboard.mux.com/
2. Login with your Mux account
3. Navigate to: **Video** → **Live Streams**
4. You should see your stream listed with status: `idle` or `active`
5. Click on the stream to see details, metrics, and playback URLs

---

## 🎯 Next Steps

Once streaming works locally:

1. **Test all features**:
   - Create stream
   - Start/stop stream
   - Delete stream
   - View stream metrics
   - Watch as viewer

2. **Test different scenarios**:
   - Multiple viewers
   - Reconnecting after disconnect
   - Stopping and restarting stream
   - Different bitrates/resolutions

3. **Production deployment**:
   - Update production `.env` with Mux credentials
   - Run migration on production database
   - Deploy updated code
   - Test in production environment

---

## 📝 Useful Commands

```bash
# Start dev server
npm run dev

# Check database connection
npm run setup-db

# View logs (in terminal running npm run dev)
# Look for Mux-related logs like:
# "✅ Mux stream created successfully"
# "🎬 Creating Mux stream..."
```

---

## 🔗 Useful Links

- **Mux Documentation**: https://docs.mux.com/
- **Mux Live Streaming Guide**: https://docs.mux.com/guides/video/stream-live-to-mux
- **Mux Player React**: https://github.com/muxinc/elements/tree/main/packages/mux-player-react
- **OBS Studio**: https://obsproject.com/
- **Mux Dashboard**: https://dashboard.mux.com/

---

## 💡 Tips

1. **Test with a low-latency setting** - Mux supports low-latency HLS
2. **Monitor stream health** in Mux dashboard
3. **Use thumbnails** - Mux auto-generates them at `https://image.mux.com/{playback_id}/thumbnail.jpg`
4. **Recording** - Mux auto-records streams (can be disabled)
5. **Metrics** - Check Mux dashboard for viewer analytics

---

**Need help?** Check the Mux documentation or create an issue!
