export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export type ErrorCode = 
  | 'VALIDATION_ERROR'
  | 'INVALID_CSV_FORMAT'
  | 'MAX_ROWS_EXCEEDED'
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_PARAMETER'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationErrorResponse {
  errors: ValidationError[];
}