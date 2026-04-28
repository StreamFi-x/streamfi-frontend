export type SudokuConflictType = "row" | "column" | "box";

export interface SudokuConflict {
  row: number;
  col: number;
  value: number;
  conflict_type: SudokuConflictType;
}

export interface SudokuValidationResult {
  valid: boolean;
  complete: boolean;
  conflicts: SudokuConflict[];
}
