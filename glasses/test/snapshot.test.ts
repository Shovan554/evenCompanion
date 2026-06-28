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
});
