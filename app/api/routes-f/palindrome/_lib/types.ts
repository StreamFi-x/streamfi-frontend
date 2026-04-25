export interface PalindromeRequest {
  text: string;
  ignore_case?: boolean;
  ignore_punct?: boolean;
  ignore_whitespace?: boolean;
}

export interface PalindromeResponse {
  is_palindrome: boolean;
  normalized: string;
}
