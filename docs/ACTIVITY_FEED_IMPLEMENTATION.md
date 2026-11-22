# Activity Feed Implementation Guide - Issue #1817

## Overview

The Recent Events section in the stream manager dashboard is currently a **permanently empty placeholder** that never displays real events. This document describes the current state and required implementation for populating it with real stream events.

## Current State

### Location
- **Component**: `/components/dashboard/stream-manager/ActivityFeed.tsx`
- **Parent**: `/app/dashboard/stream-manager/page.tsx`
- **Display Section**: "Recent Events" tab in the activity feed

### What It Shows Now

The component renders one of two static empty state messages depending on stream status:

```typescript
{isLive ? (
  <>
    <Activity className="w-6 h-6 mb-2" />
    <p className="text-xs">Watching for new events…</p>
  </>
) : (
  <>
    <Radio className="w-6 h-6 mb-2" />
    <p className="text-xs">Events appear here when you go live</p>
  </>
)}
```

### What's Missing

1. **No Real-Time Subscription**: No connection to server-side event sources
2. **No Event Array**: No state management for storing events
3. **No Event Rendering**: No UI to display actual events
4. **No Event Types**: Not wired to tips, followers, raids, or chat events

## Required Implementation

### Event Types to Display (Priority Order)

1. **Tips** (Highest Priority)
   - Event source: Already available server-side via tip counter
   - Data needed: Tipper username, amount, message
   - Related component: `TipCounter` (already functional)

2. **New Followers**
   - Event source: Need server-side implementation
   - Data needed: Follower username, timestamp

3. **Raids**
   - Event source: Need server-side implementation
   - Data needed: Raider username, viewer count, timestamp

4. **Notable Chat Moments**
   - Event source: Chat service integration
   - Data needed: Username, message, timestamp

### Architecture Pattern

The implementation should:

1. **Use Existing Patterns**
   - Follow the same subscription pattern as `TipCounter`
   - Use existing real-time infrastructure (WebSocket/SSE)
   - Maintain component props interface in `ActivityFeedProps`

2. **State Management**
   - Store events in component state: `useState<StreamEvent[]>`
   - Define `StreamEvent` type with common fields:
     ```typescript
     interface StreamEvent {
       id: string;
       type: 'tip' | 'follow' | 'raid' | 'chat_moment';
       username: string;
       timestamp: Date;
       data: Record<string, unknown>; // Event-specific data
     }
     ```

3. **Real-Time Subscription**
   - Subscribe to event sources when `isLive === true`
   - Unsubscribe when stream goes offline
   - Implement auto-refresh every 30s as fallback

4. **UI Components**
   - Create `EventListItem` component for individual events
   - Display events in reverse chronological order (newest first)
   - Show event-specific icons and formatting per type

### Integration Points

#### 1. Tip Events (Start Here)
- Connect to existing `TipCounter` hook
- Mirror the event data structure
- Use same refresh interval (30s default)

#### 2. Server-Side Events
- Need API endpoint: `GET /api/streams/{streamId}/events`
- Query parameters: `?after=timestamp&types=tip,follow,raid`
- Implement pagination with cursor-based scrolling

#### 3. Real-Time Updates (WebSocket)
- Subscribe to stream events channel
- Listen for `event:created` messages
- Parse and add to local state

### Acceptance Criteria

From issue #1817:

> The recent events section displays real events, starting with at least tips and new followers, as they occur during an active stream, verified by triggering a real tip during a test broadcast and confirming it appears in the feed.

**Implementation must pass:**

- [ ] Component renders real events instead of placeholder text
- [ ] Tips appear in feed when new tip is sent during active stream
- [ ] New followers appear in feed when someone follows during stream
- [ ] Events display in reverse chronological order
- [ ] Placeholder text only shows when actually offline/no events
- [ ] Events persist across component re-renders
- [ ] Real-time updates working via subscription (not polling only)

## Testing Considerations

### Manual Testing Steps
1. Start a test broadcast
2. Send a test tip to the stream
3. Verify tip appears in Recent Events feed within 1-2 seconds
4. Have someone follow the stream account
5. Verify follow event appears in feed
6. Confirm formatting matches design

### Automated Testing
- Unit tests for event filtering and sorting
- Integration tests for subscription lifecycle
- Mock server events and verify rendering

## Comparison with Working Features

The **Tip Earnings** section (directly above Recent Events) demonstrates a working real-time update:
- Uses `TipCounter` component
- Connects to tip data source
- Shows "Watching for new events…" message but actually refreshes
- Has auto-refresh enabled every 30s

The **Recent Events** section should follow the same pattern but display a list of diverse events.

## Related Components

- `TipCounter` - Demonstrates active subscription pattern
- `SessionStat` - Reusable stat display component
- Activity icon components - Use existing icon set

## Implementation Path

### Phase 1: Tip Events Only
- Connect ActivityFeed to tip event source
- Render tip events in list format
- Verify subscription and real-time updates

### Phase 2: Additional Event Types
- Add follower event support
- Add raid event support
- Extend UI for diverse event types

### Phase 3: Advanced Features
- Event filtering UI
- Event persistence (recent history)
- Event actions (reply to tipper, etc.)

## Related Issues
- #1817 - Main issue for activity feed implementation
