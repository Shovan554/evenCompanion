/** Returns the time as a 24h HH:MM zero-padded string. */
export function clock(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/** Returns a rounded, clamped-to-0 percentage string, e.g. "23%". */
export function pct(n: number): string {
  return `${Math.round(Math.max(0, n))}%`;
}

/**
 * Returns a gigabyte value as a string with "G" suffix.
 * Values >= 10 are shown as integers; values < 10 keep one decimal.
 */
export function gb(n: number): string {
  if (n >= 10) {
    return `${Math.round(n)}G`;
  }
  return `${n.toFixed(1)}G`;
}

/**
 * Formats a KB/s value.
 * >= 1000 KB/s → "X.YM" (1 decimal megabytes/s).
 * < 1000 KB/s → "NK" (integer kilobytes/s).
 */
export function kbps(n: number): string {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}M`;
  }
  return `${Math.round(n)}K`;
}

/**
 * Truncates string s to at most n characters.
 * If s.length > n, returns s.slice(0, n-1) + '…'.
 */
export function trunc(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}
