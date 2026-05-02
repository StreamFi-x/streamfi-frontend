export interface AsciiArtRequest {
  text: string;
  font?: 'standard' | 'small' | 'big';
  width?: number;
}

export interface AsciiArtResponse {
  art: string;
  font_used: string;
}
