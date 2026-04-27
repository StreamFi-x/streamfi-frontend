export interface CaseConvertRequest {
  text: string;
  target?: 'camelCase' | 'snake_case' | 'kebab-case' | 'PascalCase' | 'CONSTANT_CASE' | 'Title Case' | 'Sentence case';
}

export interface CaseConvertResponse {
  result?: string;
  camelCase?: string;
  snake_case?: string;
  'kebab-case'?: string;
  PascalCase?: string;
  CONSTANT_CASE?: string;
  'Title Case'?: string;
  'Sentence case'?: string;
}
