export interface CsvParseResult {
  headers?: string[];
  rows: Array<Array<string | number>>;
  row_count: number;
}
