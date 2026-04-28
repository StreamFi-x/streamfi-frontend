export type NumberStyle = 'short' | 'ordinal';

export interface ConverterOptions {
  style?: NumberStyle;
}

export interface ApiResponse {
  words: string;
  error?: string;
}
