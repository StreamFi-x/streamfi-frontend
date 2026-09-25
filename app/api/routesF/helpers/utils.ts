export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return `${prefix}_${timestamp}_${random}`;
}

export function formatDateForCSV(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toISOString();
}

export function roundToDecimal(value: number, decimals: number = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function isPositiveInteger(value: string): boolean {
  const num = parseInt(value, 10);
  return !isNaN(num) && num > 0 && num.toString() === value;
}

export function isValidDateString(dateString: string): boolean {
  return !isNaN(Date.parse(dateString));
}