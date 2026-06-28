import { pct, gb, kbps, trunc } from './format.js';
import type { Snapshot } from './snapshot.js';

export type ScreenKind = 'vitals' | 'netproc' | 'ports' | 'reminders';

export const SCREENS: ScreenKind[] = ['vitals', 'netproc', 'ports', 'reminders'];

/**
 * Returns a top bar string with the time on the left and a live/stale
 * indicator on the right. Total length kept below 30 characters.
 * Examples: "14:32   ●"  /  "14:32  ⟂stale"
 */
export function topBar(timeStr: string, stale: boolean): string {
  const right = stale ? '⟂stale' : '●';
  const gap = '  ';
  return `${timeStr}${gap}${right}`;
}

/**
 * Renders the content lines for a given screen kind.
 * Returns at most 7 lines (the top bar is NOT included).
 */
export function renderScreen(
  kind: ScreenKind,
  snap: Snapshot,
  opts: { selectedIndex?: number } = {},
): string[] {
  switch (kind) {
    case 'vitals':
      return renderVitals(snap);
    case 'netproc':
      return renderNetProc(snap);
    case 'ports':
      return renderPorts(snap);
    case 'reminders':
      return renderReminders(snap, opts.selectedIndex ?? 0);
  }
}

function renderVitals(snap: Snapshot): string[] {
  const { vitals } = snap;
  const lines: string[] = [
    `CPU ${pct(vitals.cpu)}`,
    `RAM ${gb(vitals.ramUsedGB)}/${gb(vitals.ramTotalGB)}`,
    `DISK ${gb(vitals.diskFreeGB)} free`,
    `SSD ${vitals.ssdHealth}`,
  ];
  if (vitals.ssdWearPct !== null) {
    lines.push(`WEAR ${pct(vitals.ssdWearPct)}`);
  }
  return lines.slice(0, 7);
}

function renderNetProc(snap: Snapshot): string[] {
  const { netProc } = snap;
  const lines: string[] = [
    `NET ↑${kbps(netProc.upKBs)} ↓${kbps(netProc.downKBs)}`,
    netProc.topProc
      ? `TOP ${trunc(netProc.topProc.name, 10)} ${pct(netProc.topProc.cpu)}`
      : 'TOP —',
  ];
  if (netProc.battery !== null) {
    const charging = netProc.battery.charging ? '+' : '';
    lines.push(`BAT ${pct(netProc.battery.pct)}${charging}`);
  }
  return lines.slice(0, 7);
}

function renderPorts(snap: Snapshot): string[] {
  const { ports } = snap;
  if (ports.length === 0) return ['No open ports'];
  const visible = ports.slice(0, 6);
  const lines = visible.map(p => `${p.port} ${trunc(p.proc, 12)}`);
  if (ports.length > 6) {
    lines.push(`+${ports.length - 6} more`);
  }
  return lines.slice(0, 7);
}

function renderReminders(snap: Snapshot, selectedIndex: number): string[] {
  const { reminders } = snap;
  if (reminders.length === 0) return ['No reminders'];
  const visible = reminders.slice(0, 6);
  const lines = visible.map((r, i) => {
    const marker = i === selectedIndex ? '›' : ' ';
    const title = trunc(r.title, 16);
    const overdueMark = r.overdue ? ' !' : '';
    return `${marker}${title}${overdueMark}`;
  });
  if (reminders.length > 6) {
    lines.push(`+${reminders.length - 6} more`);
  }
  return lines.slice(0, 7);
}
