export type AppealStatus = 'submitted' | 'under_review' | 'approved' | 'denied' | 'closed'

export interface BanAppealRecord {
  id: string
  userId: string
  banId: string
  status: AppealStatus
  submittedAt: string | Date
  resolvedAt?: string | Date | null
}

export interface AppealSubmissionDecision {
  allowed: boolean
  reason: 'allowed' | 'active_appeal_exists' | 'cooldown_active'
  retryAfterDays?: number
}

const ACTIVE_STATUSES = new Set<AppealStatus>(['submitted', 'under_review'])

export function canSubmitBanAppeal(
  appeals: BanAppealRecord[],
  now = new Date(),
  cooldownDays = 30
): AppealSubmissionDecision {
  if (appeals.some((appeal) => ACTIVE_STATUSES.has(appeal.status))) {
    return { allowed: false, reason: 'active_appeal_exists' }
  }

  const lastResolved = appeals
    .filter((appeal) => appeal.resolvedAt)
    .sort((a, b) => new Date(b.resolvedAt!).getTime() - new Date(a.resolvedAt!).getTime())[0]

  if (lastResolved) {
    const elapsedDays = (now.getTime() - new Date(lastResolved.resolvedAt!).getTime()) / 86_400_000
    if (elapsedDays < cooldownDays) {
      return { allowed: false, reason: 'cooldown_active', retryAfterDays: Math.ceil(cooldownDays - elapsedDays) }
    }
  }

  return { allowed: true, reason: 'allowed' }
}

export function nextAppealStatus(current: AppealStatus, action: 'start_review' | 'approve' | 'deny' | 'close'): AppealStatus {
  if (current === 'submitted' && action === 'start_review') return 'under_review'
  if ((current === 'submitted' || current === 'under_review') && action === 'approve') return 'approved'
  if ((current === 'submitted' || current === 'under_review') && action === 'deny') return 'denied'
  if ((current === 'approved' || current === 'denied') && action === 'close') return 'closed'
  return current
}

export function appealNotificationCopy(status: AppealStatus, banReason: string) {
  if (status === 'submitted') return 'Your appeal was received and is waiting for review.'
  if (status === 'under_review') return 'Your appeal is now under review by the moderation team.'
  if (status === 'approved') return `Your appeal was approved. Original ban reason: ${banReason}`
  if (status === 'denied') return `Your appeal was denied. Original ban reason: ${banReason}`
  return 'Your appeal is closed.'
}