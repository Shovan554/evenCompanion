import { describe, it, expect } from 'vitest';
import { clock, pct, gb, kbps, trunc } from '../src/format.js';

describe('clock', () => {
  it('formats hours and minutes with zero-padding', () => {
    expect(clock(new Date(2024, 0, 1, 9, 5))).toBe('09:05');
  });

  it('formats afternoon time without leading zero', () => {
    expect(clock(new Date(2024, 0, 1, 14, 32))).toBe('14:32');
  });

  it('formats midnight as 00:00', () => {
    expect(clock(new Date(2024, 0, 1, 0, 0))).toBe('00:00');
  });

  it('formats 23:59', () => {
    expect(clock(new Date(2024, 0, 1, 23, 59))).toBe('23:59');
  });
});

describe('pct', () => {
  it('rounds a float to an integer with percent sign', () => {
    expect(pct(23.4)).toBe('23%');
  });

  it('rounds up correctly', () => {
    expect(pct(23.6)).toBe('24%');
  });

  it('clamps negative values to 0', () => {
    expect(pct(-5)).toBe('0%');
  });

  it('returns 0% for exactly 0', () => {
    expect(pct(0)).toBe('0%');
  });

  it('returns 100% for 100', () => {
    expect(pct(100)).toBe('100%');
  });
});

describe('gb', () => {
  it('returns integer + G for values >= 10', () => {
    expect(gb(142)).toBe('142G');
  });

  it('returns integer + G for exactly 10', () => {
    expect(gb(10)).toBe('10G');
  });

  it('returns one decimal + G for values < 10', () => {
    expect(gb(1.5)).toBe('1.5G');
  });

  it('returns one decimal for 9.5 (< 10)', () => {
    expect(gb(9.5)).toBe('9.5G');
  });

  it('returns integer + G for value just above 10', () => {
    expect(gb(10.9)).toBe('11G');
  });

  it('rounds to integer for large values', () => {
    expect(gb(16)).toBe('16G');
  });
});

describe('kbps', () => {
  it('shows NK for values below 1000', () => {
    expect(kbps(48)).toBe('48K');
  });

  it('shows 1 decimal M for values >= 1000', () => {
    expect(kbps(1200)).toBe('1.2M');
  });

  it('boundary: exactly 1000 KB/s shows 1.0M', () => {
    expect(kbps(1000)).toBe('1.0M');
  });

  it('999 KB/s shows 999K', () => {
    expect(kbps(999)).toBe('999K');
  });

  it('shows 0K for zero', () => {
    expect(kbps(0)).toBe('0K');
  });

  it('rounds K to integer', () => {
    expect(kbps(48.7)).toBe('49K');
  });
});

describe('trunc', () => {
  it('returns the string unchanged if within limit', () => {
    expect(trunc('hello', 10)).toBe('hello');
  });

  it('returns the string unchanged if exactly at limit', () => {
    expect(trunc('hello', 5)).toBe('hello');
  });

  it('truncates to n-1 chars + ellipsis if over limit', () => {
    expect(trunc('hello world', 8)).toBe('hello w…');
  });

  it('truncates with ellipsis taking the last char slot', () => {
    // 'abcdef' length 6, n=5 → 'abcd…'
    expect(trunc('abcdef', 5)).toBe('abcd…');
  });

  it('handles n=1: returns ellipsis only', () => {
    expect(trunc('hello', 1)).toBe('…');
  });
});
