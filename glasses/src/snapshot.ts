export interface Vitals {
  cpu: number;
  ramUsedGB: number;
  ramTotalGB: number;
  ramPressure: string;
  diskFreeGB: number;
  diskTotalGB: number;
  ssdHealth: string;
  ssdWearPct: number | null;
}

export interface TopProc {
  name: string;
  cpu: number;
}

export interface Battery {
  pct: number;
  charging: boolean;
}

export interface NetProc {
  upKBs: number;
  downKBs: number;
  topProc: TopProc | null;
  battery: Battery | null;
}

export interface Port {
  port: number;
  proc: string;
}

export interface Reminder {
  id: string;
  title: string;
  due: number | null;
  overdue: boolean;
}

export interface Snapshot {
  ts: number;
  host?: string;
  vitals: Vitals;
  netProc: NetProc;
  ports: Port[];
  reminders: Reminder[];
}

// ── internal type-guard helpers ──────────────────────────────────────────────

function isNum(v: unknown): v is number {
  return typeof v === 'number';
}

function isStr(v: unknown): v is string {
  return typeof v === 'string';
}

function isBool(v: unknown): v is boolean {
  return typeof v === 'boolean';
}

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isNumOrNull(v: unknown): v is number | null {
  return v === null || isNum(v);
}

// ── sub-object validators ────────────────────────────────────────────────────

function validVitals(v: unknown): v is Vitals {
  if (!isObj(v)) return false;
  return (
    isNum(v['cpu']) &&
    isNum(v['ramUsedGB']) &&
    isNum(v['ramTotalGB']) &&
    isStr(v['ramPressure']) &&
    isNum(v['diskFreeGB']) &&
    isNum(v['diskTotalGB']) &&
    isStr(v['ssdHealth']) &&
    isNumOrNull(v['ssdWearPct'])
  );
}

function validNetProc(v: unknown): v is NetProc {
  if (!isObj(v)) return false;
  if (!isNum(v['upKBs']) || !isNum(v['downKBs'])) return false;

  // topProc: null OR { name: string; cpu: number }
  const tp = v['topProc'];
  if (tp !== null) {
    if (!isObj(tp)) return false;
    if (!isStr(tp['name']) || !isNum(tp['cpu'])) return false;
  }

  // battery: null OR { pct: number; charging: boolean }
  const bat = v['battery'];
  if (bat !== null) {
    if (!isObj(bat)) return false;
    if (!isNum(bat['pct']) || !isBool(bat['charging'])) return false;
  }

  return true;
}

function validPort(v: unknown): v is Port {
  if (!isObj(v)) return false;
  return isNum(v['port']) && isStr(v['proc']);
}

function validReminder(v: unknown): v is Reminder {
  if (!isObj(v)) return false;
  return (
    isStr(v['id']) &&
    isStr(v['title']) &&
    isNumOrNull(v['due']) &&
    isBool(v['overdue'])
  );
}

/**
 * Safely parse a raw JSON string into a Snapshot.
 * Returns the object if it passes a full shape guard, otherwise null.
 * Required top-level keys: ts (number), vitals (object), netProc (object),
 * ports (array), reminders (array).
 * Also validates all nested fields that screen renderers read.
 */
export function parseSnapshot(raw: string): Snapshot | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isObj(parsed)) return null;

  const obj = parsed;

  // ── top-level keys ────────────────────────────────────────────────────────
  if (!isNum(obj['ts'])) return null;
  if (!validVitals(obj['vitals'])) return null;
  if (!validNetProc(obj['netProc'])) return null;
  if (!Array.isArray(obj['ports'])) return null;
  if (!Array.isArray(obj['reminders'])) return null;

  // ── array element validation ──────────────────────────────────────────────
  if (!(obj['ports'] as unknown[]).every(validPort)) return null;
  if (!(obj['reminders'] as unknown[]).every(validReminder)) return null;

  return obj as unknown as Snapshot;
}
