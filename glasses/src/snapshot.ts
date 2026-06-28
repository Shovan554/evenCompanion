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

/**
 * Safely parse a raw JSON string into a Snapshot.
 * Returns the object if it passes a top-level shape guard, otherwise null.
 * Required top-level keys: ts (number), vitals (object), netProc (object),
 * ports (array), reminders (array).
 */
export function parseSnapshot(raw: string): Snapshot | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj['ts'] !== 'number') return null;
  if (obj['vitals'] === null || typeof obj['vitals'] !== 'object' || Array.isArray(obj['vitals'])) return null;
  if (obj['netProc'] === null || typeof obj['netProc'] !== 'object' || Array.isArray(obj['netProc'])) return null;
  if (!Array.isArray(obj['ports'])) return null;
  if (!Array.isArray(obj['reminders'])) return null;

  return obj as unknown as Snapshot;
}
