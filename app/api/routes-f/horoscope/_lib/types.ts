export interface HoroscopeRequest {
  sign: string;
  date: string;
}

export interface HoroscopeResponse {
  sign: string;
  date: string;
  reading: string;
  lucky_number: number;
  lucky_color: string;
  mood: string;
}
