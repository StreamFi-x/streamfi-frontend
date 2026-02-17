# StreamFi - Persistent Stream Key Flow

## Overview

StreamFi now uses **persistent stream keys** (like Twitch) instead of creating/deleting streams each time.

## New Flow

### 1. User Signup

- User signs up → Auto-creates permanent Mux stream
- Stream key is saved to user account
- **Stream key never changes** (unless manually regenerated)

### 2. Stream Key Management

- Stream key shown in Settings page (confidential)
- User uses same key for all streams
- **Never share stream key** - anyone with it can stream to your channel

### 3. Going Live

- User starts OBS with their permanent stream key
- Calls `/api/streams/start` → Marks stream as "live" in database
- No new Mux stream created

### 4. Going Offline

- User stops OBS
- Calls `/api/streams/stop` → Marks stream as "offline"
- Stream key remains active for next time

---

## API Endpoints

### 1. Create/Get Stream (POST `/api/streams/create`)

**Purpose:** Get or create persistent stream

**Request:**

```json
{
  "wallet": "0x...", // Optional in dev mode
  "title": "Stream Title",
  "description": "Stream description",
  "category": "Gaming",
  "tags": ["tag1", "tag2"]
}
```

**Response (Existing Stream):**

```json
{
  "message": "Stream already exists",
  "streamData": {
    "streamId": "mux_stream_id",
    "playbackId": "playback_id",
    "streamKey": "secret_stream_key",
    "rtmpUrl": "rtmp://global-live.mux.com:5222/app",
    "isActive": false,
    "persistent": true
  }
}
```

**Response (New Stream):**

```json
{
  "message": "Stream created successfully",
  "streamData": {
    "streamId": "mux_stream_id",
    "playbackId": "playback_id",
    "streamKey": "secret_stream_key",
    "rtmpUrl": "rtmp://global-live.mux.com:5222/app",
    "isActive": false
  }
}
```

### 2. Start Stream (POST `/api/streams/start`)

**Purpose:** Mark stream as live

**Request:**

```json
{
  "wallet": "0x..." // Optional in dev mode
}
```

**Response:**

```json
{
  "message": "Stream started successfully",
  "streamData": {
    "isLive": true,
    "streamId": "mux_stream_id",
    "playbackId": "playback_id",
    "username": "user123",
    "startedAt": "2026-02-16T10:30:00.000Z"
  }
}
```

### 3. Stop Stream (DELETE `/api/streams/start`)

**Purpose:** Mark stream as offline

**Request:**

```json
{
  "wallet": "0x..." // Optional in dev mode
}
```

**Response:**

```json
{
  "message": "Stream stopped successfully"
}
```

### 4. Get Stream Key (GET `/api/streams/key?wallet=0x...`)

**Purpose:** Get user's persistent stream key for settings page

**Response:**

```json
{
  "message": "Stream key retrieved successfully",
  "hasStream": true,
  "streamData": {
    "streamKey": "secret_stream_key",
    "streamId": "mux_stream_id",
    "playbackId": "playback_id",
    "rtmpUrl": "rtmp://global-live.mux.com:5222/app",
    "isLive": false
  }
}
```

---

## Development Mode

### Enabling Dev Mode

Add to `.env.local`:

```bash
NEXT_PUBLIC_DEV_MODE=true
```

### What Dev Mode Does

1. **Bypasses Authentication**
   - No wallet required in API calls
   - Uses test wallet: `0x04fef7247897775ee856f4a2c52b460300b67306c14a200ce71eb1f9190a388e`

2. **Allows Frontend Development**
   - Build stream page without wallet connection
   - Test all features locally
   - No session/cookie checks

### Using Dev Mode

**Without wallet (dev mode):**

```javascript
// Automatically uses test wallet
fetch("/api/streams/create", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: "Test Stream",
    description: "Testing",
  }),
});
```

**With wallet (production):**

```javascript
fetch("/api/streams/create", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    wallet: userWallet,
    title: "My Stream",
    description: "Live coding",
  }),
});
```

---

## Frontend Integration Guide

### 1. Stream Page Component

```typescript
'use client';

import { useState, useEffect } from 'react';
import VideoPlayerMux from '@/components/VideoPlayerMux';

export default function StreamPage() {
  const [streamData, setStreamData] = useState(null);
  const [isLive, setIsLive] = useState(false);

  // Get or create stream on mount
  useEffect(() => {
    fetch('/api/streams/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'My Stream',
        description: 'Live stream'
      })
    })
      .then(res => res.json())
      .then(data => setStreamData(data.streamData));
  }, []);

  if (!streamData) return <div>Loading...</div>;

  return (
    <div>
      <h1>Live Stream</h1>

      {/* Mux Player */}
      <VideoPlayerMux
        playbackId={streamData.playbackId}
        addLog={console.log}
      />

      {/* Stream Info */}
      <div>
        <p>Status: {isLive ? '🔴 LIVE' : '⚫ Offline'}</p>
        <p>Playback ID: {streamData.playbackId}</p>
      </div>
    </div>
  );
}
```

### 2. Settings Page (Stream Key)

```typescript
'use client';

import { useState, useEffect } from 'react';

export default function StreamSettings() {
  const [streamKey, setStreamKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    fetch('/api/streams/key')
      .then(res => res.json())
      .then(data => {
        if (data.hasStream) {
          setStreamKey(data.streamData.streamKey);
        }
      });
  }, []);

  return (
    <div>
      <h2>Stream Settings</h2>

      <div>
        <label>Stream Key (Keep Secret!)</label>
        <div>
          {showKey ? streamKey : '••••••••••••••••'}
          <button onClick={() => setShowKey(!showKey)}>
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      <div>
        <label>RTMP Server</label>
        <input
          readOnly
          value="rtmp://global-live.mux.com:5222/app"
        />
      </div>

      <div>
        <p>⚠️ Never share your stream key!</p>
        <p>Anyone with this key can stream to your channel.</p>
      </div>
    </div>
  );
}
```

---

## OBS Configuration

### Setup (One Time)

1. **OBS Settings → Stream**
   - Service: `Custom`
   - Server: `rtmp://global-live.mux.com:5222/app`
   - Stream Key: `[Get from Settings Page]`

2. **Save Settings**
   - Stream key is saved in OBS
   - Use same key forever

### Going Live

1. Click "Start Streaming" in OBS
2. Video starts broadcasting to Mux
3. Call `/api/streams/start` to mark as live
4. Viewers can watch

### Going Offline

1. Click "Stop Streaming" in OBS
2. Call `/api/streams/stop` to mark as offline

---

## Security Notes

### Stream Key Security

⚠️ **CRITICAL: Treat stream keys like passwords!**

- **Never** commit stream keys to git
- **Never** show stream keys in public UI without masking
- **Never** log stream keys
- **Always** use HTTPS for API calls
- **Consider** adding stream key rotation feature

### API Security

For production, add proper authentication:

```typescript
// Middleware example (app/api/middleware.ts)
export function middleware(req: Request) {
  // Verify JWT token
  // Verify wallet signature
  // Rate limiting
  // etc.
}
```

---

## Migration from Old Flow

### Old Flow (Delete When Done)

```typescript
// ❌ OLD: Create new stream each time
createStream() → stream
useStream(stream)
deleteStream()
createStream() // New stream!
```

### New Flow

```typescript
// ✅ NEW: One persistent stream
getOrCreateStream() → stream (persistent)
startStream() // Mark live
useStream(stream)
stopStream() // Mark offline
// Stream key remains for next time
```

---

## Testing

### Test Persistent Stream Key

```bash
# 1. Get or create stream
curl -X POST http://localhost:3000/api/streams/create \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Stream",
    "description": "Testing persistent keys"
  }'

# 2. Get stream key
curl http://localhost:3000/api/streams/key

# 3. Start stream
curl -X POST http://localhost:3000/api/streams/start \
  -H "Content-Type: application/json" \
  -d '{}'

# 4. Stop stream
curl -X DELETE http://localhost:3000/api/streams/start \
  -H "Content-Type: application/json" \
  -d '{}'

# 5. Get stream key again (should be same!)
curl http://localhost:3000/api/streams/key
```

---

## Summary

✅ **What Changed:**

- Stream keys are now persistent (never deleted)
- No more create/delete cycle
- One stream per user (like Twitch)
- Dev mode for frontend development
- New `/api/streams/key` endpoint

✅ **What Stayed the Same:**

- Mux integration
- RTMP streaming
- Video player
- Database structure (added persistence)

✅ **Benefits:**

- Simpler user experience
- No need to reconfigure OBS
- Matches industry standard (Twitch/YouTube)
- Easier to integrate in frontend
- Stream keys are confidential
