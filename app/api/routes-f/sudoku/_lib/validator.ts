import type { SudokuConflict, SudokuValidationResult } from "../types";

const GRID_SIZE = 9;
const BOX_SIZE = 3;

function isValidCell(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 1 &&
      value <= 9)
  );
}

export function isValidSudokuGrid(grid: unknown): grid is (number | null)[][] {
  return (
    Array.isArray(grid) &&
    grid.length === GRID_SIZE &&
    grid.every(
      row =>
        Array.isArray(row) && row.length === GRID_SIZE && row.every(isValidCell)
    )
  );
}

export function validateSudokuGrid(
  grid: (number | null)[][]
): SudokuValidationResult {
  const conflicts: SudokuConflict[] = [];
  const seen = new Set<string>();

  const addConflict = (
    row: number,
    col: number,
    value: number,
    conflict_type: SudokuConflict["conflict_type"]
  ) => {
    const key = `${row}:${col}:${value}:${conflict_type}`;
    if (!seen.has(key)) {
      seen.add(key);
      conflicts.push({ row, col, value, conflict_type });
    }
  };

  for (let row = 0; row < GRID_SIZE; row += 1) {
    const rowValues = new Map<number, number[]>();
    for (let col = 0; col < GRID_SIZE; col += 1) {
      const value = grid[row][col];
      if (value === null) continue;
      const cols = rowValues.get(value) ?? [];
      cols.push(col);
      rowValues.set(value, cols);
    }

    for (const [value, cols] of rowValues.entries()) {
      if (cols.length > 1)
        cols.forEach(col => addConflict(row, col, value, "row"));
    }
  }

  for (let col = 0; col < GRID_SIZE; col += 1) {
    const colValues = new Map<number, number[]>();
    for (let row = 0; row < GRID_SIZE; row += 1) {
      const value = grid[row][col];
      if (value === null) continue;
      const rows = colValues.get(value) ?? [];
      rows.push(row);
      colValues.set(value, rows);
    }

    for (const [value, rows] of colValues.entries()) {
      if (rows.length > 1)
        rows.forEach(row => addConflict(row, col, value, "column"));
    }
  }

  for (let boxRow = 0; boxRow < GRID_SIZE; boxRow += BOX_SIZE) {
    for (let boxCol = 0; boxCol < GRID_SIZE; boxCol += BOX_SIZE) {
      const boxValues = new Map<number, Array<{ row: number; col: number }>>();

      for (let row = boxRow; row < boxRow + BOX_SIZE; row += 1) {
        for (let col = boxCol; col < boxCol + BOX_SIZE; col += 1) {
          const value = grid[row][col];
          if (value === null) continue;
          const cells = boxValues.get(value) ?? [];
          cells.push({ row, col });
          boxValues.set(value, cells);
        }
      }

      for (const [value, cells] of boxValues.entries()) {
        if (cells.length > 1)
          cells.forEach(cell => addConflict(cell.row, cell.col, value, "box"));
      }
    }
  }

  const valid = conflicts.length === 0;
  const complete =
    valid && grid.every(row => row.every(value => value !== null));

  return { valid, complete, conflicts };
}
