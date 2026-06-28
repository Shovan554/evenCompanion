import { describe, it, expect } from 'vitest';
import { parseSnapshot, type Snapshot } from '../src/snapshot.js';

const validSnapshot: Snapshot = {
  ts: 1719561600000,
  host: 'MacBook-Pro',
  vitals: {
    cpu: 23.5,
    ramUsedGB: 11.2,
    ramTotalGB: 16,
    ramPressure: 'nominal',
    diskFreeGB: 142.3,
    diskTotalGB: 499.7,
    ssdHealth: 'Verified',
    ssdWearPct: 5,
  },
  netProc: {
    upKBs: 48.2,
    downKBs: 1234.5,
    topProc: { name: 'Chrome', cpu: 61 },
    battery: { pct: 78, charging: false },
  },
  ports: [
    { port: 3000, proc: 'node' },
    { port: 5432, proc: 'postgres' },
  ],
  reminders: [
    { id: 'r1', title: 'Call dentist', due: 1719561700000, overdue: false },
  ],
};

describe('parseSnapshot', () => {
  it('parses a full valid snapshot to a deep-equal object', () => {
    const raw = JSON.stringify(validSnapshot);
    const result = parseSnapshot(raw);
    expect(result).toEqual(validSnapshot);
  });

  it('returns null for malformed JSON', () => {
    expect(parseSnapshot('not json {')).toBeNull();
    expect(parseSnapshot('')).toBeNull();
    expect(parseSnapshot('null')).toBeNull();
    expect(parseSnapshot('"string"')).toBeNull();
    expect(parseSnapshot('42')).toBeNull();
  });

  it('returns null when vitals is missing', () => {
    const { vitals: _v, ...rest } = validSnapshot;
    expect(parseSnapshot(JSON.stringify(rest))).toBeNull();
  });

  it('returns null when ports is missing', () => {
    const { ports: _p, ...rest } = validSnapshot;
    expect(parseSnapshot(JSON.stringify(rest))).toBeNull();
  });

  it('returns null when ts is missing', () => {
    const { ts: _t, ...rest } = validSnapshot;
    expect(parseSnapshot(JSON.stringify(rest))).toBeNull();
  });

  it('returns null when netProc is missing', () => {
    const { netProc: _n, ...rest } = validSnapshot;
    expect(parseSnapshot(JSON.stringify(rest))).toBeNull();
  });

  it('returns null when reminders is missing', () => {
    const { reminders: _r, ...rest } = validSnapshot;
    expect(parseSnapshot(JSON.stringify(rest))).toBeNull();
  });

  it('allows netProc.battery to be null', () => {
    const snap: Snapshot = {
      ...validSnapshot,
      netProc: { ...validSnapshot.netProc, battery: null },
    };
    const result = parseSnapshot(JSON.stringify(snap));
    expect(result).toEqual(snap);
    expect(result?.netProc.battery).toBeNull();
  });

  it('allows vitals.ssdWearPct to be null', () => {
    const snap: Snapshot = {
      ...validSnapshot,
      vitals: { ...validSnapshot.vitals, ssdWearPct: null },
    };
    const result = parseSnapshot(JSON.stringify(snap));
    expect(result).toEqual(snap);
    expect(result?.vitals.ssdWearPct).toBeNull();
  });

  it('allows both battery and ssdWearPct to be null simultaneously', () => {
    const snap: Snapshot = {
      ...validSnapshot,
      vitals: { ...validSnapshot.vitals, ssdWearPct: null },
      netProc: { ...validSnapshot.netProc, battery: null },
    };
    const result = parseSnapshot(JSON.stringify(snap));
    expect(result).toEqual(snap);
  });

  it('allows host to be absent', () => {
    const { host: _h, ...rest } = validSnapshot;
    const result = parseSnapshot(JSON.stringify(rest));
    expect(result).not.toBeNull();
    expect(result?.host).toBeUndefined();
  });

  it('allows empty ports array', () => {
    const snap = { ...validSnapshot, ports: [] };
    const result = parseSnapshot(JSON.stringify(snap));
    expect(result).toEqual(snap);
  });

  it('allows empty reminders array', () => {
    const snap = { ...validSnapshot, reminders: [] };
    const result = parseSnapshot(JSON.stringify(snap));
    expect(result).toEqual(snap);
  });

  it('returns null when ports is not an array', () => {
    const snap = { ...validSnapshot, ports: 'not-array' };
    expect(parseSnapshot(JSON.stringify(snap))).toBeNull();
  });

  it('returns null when reminders is not an array', () => {
    const snap = { ...validSnapshot, reminders: {} };
    expect(parseSnapshot(JSON.stringify(snap))).toBeNull();
  });

  it('returns null when vitals is not an object', () => {
    const snap = { ...validSnapshot, vitals: 'string' };
    expect(parseSnapshot(JSON.stringify(snap))).toBeNull();
  });

  it('returns null when ts is not a number', () => {
    const snap = { ...validSnapshot, ts: 'not-a-number' };
    expect(parseSnapshot(JSON.stringify(snap))).toBeNull();
  });

  // ── deep validation: vitals ───────────────────────────────────────────────

  it('returns null when vitals is missing numeric fields (e.g. vitals: {})', () => {
    const snap = { ...validSnapshot, vitals: {} };
    expect(parseSnapshot(JSON.stringify(snap))).toBeNull();
  });

  it('returns null when vitals.cpu is not a number', () => {
    const snap = { ...validSnapshot, vitals: { ...validSnapshot.vitals, cpu: 'high' } };
    expect(parseSnapshot(JSON.stringify(snap))).toBeNull();
  });

  it('returns null when vitals.ramPressure is not a string', () => {
    const snap = { ...validSnapshot, vitals: { ...validSnapshot.vitals, ramPressure: 42 } };
    expect(parseSnapshot(JSON.stringify(snap))).toBeNull();
  });

  it('returns null when vitals.ssdHealth is not a string', () => {
    const snap = { ...validSnapshot, vitals: { ...validSnapshot.vitals, ssdHealth: null } };
    expect(parseSnapshot(JSON.stringify(snap))).toBeNull();
  });

  it('returns null when vitals.ssdWearPct is not a number or null', () => {
    const snap = { ...validSnapshot, vitals: { ...validSnapshot.vitals, ssdWearPct: 'unknown' } };
    expect(parseSnapshot(JSON.stringify(snap))).toBeNull();
  });

  // ── deep validation: netProc ──────────────────────────────────────────────

  it('returns null when netProc.upKBs is not a number', () => {
    const snap = { ...validSnapshot, netProc: { ...validSnapshot.netProc, upKBs: '10' } };
    expect(parseSnapshot(JSON.stringify(snap))).toBeNull();
  });

  it('returns null when topProc is present but missing cpu', () => {
    const snap = {
      ...validSnapshot,
      netProc: { ...validSnapshot.netProc, topProc: { name: 'Chrome' } },
    };
    expect(parseSnapshot(JSON.stringify(snap))).toBeNull();
  });

  it('returns null when topProc.name is not a string', () => {
    const snap = {
      ...validSnapshot,
      netProc: { ...validSnapshot.netProc, topProc: { name: 123, cpu: 50 } },
    };
    expect(parseSnapshot(JSON.stringify(snap))).toBeNull();
  });

  it('returns null when battery is present but missing charging', () => {
    const snap = {
      ...validSnapshot,
      netProc: { ...validSnapshot.netProc, battery: { pct: 80 } },
    };
    expect(parseSnapshot(JSON.stringify(snap))).toBeNull();
  });

  // ── deep validation: ports ────────────────────────────────────────────────

  it('returns null when a port element has a non-numeric port field', () => {
    const snap = { ...validSnapshot, ports: [{ port: 'three-thousand', proc: 'node' }] };
    expect(parseSnapshot(JSON.stringify(snap))).toBeNull();
  });

  it('returns null when a port element is missing proc', () => {
    const snap = { ...validSnapshot, ports: [{ port: 3000 }] };
    expect(parseSnapshot(JSON.stringify(snap))).toBeNull();
  });

  // ── deep validation: reminders ────────────────────────────────────────────

  it('returns null when a reminder is missing title', () => {
    const snap = {
      ...validSnapshot,
      reminders: [{ id: 'r1', due: null, overdue: false }],
    };
    expect(parseSnapshot(JSON.stringify(snap))).toBeNull();
  });

  it('returns null when a reminder has non-boolean overdue', () => {
    const snap = {
      ...validSnapshot,
      reminders: [{ id: 'r1', title: 'Task', due: null, overdue: 'yes' }],
    };
    expect(parseSnapshot(JSON.stringify(snap))).toBeNull();
  });

  it('returns null when a reminder.due is not a number or null', () => {
    const snap = {
      ...validSnapshot,
      reminders: [{ id: 'r1', title: 'Task', due: 'tomorrow', overdue: false }],
    };
    expect(parseSnapshot(JSON.stringify(snap))).toBeNull();
  });

  // ── regression: fully-valid frame still parses ────────────────────────────

  it('fully-valid frame with topProc null and ssdWearPct null still parses', () => {
    const snap: Snapshot = {
      ...validSnapshot,
      vitals: { ...validSnapshot.vitals, ssdWearPct: null },
      netProc: { ...validSnapshot.netProc, topProc: null, battery: null },
    };
    const result = parseSnapshot(JSON.stringify(snap));
    expect(result).toEqual(snap);
  });
});
