import { describe, it, expect, vi } from 'vitest';
import { AppState } from '../src/state.js';
import type { Snapshot } from '../src/snapshot.js';

// ── Helper snapshots ──────────────────────────────────────────────────────────

const baseVitals = {
  cpu: 10,
  ramUsedGB: 8,
  ramTotalGB: 16,
  ramPressure: 'normal',
  diskFreeGB: 100,
  diskTotalGB: 512,
  ssdHealth: 'Verified',
  ssdWearPct: null,
};

const baseNetProc = {
  upKBs: 10,
  downKBs: 20,
  topProc: null,
  battery: null,
};

function makeSnap(reminders: Snapshot['reminders'] = []): Snapshot {
  return {
    ts: Date.now(),
    vitals: baseVitals,
    netProc: baseNetProc,
    ports: [],
    reminders,
  };
}

// ── Constructor defaults ──────────────────────────────────────────────────────

describe('AppState constructor', () => {
  it('starts at screenIndex 0', () => {
    const state = new AppState({ sendCommand: vi.fn() });
    expect(state.screenIndex).toBe(0);
  });

  it('starts with last=null', () => {
    const state = new AppState({ sendCommand: vi.fn() });
    expect(state.last).toBeNull();
  });

  it('starts with lastAt=0', () => {
    const state = new AppState({ sendCommand: vi.fn() });
    expect(state.lastAt).toBe(0);
  });

  it('starts with selectedIndex=0', () => {
    const state = new AppState({ sendCommand: vi.fn() });
    expect(state.selectedIndex).toBe(0);
  });
});

// ── onSnapshot ────────────────────────────────────────────────────────────────

describe('AppState.onSnapshot', () => {
  it('stores the snapshot and updates lastAt', () => {
    const state = new AppState({ sendCommand: vi.fn() });
    const snap = makeSnap();
    state.onSnapshot(snap, 5000);
    expect(state.last).toBe(snap);
    expect(state.lastAt).toBe(5000);
  });

  it('ignores null snapshots (keeps previous state)', () => {
    const state = new AppState({ sendCommand: vi.fn() });
    const snap = makeSnap();
    state.onSnapshot(snap, 5000);
    state.onSnapshot(null, 9000);
    expect(state.last).toBe(snap);
    expect(state.lastAt).toBe(5000);
  });

  it('clamps selectedIndex to last reminder when snap has fewer reminders', () => {
    const state = new AppState({ sendCommand: vi.fn() });
    const snap1 = makeSnap([
      { id: 'r0', title: 'A', due: null, overdue: false },
      { id: 'r1', title: 'B', due: null, overdue: false },
      { id: 'r2', title: 'C', due: null, overdue: false },
    ]);
    state.onSnapshot(snap1, 1000);
    state.selectedIndex = 2;

    const snap2 = makeSnap([{ id: 'r0', title: 'A', due: null, overdue: false }]);
    state.onSnapshot(snap2, 2000);
    expect(state.selectedIndex).toBe(0);
  });

  it('keeps selectedIndex at 0 when reminders array is empty', () => {
    const state = new AppState({ sendCommand: vi.fn() });
    state.selectedIndex = 0;
    state.onSnapshot(makeSnap([]), 1000);
    expect(state.selectedIndex).toBe(0);
  });
});

// ── onRingEvent: scroll ───────────────────────────────────────────────────────

describe('AppState.onRingEvent scroll', () => {
  it('scrollDown advances screen index', () => {
    const state = new AppState({ sendCommand: vi.fn() });
    state.onRingEvent('scrollDown');
    expect(state.screenIndex).toBe(1);
  });

  it('scrollDown wraps from last screen back to 0', () => {
    const state = new AppState({ sendCommand: vi.fn() });
    state.onRingEvent('scrollDown'); // 1
    state.onRingEvent('scrollDown'); // 2
    state.onRingEvent('scrollDown'); // 3
    state.onRingEvent('scrollDown'); // wraps to 0
    expect(state.screenIndex).toBe(0);
  });

  it('scrollUp goes to previous screen', () => {
    const state = new AppState({ sendCommand: vi.fn() });
    state.onRingEvent('scrollDown'); // 1
    state.onRingEvent('scrollUp');   // back to 0
    expect(state.screenIndex).toBe(0);
  });

  it('scrollUp wraps from 0 to last screen (index 3)', () => {
    const state = new AppState({ sendCommand: vi.fn() });
    state.onRingEvent('scrollUp');
    expect(state.screenIndex).toBe(3);
  });

  it('can traverse all 4 screens scrolling down and back up', () => {
    const state = new AppState({ sendCommand: vi.fn() });
    const visited: number[] = [state.screenIndex];
    for (let i = 0; i < 4; i++) {
      state.onRingEvent('scrollDown');
      visited.push(state.screenIndex);
    }
    expect(visited).toEqual([0, 1, 2, 3, 0]);
  });
});

// ── onRingEvent: click ────────────────────────────────────────────────────────

describe('AppState.onRingEvent click', () => {
  it('emits completeReminder with correct id on reminders screen', () => {
    const sendCommand = vi.fn();
    const state = new AppState({ sendCommand });
    const snap = makeSnap([
      { id: 'r0', title: 'Alpha', due: null, overdue: false },
      { id: 'r1', title: 'Beta', due: null, overdue: false },
    ]);
    state.onSnapshot(snap, 1000);
    // Navigate to reminders screen (index 3)
    state.onRingEvent('scrollDown'); // 1
    state.onRingEvent('scrollDown'); // 2
    state.onRingEvent('scrollDown'); // 3 = reminders
    state.onRingEvent('click');
    expect(sendCommand).toHaveBeenCalledOnce();
    expect(sendCommand).toHaveBeenCalledWith({ cmd: 'completeReminder', id: 'r0' });
  });

  it('emits completeReminder for selectedIndex reminder', () => {
    const sendCommand = vi.fn();
    const state = new AppState({ sendCommand });
    const snap = makeSnap([
      { id: 'r0', title: 'Alpha', due: null, overdue: false },
      { id: 'r1', title: 'Beta', due: null, overdue: false },
    ]);
    state.onSnapshot(snap, 1000);
    state.selectedIndex = 1;
    // Navigate to reminders screen
    state.screenIndex = 3;
    state.onRingEvent('click');
    expect(sendCommand).toHaveBeenCalledWith({ cmd: 'completeReminder', id: 'r1' });
  });

  it('emits nothing when clicking on reminders screen with no reminders', () => {
    const sendCommand = vi.fn();
    const state = new AppState({ sendCommand });
    state.onSnapshot(makeSnap([]), 1000);
    state.screenIndex = 3;
    state.onRingEvent('click');
    expect(sendCommand).not.toHaveBeenCalled();
  });

  it('emits nothing when clicking on vitals screen', () => {
    const sendCommand = vi.fn();
    const state = new AppState({ sendCommand });
    state.onSnapshot(makeSnap([{ id: 'r0', title: 'A', due: null, overdue: false }]), 1000);
    state.screenIndex = 0; // vitals
    state.onRingEvent('click');
    expect(sendCommand).not.toHaveBeenCalled();
  });

  it('emits nothing when clicking on netproc screen', () => {
    const sendCommand = vi.fn();
    const state = new AppState({ sendCommand });
    state.onSnapshot(makeSnap([{ id: 'r0', title: 'A', due: null, overdue: false }]), 1000);
    state.screenIndex = 1; // netproc
    state.onRingEvent('click');
    expect(sendCommand).not.toHaveBeenCalled();
  });

  it('emits nothing when clicking on ports screen', () => {
    const sendCommand = vi.fn();
    const state = new AppState({ sendCommand });
    state.onSnapshot(makeSnap([{ id: 'r0', title: 'A', due: null, overdue: false }]), 1000);
    state.screenIndex = 2; // ports
    state.onRingEvent('click');
    expect(sendCommand).not.toHaveBeenCalled();
  });
});

// ── isStale ───────────────────────────────────────────────────────────────────

describe('AppState.isStale', () => {
  it('is not stale when lastAt=0 and now=0', () => {
    const state = new AppState({ sendCommand: vi.fn() });
    expect(state.isStale(0)).toBe(false);
  });

  it('is not stale exactly at 3000ms gap', () => {
    const state = new AppState({ sendCommand: vi.fn() });
    state.onSnapshot(makeSnap(), 1000);
    expect(state.isStale(4000)).toBe(false);
  });

  it('is stale at 3001ms gap', () => {
    const state = new AppState({ sendCommand: vi.fn() });
    state.onSnapshot(makeSnap(), 1000);
    expect(state.isStale(4001)).toBe(true);
  });

  it('is not stale when just received a snapshot', () => {
    const state = new AppState({ sendCommand: vi.fn() });
    state.onSnapshot(makeSnap(), 5000);
    expect(state.isStale(5000)).toBe(false);
  });
});

// ── view ──────────────────────────────────────────────────────────────────────

describe('AppState.view', () => {
  it('returns ≤8 lines total', () => {
    const state = new AppState({ sendCommand: vi.fn() });
    state.onSnapshot(makeSnap(), 1000);
    const { lines } = state.view(1000, '14:32');
    expect(lines.length).toBeLessThanOrEqual(8);
  });

  it('first line is the top bar with the timeStr', () => {
    const state = new AppState({ sendCommand: vi.fn() });
    state.onSnapshot(makeSnap(), 1000);
    const { lines } = state.view(1000, '09:05');
    expect(lines[0]).toContain('09:05');
  });

  it('shows connecting… when last is null', () => {
    const state = new AppState({ sendCommand: vi.fn() });
    const { lines } = state.view(0, '00:00');
    expect(lines[1]).toBe('connecting…');
    expect(lines.length).toBe(2);
  });

  it('top bar shows stale indicator when stale', () => {
    const state = new AppState({ sendCommand: vi.fn() });
    state.onSnapshot(makeSnap(), 1000);
    const { lines } = state.view(5000, '14:32'); // 4000ms > 3000ms → stale
    expect(lines[0]).toContain('stale');
  });

  it('top bar shows live indicator when not stale', () => {
    const state = new AppState({ sendCommand: vi.fn() });
    state.onSnapshot(makeSnap(), 1000);
    const { lines } = state.view(1000, '14:32'); // 0ms → not stale
    expect(lines[0]).toContain('●');
  });

  it('renders vitals content when on vitals screen', () => {
    const state = new AppState({ sendCommand: vi.fn() });
    state.onSnapshot(makeSnap(), 1000);
    state.screenIndex = 0;
    const { lines } = state.view(1000, '14:32');
    expect(lines.some(l => l.startsWith('CPU'))).toBe(true);
  });

  it('renders reminders content when on reminders screen', () => {
    const state = new AppState({ sendCommand: vi.fn() });
    const snap = makeSnap([{ id: 'r0', title: 'Do thing', due: null, overdue: false }]);
    state.onSnapshot(snap, 1000);
    state.screenIndex = 3;
    const { lines } = state.view(1000, '14:32');
    expect(lines.some(l => l.includes('Do thing'))).toBe(true);
  });

  it('total lines ≤8 even for reminders screen with many items', () => {
    const reminders = Array.from({ length: 8 }, (_, i) => ({
      id: `r${i}`,
      title: `Reminder ${i}`,
      due: null,
      overdue: false,
    }));
    const state = new AppState({ sendCommand: vi.fn() });
    state.onSnapshot(makeSnap(reminders), 1000);
    state.screenIndex = 3;
    const { lines } = state.view(1000, '14:32');
    expect(lines.length).toBeLessThanOrEqual(8);
  });
});
