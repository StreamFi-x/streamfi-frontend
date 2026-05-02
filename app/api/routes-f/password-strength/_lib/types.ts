export interface PasswordStrengthRequest {
  password: string;
}

export interface PasswordStrengthResponse {
  score: number; // 0-4
  feedback: string[];
  estimated_crack_time: string;
}