export interface ChatVelocitySample {
  timestamp: number
  messageCount: number
}

export interface AutoThrottleInput {
  recentWindowMessages: number
  recentWindowSeconds: number
  baselineMessagesPerSecond: number
  manualSlowModeSeconds?: number | null
}

export interface AutoThrottleState {
  active: boolean
  severity: 'normal' | 'elevated' | 'storm'
  velocityMessagesPerSecond: number
  baselineMessagesPerSecond: number
  multiplier: number
  effectiveSlowModeSeconds: number
  viewerMessage: string | null
}

export function rollingBaseline(samples: ChatVelocitySample[], minimum = 0.1) {
  const totalMessages = samples.reduce((sum, sample) => sum + Math.max(0, sample.messageCount), 0)
  if (samples.length < 2) return minimum
  const ordered = [...samples].sort((a, b) => a.timestamp - b.timestamp)
  const seconds = Math.max(1, (ordered[ordered.length - 1].timestamp - ordered[0].timestamp) / 1000)
  return Math.max(minimum, totalMessages / seconds)
}

export function computeAutoThrottle(input: AutoThrottleInput): AutoThrottleState {
  const velocity = input.recentWindowMessages / Math.max(1, input.recentWindowSeconds)
  const baseline = Math.max(0.1, input.baselineMessagesPerSecond)
  const multiplier = velocity / baseline
  const manualSlowMode = Math.max(0, input.manualSlowModeSeconds ?? 0)

  let severity: AutoThrottleState['severity'] = 'normal'
  let dynamicSlowMode = 0

  if (multiplier >= 4) {
    severity = 'storm'
    dynamicSlowMode = 10
  } else if (multiplier >= 2) {
    severity = 'elevated'
    dynamicSlowMode = 4
  }

  const effectiveSlowModeSeconds = Math.max(manualSlowMode, dynamicSlowMode)
  const active = severity !== 'normal'

  return {
    active,
    severity,
    velocityMessagesPerSecond: velocity,
    baselineMessagesPerSecond: baseline,
    multiplier,
    effectiveSlowModeSeconds,
    viewerMessage: active
      ? `Chat is moving fast, so auto-throttle is temporarily limiting messages every ${effectiveSlowModeSeconds}s.`
      : null,
  }
}