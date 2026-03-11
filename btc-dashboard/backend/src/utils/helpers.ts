// utils/helpers.ts

/**
 * Format a Date to YYYY-MM-DD string (UTC).
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Sleep for ms milliseconds (use between API calls to respect rate limits).
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Chunk an array into smaller arrays of size n.
 */
export function chunk<T>(arr: T[], n: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += n) {
    chunks.push(arr.slice(i, i + n));
  }
  return chunks;
}
