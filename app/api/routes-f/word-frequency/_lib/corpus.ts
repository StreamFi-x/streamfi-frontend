// Baseline corpus frequencies (relative frequency per million words, approximate)
// Higher value = more common in everyday English
export const CORPUS: Record<string, number> = {
  time: 2500, people: 1800, way: 1700, year: 1600, day: 1500,
  man: 1400, woman: 1200, child: 1100, world: 1000, life: 950,
  hand: 900, part: 880, place: 860, case: 840, week: 820,
  company: 800, system: 780, program: 760, question: 740, work: 720,
  government: 700, number: 680, night: 660, point: 640, home: 620,
  water: 600, room: 580, mother: 560, area: 540, money: 520,
  story: 500, fact: 480, month: 460, lot: 440, right: 420,
  study: 400, book: 380, eye: 360, job: 340, word: 320,
  business: 300, issue: 280, side: 260, kind: 240, head: 220,
  house: 200, service: 190, friend: 180, father: 170, power: 160,
  hour: 150, game: 140, line: 130, end: 120, among: 110,
  never: 100, last: 95, long: 90, great: 85, little: 80,
  own: 75, old: 70, right: 65, big: 60, high: 55,
  different: 50, small: 48, large: 46, next: 44, early: 42,
  young: 40, important: 38, public: 36, bad: 34, same: 32,
  able: 30, human: 28, local: 26, sure: 24, free: 22,
  real: 20, best: 18, black: 16, white: 14, short: 12,
};

// Max corpus frequency for normalization
export const MAX_CORPUS_FREQ = Math.max(...Object.values(CORPUS));
