export interface ScriptCounts {
  latin: number;
  cyrillic: number;
  cjk: number;
  arabic: number;
  devanagari: number;
  greek: number;
  hebrew: number;
  other: number;
}

export interface CharStatsResponse {
  total: number;
  letters: number;
  digits: number;
  whitespace: number;
  punctuation: number;
  symbols: number;
  emoji: number;
  other: number;
  by_script: ScriptCounts;
}
