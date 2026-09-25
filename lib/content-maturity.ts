export type MaturityRating = 'general' | 'mature' | 'adult'

export interface ViewerMaturityPreference {
  isAuthenticated: boolean
  declaredAdult?: boolean
  showMatureContent?: boolean
}

export interface MaturityGateDecision {
  allowed: boolean
  hiddenFromDiscovery: boolean
  reason: 'allowed' | 'viewer_not_adult' | 'viewer_opted_out' | 'unauthenticated_adult_content'
}

export const MATURITY_LABELS: Record<MaturityRating, string> = {
  general: 'General',
  mature: 'Mature',
  adult: 'Adult only',
}

export function canViewMatureContent(rating: MaturityRating, viewer: ViewerMaturityPreference): MaturityGateDecision {
  if (rating === 'general') return { allowed: true, hiddenFromDiscovery: false, reason: 'allowed' }
  if (!viewer.showMatureContent) return { allowed: false, hiddenFromDiscovery: true, reason: 'viewer_opted_out' }
  if (!viewer.declaredAdult) return { allowed: false, hiddenFromDiscovery: true, reason: 'viewer_not_adult' }
  if (rating === 'adult' && !viewer.isAuthenticated) {
    return { allowed: false, hiddenFromDiscovery: true, reason: 'unauthenticated_adult_content' }
  }
  return { allowed: true, hiddenFromDiscovery: false, reason: 'allowed' }
}

export function includeInDiscovery(rating: MaturityRating, viewer: ViewerMaturityPreference) {
  return canViewMatureContent(rating, viewer).allowed
}