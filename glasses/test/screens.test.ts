import { describe, it, expect } from 'vitest';
import { topBar, renderScreen, SCREENS, ScreenKind } from '../src/screens.js';
import type { Snapshot } from '../src/snapshot.js';

// ── Helper snapshots ──────────────────────────────────────────────────────────

const baseSnap: Snapshot = {
  ts: 1000,
  vitals: {
    cpu: 23,
    ramUsedGB: 11.2,
    ramTotalGB: 16,
    diskFreeGB: 142,
    diskTotalGB: 512,
    ramPressure: 'normal',
    ssdHealth: 'Verified',
    ssdWearPct: null,
  },
  netProc: {
    upKBs: 48,
    downKBs: 1200,
    topProc: { name: 'Chrome', cpu: 61 },
    battery: null,
  },
  ports: [
    { port: 3000, proc: 'node' },
    { port: 8080, proc: 'python3' },
  ],
  reminders: [
    { id: 'r1', title: 'Buy milk', due: null, overdue: false },
    { id: 'r2', title: 'Fix the leak', due: 0, overdue: true },
  ],
};

// ── topBar ────────────────────────────────────────────────────────────────────

describe('topBar', () => {
  it('shows live indicator when not stale', () => {
    const bar = topBar('14:32', false);
    expect(bar).toContain('14:32');
    expect(bar).toContain('●');
    expect(bar).not.toContain('stale');
  });

  it('shows stale indicator when stale', () => {
    const bar = topBar('14:32', true);
    expect(bar).toContain('14:32');
    expect(bar).toContain('stale');
    expect(bar).not.toContain('●');
  });

  it('is a single short string (no newlines, length < 30)', () => {
    const bar = topBar('09:05', false);
    expect(bar).not.toContain('\n');
    expect(bar.length).toBeLessThan(30);
  });
});

// ── SCREENS constant ──────────────────────────────────────────────────────────

describe('SCREENS', () => {
  it('has exactly 4 screens in order', () => {
    expect(SCREENS).toEqual(['vitals', 'netproc', 'ports', 'reminders']);
  });
});

// ── renderScreen: vitals ──────────────────────────────────────────────────────

describe('renderScreen vitals', () => {
  it('returns ≤7 lines', () => {
    const lines = renderScreen('vitals', baseSnap);
    expect(lines.length).toBeLessThanOrEqual(7);
  });

  it('shows CPU line with percentage', () => {
    const lines = renderScreen('vitals', baseSnap);
    expect(lines.some(l => l.startsWith('CPU') && l.includes('23%'))).toBe(true);
  });

  it('shows RAM line with used/total', () => {
    const lines = renderScreen('vitals', baseSnap);
    // ramUsedGB 11.2 (>=10 → '11G'), ramTotalGB 16 (>=10 → '16G')
    expect(lines.some(l => l.startsWith('RAM') && l.includes('11G') && l.includes('16G'))).toBe(true);
  });

  it('shows DISK line with free space', () => {
    const lines = renderScreen('vitals', baseSnap);
    expect(lines.some(l => l.startsWith('DISK') && l.includes('142G'))).toBe(true);
  });

  it('renders a bar meter on the CPU line', () => {
    const lines = renderScreen('vitals', baseSnap);
    const cpuLine = lines.find(l => l.startsWith('CPU'));
    expect(cpuLine).toBeDefined();
    expect(cpuLine).toMatch(/▕[█▏▎▍▌▋▊▉░]+▏/);
  });

  it('shows SSD health line', () => {
    const lines = renderScreen('vitals', baseSnap);
    expect(lines.some(l => l.startsWith('SSD') && l.includes('Verified'))).toBe(true);
  });

  it('omits WEAR line when ssdWearPct is null', () => {
    const lines = renderScreen('vitals', baseSnap);
    expect(lines.some(l => l.startsWith('WEAR'))).toBe(false);
  });

  it('includes WEAR line when ssdWearPct is not null', () => {
    const snap: Snapshot = {
      ...baseSnap,
      vitals: { ...baseSnap.vitals, ssdWearPct: 12 },
    };
    const lines = renderScreen('vitals', snap);
    expect(lines.some(l => l.startsWith('WEAR') && l.includes('12%'))).toBe(true);
    expect(lines.length).toBeLessThanOrEqual(7);
  });
});

// ── renderScreen: netproc ─────────────────────────────────────────────────────

describe('renderScreen netproc', () => {
  it('returns ≤7 lines', () => {
    const lines = renderScreen('netproc', baseSnap);
    expect(lines.length).toBeLessThanOrEqual(7);
  });

  it('shows NET line with up and down kbps', () => {
    const lines = renderScreen('netproc', baseSnap);
    // upKBs 48 → '48K', downKBs 1200 → '1.2M'
    expect(lines.some(l => l.startsWith('NET') && l.includes('48K') && l.includes('1.2M'))).toBe(true);
  });

  it('shows TOP line with truncated process name and cpu pct', () => {
    const lines = renderScreen('netproc', baseSnap);
    expect(lines.some(l => l.startsWith('TOP') && l.includes('Chrome') && l.includes('61%'))).toBe(true);
  });

  it('shows TOP — when topProc is null', () => {
    const snap: Snapshot = {
      ...baseSnap,
      netProc: { ...baseSnap.netProc, topProc: null },
    };
    const lines = renderScreen('netproc', snap);
    expect(lines.some(l => l === 'TOP —')).toBe(true);
  });

  it('omits BAT line when battery is null', () => {
    const lines = renderScreen('netproc', baseSnap);
    expect(lines.some(l => l.startsWith('BAT'))).toBe(false);
  });

  it('shows BAT line without + when not charging', () => {
    const snap: Snapshot = {
      ...baseSnap,
      netProc: { ...baseSnap.netProc, battery: { pct: 80, charging: false } },
    };
    const lines = renderScreen('netproc', snap);
    const batLine = lines.find(l => l.startsWith('BAT'));
    expect(batLine).toBeDefined();
    expect(batLine).toContain('80%');
    expect(batLine).not.toContain('+');
  });

  it('shows BAT line with + when charging', () => {
    const snap: Snapshot = {
      ...baseSnap,
      netProc: { ...baseSnap.netProc, battery: { pct: 55, charging: true } },
    };
    const lines = renderScreen('netproc', snap);
    const batLine = lines.find(l => l.startsWith('BAT'));
    expect(batLine).toBeDefined();
    expect(batLine).toContain('55%+');
  });

  it('truncates process name to 10 chars', () => {
    const snap: Snapshot = {
      ...baseSnap,
      netProc: { ...baseSnap.netProc, topProc: { name: 'VeryLongProcessName', cpu: 10 } },
    };
    const lines = renderScreen('netproc', snap);
    const topLine = lines.find(l => l.startsWith('TOP'));
    expect(topLine).toBeDefined();
    // 'VeryLongProcessName' trunc 10 → 'VeryLongP…' (9 chars + ellipsis = 10)
    expect(topLine).toContain('VeryLongP…');
  });
});

// ── renderScreen: ports ───────────────────────────────────────────────────────

describe('renderScreen ports', () => {
  it('returns ≤7 lines', () => {
    const lines = renderScreen('ports', baseSnap);
    expect(lines.length).toBeLessThanOrEqual(7);
  });

  it('shows each port as "<port> <proc>"', () => {
    const lines = renderScreen('ports', baseSnap);
    expect(lines).toContain('3000 node');
    expect(lines).toContain('8080 python3');
  });

  it('shows "No open ports" when ports is empty', () => {
    const snap: Snapshot = { ...baseSnap, ports: [] };
    const lines = renderScreen('ports', snap);
    expect(lines).toEqual(['No open ports']);
  });

  it('caps at 5 rows and shows +N more', () => {
    const snap: Snapshot = {
      ...baseSnap,
      ports: [
        { port: 3000, proc: 'node' },
        { port: 3001, proc: 'node' },
        { port: 3002, proc: 'node' },
        { port: 3003, proc: 'node' },
        { port: 3004, proc: 'node' },
        { port: 3005, proc: 'node' },
        { port: 3006, proc: 'node' },
        { port: 3007, proc: 'python3' },
      ],
    };
    const lines = renderScreen('ports', snap);
    expect(lines.length).toBe(5);
    // 4 port lines + "+4 more"
    expect(lines[lines.length - 1]).toBe('+4 more');
    expect(lines.filter(l => !l.startsWith('+'))).toHaveLength(4);
  });

  it('truncates proc to 12 chars', () => {
    const snap: Snapshot = {
      ...baseSnap,
      ports: [{ port: 9000, proc: 'verylongprocname' }],
    };
    const lines = renderScreen('ports', snap);
    // 'verylongprocname' is 16 chars; trunc(12) → 'verylongpro…'
    expect(lines[0]).toBe('9000 verylongpro…');
  });
});

// ── renderScreen: reminders ───────────────────────────────────────────────────

describe('renderScreen reminders', () => {
  it('returns ≤7 lines', () => {
    const lines = renderScreen('reminders', baseSnap);
    expect(lines.length).toBeLessThanOrEqual(7);
  });

  it('shows "No reminders" when list is empty', () => {
    const snap: Snapshot = { ...baseSnap, reminders: [] };
    const lines = renderScreen('reminders', snap);
    expect(lines).toEqual(['No reminders']);
  });

  it('marks the selected index with › marker', () => {
    const lines = renderScreen('reminders', baseSnap, { selectedIndex: 0 });
    expect(lines[0]).toMatch(/^›/);
    expect(lines[1]).toMatch(/^ /);
  });

  it('marks the second reminder when selectedIndex is 1', () => {
    const lines = renderScreen('reminders', baseSnap, { selectedIndex: 1 });
    expect(lines[0]).toMatch(/^ /);
    expect(lines[1]).toMatch(/^›/);
  });

  it('defaults to selectedIndex=0', () => {
    const lines = renderScreen('reminders', baseSnap);
    expect(lines[0]).toMatch(/^›/);
  });

  it('marks overdue reminders with " !" at the end', () => {
    const lines = renderScreen('reminders', baseSnap, { selectedIndex: 0 });
    // reminder r2 is overdue
    const overdueLineIdx = baseSnap.reminders.findIndex(r => r.overdue);
    expect(lines[overdueLineIdx]).toContain(' !');
  });

  it('does not add " !" for non-overdue reminders', () => {
    const lines = renderScreen('reminders', baseSnap, { selectedIndex: 0 });
    expect(lines[0]).not.toContain(' !');
  });

  it('truncates title to 16 chars', () => {
    const snap: Snapshot = {
      ...baseSnap,
      reminders: [{ id: 'r1', title: 'A very long reminder title', due: null, overdue: false }],
    };
    const lines = renderScreen('reminders', snap, { selectedIndex: 0 });
    // title trunc 16 → 'A very long remi…'
    expect(lines[0]).toContain('A very long rem…');
  });

  it('caps at 6 reminders and shows +N more', () => {
    const reminders = Array.from({ length: 8 }, (_, i) => ({
      id: `r${i}`,
      title: `Reminder ${i}`,
      due: null,
      overdue: false,
    }));
    const snap: Snapshot = { ...baseSnap, reminders };
    const lines = renderScreen('reminders', snap, { selectedIndex: 0 });
    expect(lines.length).toBe(5);
    expect(lines[lines.length - 1]).toBe('+4 more');
  });
});
