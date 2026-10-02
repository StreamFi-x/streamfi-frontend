export interface SearchRankItem {
  id: string
  title: string
  creatorName?: string | null
  followerCount?: number | null
  isLive?: boolean | null
  lastActiveAt?: string | Date | null
}

export interface SearchRankingWeights {
  text: number
  followers: number
  live: number
  recency: number
}

export interface RankedSearchResult<T extends SearchRankItem> {
  item: T
  score: number
  signals: {
    text: number
    followers: number
    live: number
    recency: number
  }
}

const DEFAULT_WEIGHTS: SearchRankingWeights = {
  text: 0.55,
  followers: 0.2,
  live: 0.15,
  recency: 0.1,
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function trigrams(value: string) {
  const padded = `  ${normalize(value)}  `
  const grams = new Set<string>()
  for (let index = 0; index <= padded.length - 3; index += 1) {
    grams.add(padded.slice(index, index + 3))
  }
  return grams
}

function trigramSimilarity(query: string, candidate: string) {
  const queryGrams = trigrams(query)
  const candidateGrams = trigrams(candidate)
  if (queryGrams.size === 0 || candidateGrams.size === 0) return 0
  let overlap = 0
  for (const gram of queryGrams) if (candidateGrams.has(gram)) overlap += 1
  return (2 * overlap) / (queryGrams.size + candidateGrams.size)
}

export function scoreTextMatch(query: string, item: Pick<SearchRankItem, 'title' | 'creatorName'>) {
  const normalizedQuery = normalize(query)
  const candidates = [item.title, item.creatorName ?? ''].map(normalize).filter(Boolean)
  if (!normalizedQuery || candidates.length === 0) return 0

  return Math.max(
    ...candidates.map((candidate) => {
      if (candidate === normalizedQuery) return 1
      if (candidate.startsWith(normalizedQuery)) return 0.92
      if (candidate.split(' ').some((part) => part.startsWith(normalizedQuery))) return 0.82
      if (candidate.includes(normalizedQuery)) return 0.68
      return trigramSimilarity(normalizedQuery, candidate) * 0.62
    })
  )
}

function scoreFollowers(followerCount: number | null | undefined) {
  const followers = Math.max(0, followerCount ?? 0)
  return Math.min(1, Math.log10(followers + 1) / 6)
}

function scoreRecency(lastActiveAt: string | Date | null | undefined, now = new Date()) {
  if (!lastActiveAt) return 0
  const activeAt = new Date(lastActiveAt).getTime()
  if (Number.isNaN(activeAt)) return 0
  const ageHours = Math.max(0, (now.getTime() - activeAt) / 3_600_000)
  return Math.exp(-ageHours / 72)
}

export function rankSearchResults<T extends SearchRankItem>(
  query: string,
  items: T[],
  weights: SearchRankingWeights = DEFAULT_WEIGHTS,
  now = new Date()
): RankedSearchResult<T>[] {
  return items
    .map((item) => {
      const signals = {
        text: scoreTextMatch(query, item),
        followers: scoreFollowers(item.followerCount),
        live: item.isLive ? 1 : 0,
        recency: scoreRecency(item.lastActiveAt, now),
      }
      const score =
        signals.text * weights.text +
        signals.followers * weights.followers +
        signals.live * weights.live +
        signals.recency * weights.recency
      return { item, score, signals }
    })
    .sort((a, b) => b.score - a.score || b.signals.text - a.signals.text)
}