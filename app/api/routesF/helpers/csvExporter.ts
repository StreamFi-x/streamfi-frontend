import type { BanRecord } from '../types/bans';

export function generateCSV(bans: BanRecord[]): string {
  // Create CSV header
  const header = 'viewer_id,reason,banned_at';
  
  // Create CSV rows
  const rows = bans.map(ban => {
    // Escape quotes and commas in the data
    const escapedReason = escapeCSVField(ban.reason);
    return `${ban.viewer_id},${escapedReason},${ban.banned_at}`;
  });
  
  // Combine header and rows
  return [header, ...rows].join('\n');
}

export function escapeCSVField(field: string): string {
  // If field contains quotes, commas, or newlines, wrap in quotes and escape quotes
  if (field.includes('"') || field.includes(',') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export function createCSVResponse(csvContent: string): Response {
  return new Response(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="bans_export.csv"',
    },
  });
}