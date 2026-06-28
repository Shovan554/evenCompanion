import { pct, gb, kbps, trunc, bar } from './format.js';
import type { Snapshot } from './snapshot.js';

export type ScreenKind = 'vitals' | 'netproc' | 'ports' | 'reminders';

export const SCREENS: ScreenKind[] = ['vitals', 'netproc', 'ports', 'reminders'];

/**
 * Content rows available below the top bar.
 * The display reserves 6 containers total: 1 top bar + 5 content rows.
 * Keeping screens within this budget is what stops the old vertical text clipping.
 */
export const CONTENT_ROWS = 5;

/**
 * Maps a list to at most CONTENT_ROWS rendered rows.
 * If the list is longer, the last row becomes "+N more" so nothing is silently dropped.
 */
function capRows<T>(items: T[], render: (item: T, index: number) => string): string[] {
  if (items.length <= CONTENT_ROWS) return items.map(render);
  const head = items.slice(0, CONTENT_ROWS - 1).map(render);
  head.push(`+${items.length - (CONTENT_ROWS - 1)} more`);
  return head;
}

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
  // RAM and disk bars show the *used* fraction; the trailing number is the headline value.
  const ramPct = vitals.ramTotalGB > 0 ? (vitals.ramUsedGB / vitals.ramTotalGB) * 100 : 0;
  const diskUsedPct =
    vitals.diskTotalGB > 0 ? ((vitals.diskTotalGB - vitals.diskFreeGB) / vitals.diskTotalGB) * 100 : 0;
  const lines: string[] = [
    `CPU ${bar(vitals.cpu)} ${pct(vitals.cpu)}`,
    `RAM ${bar(ramPct)} ${gb(vitals.ramUsedGB)}/${gb(vitals.ramTotalGB)}`,
    `DISK ${bar(diskUsedPct)} ${gb(vitals.diskFreeGB)}`,
    `SSD ${vitals.ssdHealth}`,
  ];
  if (vitals.ssdWearPct !== null) {
    lines.push(`WEAR ${bar(vitals.ssdWearPct)} ${pct(vitals.ssdWearPct)}`);
  }
  return lines.slice(0, CONTENT_ROWS);
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
    lines.push(`BAT ${bar(netProc.battery.pct)} ${pct(netProc.battery.pct)}${charging}`);
  }
  return lines.slice(0, CONTENT_ROWS);
}

function renderPorts(snap: Snapshot): string[] {
  const { ports } = snap;
  if (ports.length === 0) return ['No open ports'];
  return capRows(ports, p => `${p.port} ${trunc(p.proc, 12)}`);
}

function renderReminders(snap: Snapshot, selectedIndex: number): string[] {
  const { reminders } = snap;
  if (reminders.length === 0) return ['No reminders'];
  return capRows(reminders, (r, i) => {
    const marker = i === selectedIndex ? '›' : ' ';
    const title = trunc(r.title, 16);
    const overdueMark = r.overdue ? ' !' : '';
    return `${marker}${title}${overdueMark}`;
  });
}
