# Bandwidth-Aware and Metered-Connection-Aware Quality Selection

## Overview

This document describes the implementation of proactive, network-aware video quality selection for StreamFi viewers. The system detects connection constraints (metered connections, data-saving mode, limited bandwidth) and intelligently caps streaming quality to respect user preferences and network limitations.

## Problem Statement

Previously, video quality selection relied entirely on reactive adaptive bitrate (ABR) logic—adjusting quality only after detecting buffering or measured throughput issues. This approach was problematic for viewers on constrained connections:

- **High initial data burn**: Streams would start at high quality and only step down after data was already consumed
- **Ignored user preferences**: No respect for Data Saver mode or explicit metered-connection signals
- **Poor experience on limited plans**: Mobile data users with expensive or capped plans faced poor UX
- **Browser signal wasted**: The Network Information API provides free, standardized connection metadata that was completely ignored

## Solution Architecture

The solution implements a **three-tier precedence system** for quality selection:

### 1. **Manual Override** (Highest Priority)
When a viewer explicitly selects a quality, that choice is always respected, even if it conflicts with detected network constraints. This trusts the user's intent and explicit choice.

### 2. **Proactive Connection-Aware Cap** (Middle Priority)
Uses the Network Information API to detect:
- **saveData flag**: User has opted into data-saving mode (browser/OS level)
- **Connection type**: `4g`, `3g`, `2g`, `slow-2g`, `wifi`, or `unknown`
- **Effective bandwidth**: Measured downlink bandwidth in Mbps
- **Metered connection signals**: Combines multiple signals to identify limited connections

When a constraint is detected, a quality cap is applied:
- `saveData` enabled → Recommended quality based on bandwidth or connection type
- `3g` connection → Max `480p`
- `2g` connection → Max `360p`
- `slow-2g` connection → Max `240p`

### 3. **Reactive Adaptive Bitrate** (Fallback)
If no manual override or connection cap exists, the existing Mux Player ABR system handles quality selection based on buffer health and measured throughput.

## Key Features

### Browser Support & Fallback
The Network Information API is not available in all browsers (notably gaps in Safari/iOS). The implementation:
- **Gracefully degrades**: When the API is unavailable, the system operates with no constraints (falls back to ABR)
- **Maintains compatibility**: Works alongside existing reactive ABR without conflict
- **No silent failures**: Provides clear fallback behavior rather than attempting unsupported operations

### Detection Signals

#### saveData Flag
- **Source**: Browser/OS setting for data-saving mode
- **Reliability**: Very high—explicit user intent
- **False positives**: Extremely rare (only legitimate data-saver mode)
- **False negatives**: Possible if user hasn't enabled data-saver mode

#### Connection Type
- **Source**: Network Information API (`navigator.connection.effectiveType`)
- **Values**: `4g`, `3g`, `2g`, `slow-2g`, `wifi`, `unknown`
- **Reliability**: Good for broad categorization; reflects typical bandwidth ranges
- **False positives**: Possible on shared networks or misidentified connections
- **False negatives**: Possible on throttled high-bandwidth connections

#### Effective Bandwidth
- **Source**: Network Information API (`navigator.connection.downlink`)
- **Units**: Mbps (megabits per second)
- **Reliability**: Varies; typically a running average estimate
- **False positives**: Transient high-bandwidth spikes can be misinterpreted as stable
- **False negatives**: Brief congestion windows might underestimate available bandwidth

### Quality Thresholds

Based on typical streaming requirements:

| Quality | Bandwidth | Connection Types | Typical Use Case |
|---------|-----------|------------------|------------------|
| 1080p (auto) | 5+ Mbps | 4g, WiFi, optimal | Home broadband, good mobile |
| 720p | 3-5 Mbps | 4g, WiFi | Good WiFi or strong 4g |
| 480p | 1.5-2 Mbps | 3g, limited 4g | Mobile data, satellite |
| 360p | 0.8-1 Mbps | 2g, congested 3g | Very limited mobile |
| 240p | 0.3-0.5 Mbps | slow-2g, severe limits | Emergency fallback |

## Implementation

### Core Files

#### `/hooks/useNetworkQuality.ts`
React hook that:
1. Detects Network Information API availability
2. Reads saveData flag, connection type, and bandwidth
3. Computes recommended quality based on signals
4. Listens for connection changes (e.g., WiFi → cellular)
5. Returns a `NetworkQualityInfo` object with all relevant data

**Usage:**
```typescript
const networkQuality = useNetworkQuality();
// Returns: {
//   isSupported: boolean,
//   saveData: boolean,
//   connectionType: ConnectionType,
//   isMetered: boolean,
//   effectiveBandwidth: number | null,
//   recommendedQuality: Quality,
//   isConstrained: boolean,
// }
```

#### `/lib/video/quality-selection.ts`
Core quality resolution logic that:
1. Implements the three-tier precedence system
2. Resolves final quality with clear reasoning
3. Provides utility functions for constraint checking
4. Logs decisions for debugging

**Usage:**
```typescript
const result = resolveQuality({
  manualSelection: userPickedQuality,
  connectionCap: getMaxQualityForNetwork(networkQuality),
  abrSelection: muxPlayerAbrQuality,
  saveDataEnabled: networkQuality.saveData,
  isMeteredConnection: networkQuality.isMetered,
});
// Returns: {
//   quality: 'auto' | '720p' | '480p' | '360p' | '240p',
//   reason: string,
//   isConstrained: boolean,
//   isManualOverride: boolean,
// }
```

#### `/components/VideoPlayerMux.tsx` (Updated)
Enhanced Mux Player component that:
1. Uses `useNetworkQuality()` to detect constraints
2. Calls `resolveQuality()` to determine final quality
3. Passes quality cap to Mux Player as `maxResolution`
4. Displays UI indicator when quality is constrained
5. Shows network status tooltip on click

**New Props & Behavior:**
- Automatically detects and applies quality cap
- Shows indicator badge when quality is capped
- Provides hover tooltip with network details
- Respects manual quality selection if implemented

### Tests

#### `/`__tests__`/lib/video/quality-selection.test.ts`
Comprehensive test suite covering:
- Precedence rules (manual > cap > ABR > auto)
- Constraint application (saveData, metered)
- Edge cases (conflicting signals, ambiguous scenarios)
- Clear decision reasoning

#### `/`__tests__`/hooks/useNetworkQuality.test.ts`
Tests for:
- Network information API detection
- Signal interpretation and thresholds
- Quality recommendations per connection type
- Fallback behavior for unsupported browsers
- Connection change handling

## Behavioral Specifications

### Scenario: saveData Enabled, WiFi Connection

**Network Info:**
- `saveData`: true
- `connectionType`: 'wifi'
- `effectiveBandwidth`: 50 Mbps
- `isMetered`: true (due to saveData)

**Quality Resolution:**
- Recommended quality based on saveData: `480p` (conservative)
- No manual override
- **Result**: `480p` (constrained to respect data-saver mode)
- **User sees**: Quality badge, can click to override if desired

### Scenario: Metered 3G, User Hasn't Enabled Data Saver

**Network Info:**
- `saveData`: false
- `connectionType`: '3g'
- `effectiveBandwidth`: 2 Mbps
- `isMetered`: true

**Quality Resolution:**
- Recommended quality for 3G: `480p`
- No manual override
- **Result**: `480p` (capped by connection type)
- **User sees**: Quality badge with network details

### Scenario: User Manually Selected 720p Over Metered Connection

**Network Info:**
- `saveData`: false
- `connectionType`: '3g'
- `effectiveBandwidth`: 2 Mbps
- `isMetered`: true

**Quality Resolution:**
- Manual selection: `720p`
- Connection cap would recommend: `480p`
- **Result**: `720p` (manual override respected)
- **User sees**: No constraint indicator; manual selection honored
- **Note**: User explicitly chose this; system trusts their decision

### Scenario: Switching Networks Mid-Stream (WiFi → 3G)

**Initial (WiFi):**
- Quality: `auto` (no constraints)

**After Handoff to Cellular (3G):**
1. Hook detects connection change
2. Recommends `480p`
3. Quality cap applied
4. UI updates to show constraint indicator
5. Stream quality adjusts on next segment

### Scenario: Browser Without Network Information API

**Network Info:**
- `isSupported`: false
- `connectionType`: 'unknown'
- `isMetered`: false

**Quality Resolution:**
- No constraints detected
- **Result**: `auto` (full adaptive bitrate)
- **User sees**: No indicator; ABR handles quality

## Known Limitations & Edge Cases

### False Positives (Conservative Errors)
These err on the side of protecting user data:
- **Shared WiFi networks**: Legitimate high-bandwidth connection misidentified as potentially metered
- **VPN users**: May appear metered even if underlying connection is good
- **Transient congestion**: Brief slowdowns can trigger cap that persists

**Mitigation**: Users can always manually override by selecting higher quality

### False Negatives (Permissive Errors)
These allow more data usage than detected signals warrant:
- **Sophisticated evaders**: Users with custom ROMs or tools to hide data-saver mode
- **Network misidentification**: Some carriers misreport connection type (e.g., good 3G reported as 2G)
- **Bandwidth overestimation**: Temporary high throughput during initial connection negotiation

**Mitigation**: Reactive ABR still monitors actual buffer and adjusts if problems occur

### Browser Inconsistencies
- **Safari/iOS**: Network Information API not available; all viewers fall back to ABR
- **Android stock browser**: Partial support; may not expose all signals
- **Privacy browsers**: May intentionally hide connection signals

**Mitigation**: Graceful degradation; system works with or without API

## Performance Considerations

### Hook Overhead
- `useNetworkQuality()` adds minimal overhead:
  - Single initial `navigator.connection` read (~1 microsecond)
  - Event listener for connection changes (lightweight)
  - No polling or repeated API calls
  - No network requests

### Quality Resolution
- `resolveQuality()` is a pure function, runs in microseconds
- No side effects or dependencies
- Can be called frequently without performance impact

### Player Integration
- Sets `maxResolution` prop on Mux Player (one-time during render)
- Quality cap applied at segment boundary (normal adaptive bitrate behavior)
- No additional transcoding or processing required

## Privacy Considerations

### Data Collected
- **Local only**: All signals are read from local browser APIs
- **No tracking**: System does not collect or transmit information about user's network
- **User-controlled**: saveData flag is user's explicit browser/OS setting

### Data Transmitted to Mux
The existing Mux Data integration already captures viewer metadata. Quality selection:
- Does not introduce new transmission of sensitive data
- Works with existing Mux privacy policies
- Quality cap is internal decision; doesn't change what Mux sees

## Configuration & Tuning

### Quality Thresholds
Thresholds are hardcoded in `useNetworkQuality.ts`:
```typescript
const BANDWIDTH_THRESHOLDS = {
  hd: 5,        // 5 Mbps for 720p+
  sd: 2,        // 2 Mbps for 480p
  low: 1,       // 1 Mbps for 360p
  veryLow: 0.5, // 0.5 Mbps for 240p
};
```

To adjust:
1. Edit `BANDWIDTH_THRESHOLDS` constants
2. Update corresponding tests
3. Deploy

### Connection Type Mapping
Edit `QUALITY_BY_CONNECTION` mapping to change recommendations per connection type.

## Future Enhancements

### Possible Improvements
1. **Persistent user preference**: Remember if user overrides cap, persist across sessions
2. **A/B testing**: Test different threshold values to optimize for viewership and data usage
3. **Historical correlation**: Track actual user experience at each quality/bandwidth combo to inform thresholds
4. **Admin UI**: Dashboard for platform admins to tune thresholds per region
5. **Bandwidth estimation**: More sophisticated throughput measurement (e.g., DASH/HLS segment timing)
6. **Smart prompts**: Ask users once if they want to lower quality on detected metered connections

## References

- [Network Information API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API)
- [Save-Data HTTP Header - MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Save-Data)
- [Mux Player React Docs](https://docs.mux.com/guides/mux-player-react)
- [Adaptive Bitrate Streaming - Wikipedia](https://en.wikipedia.org/wiki/Adaptive_bitrate_streaming)
