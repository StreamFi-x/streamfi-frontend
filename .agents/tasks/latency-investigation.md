# StreamFi Latency Mode Implementation Investigation

**Date:** 2025-01-27  
**Issue Reference:** #1173  
**Task:** Investigate current latency mode handling to plan implementation of per-stream latency configuration

---

## Executive Summary

The StreamFi frontend has **partial support** for latency mode:
- Database schema includes `latency_mode` column (defaults to "low")
- Creator settings page allows toggling between "low" and "standard" modes
- Mux stream creation respects the latency preference
- Playback dynamically uses `streamType="live:dvr"` vs `streamType="live"` based on latency
- **Gap:** Latency mode is a **global user preference**, not per-stream configurable before go-live
- **Gap:** No UI prompts during stream creation to let creators choose latency for that specific stream

---

## 1. Files Referencing latencyMode and createMuxStream

### Core Library Files

| File | References | Purpose |
|------|-----------|---------|
| `/lib/mux/server.ts` | `createMuxStream()` function (lines 61-128) | Main Mux stream creation handler; accepts `latencyMode` parameter |
| `/db/migrations/add-latency-mode.sql` | Migration (294 bytes) | Adds `latency_mode VARCHAR(10)` column to users table, defaults to "low" |
| `/db/migrations/add-mux-provisioning-flags.sql` | Migration (471 bytes) | Adds tracking flags: `mux_stream_provisioned_with_dvr` and `mux_stream_provisioned_with_signed_playback` |

### API Routes

| File | References | Purpose |
|------|-----------|---------|
| `/app/api/streams/create/route.ts` | Lines 185-196 | Stream creation flow; reads user's saved `latency_mode`, passes to `createMuxStream()` |
| `/app/api/streams/key/route.ts` | Lines 52, 72, 95 | GET endpoint returning stream credentials; includes current user's `latencyMode` |
| `/app/api/streams/reprovision/route.ts` | Lines 37, 59-62, 70-71 | POST endpoint to rotate stream key with new latency settings; reads `latency_mode`, passes to new Mux stream creation |
| `/app/api/users/updates/[wallet]/route.ts` | Lines 185-188 | PUT endpoint for user profile updates; handles `latency_mode` form field, saves to DB |
| `/app/api/users/register/route.ts` | Lines 161-164 | User registration flow; creates initial stream with default latency |

### UI Components

| File | References | Purpose |
|------|-----------|---------|
| `/components/settings/stream-channel-preferences/stream-preference.tsx` | Lines 141-142, 185-186, 499-528, 947-972 | Global stream preference UI; toggle between "low" and "standard" latency modes, persists choice |
| `/components/stream/view-stream.tsx` | Lines 662, 697 | Playback configuration; selects `streamType` based on `userData.latencyMode` |
| `/components/VideoPlayerMux.tsx` | Imports MuxPlayer, no explicit latency prop | Mux player wrapper; receives `streamType` from parent (view-stream.tsx) |
| `/app/[username]/watch/page.tsx` | Lines 31, 306 | Watch page; retrieves user's `latency_mode` from DB, passes to VideoPlayerMux |
| `/app/dashboard/home/page.tsx` | Stream credentials section | Dashboard homepage showing stream credentials; no latency selector during go-live |
| `/components/dashboard/stream-manager/StreamControls.tsx` | Lines 22, 44-50, 73-79 | Stream start/stop controls in dashboard; no latency selector visible |

### Test Files

| File | References | Purpose |
|------|-----------|---------|
| `/app/api/streams/create/__tests__/route.test.ts` | Line 125 | Stream creation test; validates flow with `latency_mode: "low"` in mock data |
| `/__tests__/issues-1618-1616-1615-1614.test.ts` | Lines 47, 58-61 | Tests `createMuxStream` with `withSignedPlayback` flag |
| `/__tests__/devpeter-features.test.ts` | Line 62 | WebRTC ingest test; references `estimatedLatencyMs` metric |

---

## 2. Current Default/Hardcoded Latency Setting

### Default Behavior

```typescript
// lib/mux/server.ts, line 77
const latencyMode = streamData?.latencyMode ?? "low";
```

**Hardcoded default:** `"low"` (3-5 second delay, no DVR/rewind)

### Where It's Set

1. **User Registration** (`/app/api/users/register/route.ts`):
   - New users get initial stream with no explicit latency parameter
   - Falls back to Mux default of "low"

2. **Stream Creation** (`/app/api/streams/create/route.ts`, lines 185-196):
   - Reads user's saved `latency_mode` from DB
   - If not set, defaults to `"low"`
   - Passes to `createMuxStream({ latencyMode })`

3. **Reprovision** (`/app/api/streams/reprovision/route.ts`, lines 59-62):
   - Explicitly preserves existing `latency_mode` preference
   - Coerces to `"low"` or `"standard"` string

### Latency Mode States

```typescript
// Type definition: "low" | "standard"
// - "low": ~3-5s delay, viewers cannot rewind (no DVR)
// - "standard": ~10-15s delay, viewers can scrub backward via Mux DVR feature
```

---

## 3. Stream Creation API Route — Full Configuration

### Mux Stream Creation Call

**Route:** `POST /api/streams/create/route.ts` (lines 191-196)

```typescript
muxStream = await createMuxStream({
  name: `${user.username} - ${title}`,
  record: enableRecording,      // Boolean from user.enable_recording
  latencyMode,                  // "low" | "standard" from user.latency_mode
});
```

### Mux SDK Call (lib/mux/server.ts, lines 80-96)

```typescript
const liveStream = await muxCall(options =>
  mux.video.liveStreams.create(
    {
      playback_policy: policies as any,  // ["public"] or ["public", "signed"]
      ...(record && {
        new_asset_settings: {
          playback_policy: policies as any,
        },
      }),
      passthrough: `${MUX_CREATE_PASSTHROUGH_PREFIX}${randomUUID()}`,
      reconnect_window: 60,
      latency_mode: latencyMode,          // "low" or "standard" → Mux API
      max_continuous_duration: 43200,     // 12 hours
    },
    options
  )
);
```

### Configuration Object Passed to Mux

| Field | Value | Source |
|-------|-------|--------|
| `playback_policy` | `["public"]` or `["public", "signed"]` | `withSignedPlayback` param (stream privacy) |
| `new_asset_settings` | `{ playback_policy: [...] }` | Conditional if `record=true` |
| `passthrough` | `"streamfi:create:{uuid}"` | Mux orphan-sweep tagging (#758) |
| `reconnect_window` | `60` | Hard-coded (reconnect tolerance in seconds) |
| **`latency_mode`** | **`"low"` or `"standard"`** | **User's saved `latency_mode` or default "low"** |
| `max_continuous_duration` | `43200` | Hard-coded (12 hours; prevents accidental infinite streams) |

---

## 4. Stream Setup UI Components — Settings Exposed to Creators Today

### Where Latency is Configured

**Page:** `/settings/stream-preference` (Settings → Stream Preferences)

**Component:** `/components/settings/stream-channel-preferences/stream-preference.tsx`

### Current UI

```
┌─────────────────────────────────────────────┐
│          DVR / Rewind Toggle                │
├─────────────────────────────────────────────┤
│ Description:                                 │
│  • "Standard latency mode is active.        │
│    Viewers can scrub backward during your   │
│    live stream (10–15 second delay)."       │
│  OR                                          │
│  • "Low latency mode is active. Minimal     │
│    delay (~3–5 seconds), but viewers       │
│    cannot rewind the stream."               │
│                                              │
│ "Changes take effect on your next stream.  │
│  Existing streams are not affected."        │
│                                              │
│ [Toggle Switch] Saving…                     │
└─────────────────────────────────────────────┘
```

**Code Reference:** `/components/settings/stream-channel-preferences/stream-preference.tsx`, lines 947-972

### Handler

```typescript
const handleLatencyToggle = async () => {
  // User toggles preference
  const newValue = latencyMode === "low" ? "standard" : "low";
  
  // PUT to /api/users/updates/{wallet}
  const res = await fetch(`/api/users/updates/${address}`, {
    method: "PUT",
    body: new FormData().append("latency_mode", newValue),
  });
  
  // Saves globally to users.latency_mode column
  // Takes effect on NEXT stream only
};
```

### Other Settings Available During Setup

| Setting | Location | Type | Current State |
|---------|----------|------|---------------|
| **Stream Title** | Stream creation flow | Text | Required at go-live |
| **Description** | Stream creation flow | Text | Optional at go-live |
| **Category** | Stream creation flow | Select | Optional at go-live |
| **Tags** | Stream creation flow | Array | Optional at go-live |
| **Recording** | Settings → Stream Preferences | Toggle | Global, applies to all streams |
| **Latency** | Settings → Stream Preferences | Toggle | **Global**, applies to all streams |
| **Stream Access** | Settings → Stream Preferences | Select (public/password/subscription) | Global |
| **Stream Password** | Settings → Stream Preferences | Text | Global (if password mode) |

### Gap: No Per-Stream Latency Selector at Go-Live

**Current flow:**
1. Creator sets global preference in Settings (takes effect on next stream)
2. Creator clicks "Start Stream" or streams via OBS
3. No UI prompts or reminders about latency choice
4. Stream uses whatever global preference was saved

---

## 5. Database Schema for Streams Table

### Users Table — Stream-Related Columns

```sql
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(255) UNIQUE NOT NULL,
    
    -- Mux Stream References
    mux_stream_id VARCHAR(255),                    -- Primary stream ID
    mux_playback_id VARCHAR(255),                  -- Public playback ID
    mux_stream_key VARCHAR(255),                   -- RTMP broadcast key
    mux_signed_playback_id VARCHAR(255),           -- Signed (private) playback ID
    
    -- Stream State
    is_live BOOLEAN DEFAULT FALSE,
    stream_started_at TIMESTAMP WITH TIME ZONE,
    current_viewers INTEGER DEFAULT 0,
    total_views INTEGER DEFAULT 0,
    
    -- Stream Preferences (GLOBAL, all streams use same settings)
    enable_recording BOOLEAN DEFAULT false,
    latency_mode VARCHAR(10) DEFAULT 'low',        -- 'low' | 'standard'
    stream_access_type TEXT DEFAULT 'public',      -- 'public' | 'password' | 'subscription'
    stream_password_hash VARCHAR(255),             -- Hashed password if mode='password'
    stream_privacy VARCHAR(20) DEFAULT 'public',   -- 'public' | 'private' (legacy; also checked)
    share_token VARCHAR(64),                       -- Random token for unlisted/sub-only streams
    
    -- Provisioning Flags (Mux sync state)
    mux_stream_provisioned_with_dvr BOOLEAN DEFAULT FALSE,
    mux_stream_provisioned_with_signed_playback BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    creator JSONB DEFAULT '{}',                    -- { streamTitle, description, category, tags, ... }
    
    -- Additional Fields (not stream-specific)
    email VARCHAR(255),
    avatar VARCHAR(255),
    bio TEXT,
    socialLinks JSONB,
    followers UUID[],
    following UUID[],
    ...
);

-- Migrations Applied
-- add-latency-mode.sql:              latency_mode VARCHAR(10) DEFAULT 'low'
-- add-mux-provisioning-flags.sql:    mux_stream_provisioned_with_dvr, mux_stream_provisioned_with_signed_playback
-- add-stream-recording.sql:          enable_recording BOOLEAN DEFAULT false
```

### Key Observations

1. **All stream preferences are stored per-user, not per-stream**
   - Single `latency_mode` column applies to ALL future streams
   - No per-stream override mechanism exists

2. **Provisioning flags track sync state**
   - `mux_stream_provisioned_with_dvr`: true if current Mux stream was created with DVR
   - `mux_stream_provisioned_with_signed_playback`: true if current Mux stream supports signed playback
   - Used by `/api/streams/reprovision` to detect "out of sync" scenarios

3. **No per-stream settings table**
   - Stream sessions are recorded in `stream_sessions` table (started_at, ended_at, etc.)
   - But `stream_sessions` table has no `latency_mode` or `recording_enabled` columns
   - Settings are only on `users` table

---

## 6. VideoPlayerMux Component — Playback Configuration

### File
`/components/VideoPlayerMux.tsx` (100+ lines)

### Component Signature

```typescript
interface VideoPlayerMuxProps {
  playbackId: string;
  /** Stream title reported to Mux Data. */
  title?: string;
  /**
   * Signed-in viewer's wallet address or user id; omit when logged out. It is
   * hashed before it reaches Mux Data, never sent as is.
   */
  viewerIdentity?: string | null;
  addLog: (message: string, type?: "info" | "success" | "error") => void;
}
```

### Latency-Related Configuration

**VideoPlayerMux does NOT receive a `streamType` prop directly.** The latency mode is handled by its parent component.

### Parent Component: view-stream.tsx (lines 662, 697)

```typescript
<MuxPlayer
  playbackId={userData.playbackId}
  streamType={userData.latencyMode === "standard" ? "live:dvr" : "live"}
  // streamType determines DVR availability:
  //   - "live": low-latency (no DVR)
  //   - "live:dvr": standard latency (DVR enabled)
  autoPlay="muted"
  metadata={{
    video_id: userData.playbackId,
    video_title: streamData.title || `${username}'s Stream`,
    viewer_user_id: "anonymous",  // or hashed auth user ID
  }}
  primaryColor="#ac39f2"
  className="w-full h-full"
/>
```

### How Latency Flows to Playback

1. **Watch Page** (`/app/[username]/watch/page.tsx`, line 306):
   ```typescript
   latencyMode: userData.latency_mode || "low",
   ```

2. **View-Stream Component** (`/components/stream/view-stream.tsx`):
   ```typescript
   streamType={userData.latencyMode === "standard" ? "live:dvr" : "live"}
   ```

3. **MuxPlayer SDK** (Mux library):
   - `streamType="live"` → Mux serves low-latency feed (~3-5s)
   - `streamType="live:dvr"` → Mux serves DVR-enabled feed (~10-15s), allows scrubbing backward

### No Explicit Latency Props in VideoPlayerMux

- VideoPlayerMux does not need a separate latency prop
- Mux SDK handles DVR state based on `streamType` string
- Quality selection, network awareness, and other features work independently

---

## 7. Existing Per-Stream Settings Infrastructure

### What Exists

1. **Global User Settings** (all in `users` table):
   - `latency_mode` — applies to all future streams
   - `enable_recording` — applies to all future streams
   - `stream_access_type`, `stream_privacy`, `stream_password_hash` — apply to all future streams

2. **Stream Session Metadata** (`stream_sessions` table):
   ```sql
   CREATE TABLE IF NOT EXISTS stream_sessions (
       id UUID PRIMARY KEY,
       user_id UUID REFERENCES users(id) ON DELETE CASCADE,
       mux_session_id VARCHAR(255),
       title VARCHAR(255),
       playback_id VARCHAR(255),
       started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
       ended_at TIMESTAMP WITH TIME ZONE,
       duration_seconds INTEGER GENERATED ALWAYS AS (...),
       peak_viewers INTEGER DEFAULT 0,
       total_unique_viewers INTEGER DEFAULT 0,
       total_messages INTEGER DEFAULT 0,
       avg_bitrate INTEGER,
       resolution VARCHAR(20),
       created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
   );
   ```
   - Records stream metadata (duration, peak viewers, etc.)
   - **Does NOT include** `latency_mode`, `recording_enabled`, or other per-stream settings

3. **Provisioning Flags** (global, not per-stream):
   - `mux_stream_provisioned_with_dvr` — tells UI if current Mux stream supports DVR
   - `mux_stream_provisioned_with_signed_playback` — tells UI if current Mux stream has signed playback

### What Does NOT Exist

- [ ] Per-stream latency preference (all streams use user's global setting)
- [ ] Per-stream recording preference override (all streams use user's global setting)
- [ ] Per-stream privacy override (all streams use user's global setting)
- [ ] Stream creation UI that prompts for latency before go-live
- [ ] Database migration to add per-stream settings columns
- [ ] API endpoint to change stream settings after creation but before going live

---

## 8. Gap Analysis: What's Missing to Implement #1173

### Issue #1173 Requirements

> Per-stream latency mode selector before go-live, persistence of creator choice, accurate tradeoff messaging, and tests

### Missing Pieces

#### 1. **Database Schema Changes**

**Current State:** Settings stored on `users` table (global)

**What's Needed:**
- [ ] Add per-stream settings columns to `stream_sessions` table:
  ```sql
  ALTER TABLE stream_sessions ADD COLUMN IF NOT EXISTS latency_mode VARCHAR(10);
  ALTER TABLE stream_sessions ADD COLUMN IF NOT EXISTS enable_recording BOOLEAN;
  ```
  
- [ ] OR create a new `stream_preferences` table:
  ```sql
  CREATE TABLE stream_preferences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      stream_session_id UUID REFERENCES stream_sessions(id) ON DELETE CASCADE,
      latency_mode VARCHAR(10) NOT NULL,
      enable_recording BOOLEAN NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  ```

#### 2. **Stream Creation API Changes**

**Current State:** 
- `/api/streams/create` reads user's global `latency_mode`
- No ability to override for a specific stream

**What's Needed:**
- [ ] Accept optional `latencyMode` in POST body
- [ ] Store chosen latency with stream session (DB)
- [ ] Pass to Mux during stream creation

```typescript
// Example flow:
POST /api/streams/create {
  title: "My Stream",
  latencyMode: "standard"  // NEW: per-stream choice
}
```

#### 3. **Stream Setup UI Changes**

**Current State:**
- Stream creation form only asks for title, description, category, tags
- No latency selector
- No messaging about latency tradeoffs

**What's Needed:**
- [ ] Add latency mode selector to stream creation modal/form
- [ ] Show clear messaging:
  - "Low latency (~3-5s): Minimal delay, viewers cannot rewind"
  - "Standard latency (~10-15s): Viewers can rewind/DVR, slightly higher delay"
- [ ] Default to user's global preference (with visual override indicator)
- [ ] Form validation ensures valid choice ("low" | "standard")

#### 4. **Mux Reprovision Flow Changes**

**Current State:**
- `/api/streams/reprovision` recreates stream with global settings
- Works, but only for post-creation settings changes

**What's Needed:**
- [ ] If per-stream choice differs from what Mux has, require reprovision
- [ ] Warning message: "New latency setting requires stream restart"
- [ ] Ideally: let creator change latency BEFORE first broadcast (no reprovision needed)

#### 5. **Playback Configuration**

**Current State:**
- Works correctly; reads `userData.latencyMode` and sets `streamType` accordingly
- ✅ No changes needed here

#### 6. **Testing**

**Current State:**
- `/app/api/streams/create/__tests__/route.test.ts` exists but minimal
- No explicit latency mode tests

**What's Needed:**
- [ ] Unit tests:
  - Stream creation with explicit `latencyMode` parameter
  - Mux SDK called with correct `latency_mode` value
  - Global default applied when not specified
  
- [ ] Integration tests:
  - Creator sets latency during stream creation
  - Playback uses correct `streamType` for chosen latency
  - Reprovision updates latency correctly
  
- [ ] UI tests:
  - Latency selector appears in stream creation form
  - Toggle works correctly
  - Messaging displays accurate tradeoffs

#### 7. **Documentation/Messaging**

**Current State:**
- Settings page has brief description of DVR mode
- No guidance on choosing latency before stream starts

**What's Needed:**
- [ ] Clear explanation in stream creation UI:
  - Latency tradeoff (delay vs. rewindability)
  - Cannot change mid-stream (must restart)
  - Default recommendation (probably "low" for best experience)
  
- [ ] Post-stream guidance:
  - Show what latency was used
  - Link to settings if creator wants to change default

---

## 9. Code References for Each Finding

### Latency Mode Default

- **Default value:** `/lib/mux/server.ts`, line 77
  ```typescript
  const latencyMode = streamData?.latencyMode ?? "low";
  ```

- **Mux API call:** `/lib/mux/server.ts`, line 93
  ```typescript
  latency_mode: latencyMode,
  ```

### Database Schema

- **Migration:** `/db/migrations/add-latency-mode.sql`
  ```sql
  ALTER TABLE users ADD COLUMN IF NOT EXISTS latency_mode VARCHAR(10) DEFAULT 'low';
  ```

- **Users table definition:** `/db/schema.sql`, line 38
  ```sql
  enable_recording BOOLEAN DEFAULT false
  ```
  (and other stream settings)

### Stream Creation Flow

- **API route:** `/app/api/streams/create/route.ts`, lines 185-196
  ```typescript
  const latencyMode = (
    user.latency_mode === "standard" ? "standard" : "low"
  ) as "low" | "standard";
  muxStream = await createMuxStream({
    name: `${user.username} - ${title}`,
    record: enableRecording,
    latencyMode,
  });
  ```

### User Settings Update

- **API route:** `/app/api/users/updates/[wallet]/route.ts`, lines 71-82
  ```typescript
  const latencyModeRaw = formData.get("latency_mode");
  const latencyMode = latencyModeRaw !== null ? String(latencyModeRaw) : user.latency_mode || "low";
  ```

### Settings UI

- **Component:** `/components/settings/stream-channel-preferences/stream-preference.tsx`, lines 141-142, 499-528
  ```typescript
  const [latencyMode, setLatencyMode] = useState<"low" | "standard">("low");
  const handleLatencyToggle = async () => { ... };
  ```

### Playback Configuration

- **View stream:** `/components/stream/view-stream.tsx`, line 662
  ```typescript
  streamType={userData.latencyMode === "standard" ? "live:dvr" : "live"}
  ```

- **Watch page:** `/app/[username]/watch/page.tsx`, line 306
  ```typescript
  latencyMode: userData.latency_mode || "low",
  ```

### Provisioning Flags

- **Migration:** `/db/migrations/add-mux-provisioning-flags.sql`
  ```sql
  ALTER TABLE users ADD COLUMN IF NOT EXISTS mux_stream_provisioned_with_dvr BOOLEAN DEFAULT FALSE;
  ```

- **Reprovision route:** `/app/api/streams/reprovision/route.ts`, lines 85-89
  ```typescript
  await sql`UPDATE users SET
    mux_stream_provisioned_with_dvr = ${latencyMode === "standard"},
    ...
  ```

---

## 10. Runtime Verification Notes

All findings above are based on **source code analysis**. The following was NOT verified in a running instance:

- ✅ Stream creation flow end-to-end (code shows clear flow)
- ✅ Latency mode persistence (DB schema exists, API endpoints handle reads/writes)
- ✅ Mux stream creation with latency parameter (SDK integration is straightforward)
- ⚠️ Playback `streamType` behavior with Mux SDK (code is correct; Mux library behavior assumed per docs)
- ⚠️ Actual latency perceived by viewers (would require live stream test with network monitoring)
- ⚠️ DVR/rewind feature availability (depends on Mux account configuration and billing)

---

## Summary: Implementation Readiness

### ✅ Already in Place

1. Database column `latency_mode` exists with "low" | "standard" type
2. Global user preference UI and persistence works
3. Stream creation respects global latency preference
4. Playback correctly selects DVR mode based on latency
5. Reprovision flow exists for updating stream settings
6. Error handling and logging is comprehensive

### ❌ Missing for #1173

1. **Per-stream latency choice at creation time**
   - Need UI form field in stream creation modal
   - Need to pass latency in POST body to `/api/streams/create`

2. **Persist per-stream choice**
   - Add `latency_mode` column to `stream_sessions` table
   - OR create `stream_preferences` join table

3. **Accurate tradeoff messaging**
   - Current Settings page has brief description
   - Need clear explanation in stream creation form

4. **Tests**
   - Add test for stream creation with explicit latency parameter
   - Add playback test verifying correct `streamType` based on latency

### Next Steps

1. Design database schema (stream_sessions.latency_mode or separate table)
2. Update `/api/streams/create` to accept `latencyMode` parameter
3. Build UI form in stream creation flow
4. Add integration tests
5. Deploy with messaging about latency choice

---

**Investigation Complete** ✓
