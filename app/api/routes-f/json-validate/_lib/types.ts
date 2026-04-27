export interface JsonValidateRequest {
  input: string;
  format?: boolean;
  sort_keys?: boolean;
}

export interface JsonValidationErrorPayload {
  message: string;
  line: number;
  column: number;
  position: number;
  context: string;
}
