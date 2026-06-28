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

// Eighth-width left blocks for sub-cell precision (1/8 … 8/8 of a cell filled).
const EIGHTHS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉', '█'];

/**
 * Renders a horizontal bar meter for a 0..100 percentage, e.g. "▕████▌░░░░▏".
 * - `cells` is the number of full-width cells between the end caps (default 6).
 * - Uses partial eighth-blocks so the fill is smooth, not steppy.
 * - Clamps the value to 0..100. Empty cells use '░' so the track is always visible.
 * The returned string always has the same visual width (caps + `cells` glyphs).
 */
export function bar(value: number, cells = 6): string {
  const clamped = Math.max(0, Math.min(100, value));
  const totalEighths = Math.round((clamped / 100) * cells * 8);
  let out = '';
  for (let i = 0; i < cells; i++) {
    const cellEighths = Math.max(0, Math.min(8, totalEighths - i * 8));
    out += cellEighths === 8 ? '█' : cellEighths === 0 ? '░' : EIGHTHS[cellEighths];
  }
  return `▕${out}▏`;
}
