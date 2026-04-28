export interface TextStatsResponse {
  chars: number;
  chars_no_spaces: number;
  words: number;
  sentences: number;
  paragraphs: number;
  avg_words_per_sentence: number;
  flesch_reading_ease: number;
  syllable_count: number;
  reading_time_seconds: number;
}
