import type { Snapshot } from './snapshot.js';
import { SCREENS, topBar, renderScreen } from './screens.js';

type RingEvent = 'scrollUp' | 'scrollDown' | 'click';

interface AppStateOptions {
  sendCommand: (cmd: object) => void;
}

export class AppState {
  screenIndex = 0;
  last: Snapshot | null = null;
  lastAt = 0;
  selectedIndex = 0;

  private readonly sendCommand: (cmd: object) => void;

  constructor(opts: AppStateOptions) {
    this.sendCommand = opts.sendCommand;
  }

  onSnapshot(snap: Snapshot | null, now: number): void {
    if (snap === null) return;
    this.last = snap;
    this.lastAt = now;
    // Clamp selectedIndex into [0, max(0, reminders.length - 1)]
    const maxIdx = Math.max(0, snap.reminders.length - 1);
    this.selectedIndex = Math.min(this.selectedIndex, maxIdx);
  }

  onRingEvent(evt: RingEvent): void {
    if (evt === 'scrollDown') {
      this.screenIndex = (this.screenIndex + 1) % SCREENS.length;
    } else if (evt === 'scrollUp') {
      this.screenIndex = (this.screenIndex - 1 + SCREENS.length) % SCREENS.length;
    } else if (evt === 'click') {
      const currentScreen = SCREENS[this.screenIndex];
      if (currentScreen === 'reminders' && this.last !== null) {
        const reminder = this.last.reminders[this.selectedIndex];
        if (reminder !== undefined) {
          this.sendCommand({ cmd: 'completeReminder', id: reminder.id });
        }
      }
      // TODO v2: move selection with ring
    }
  }

  isStale(now: number): boolean {
    return now - this.lastAt > 3000;
  }

  view(now: number, timeStr: string): { lines: string[] } {
    const bar = topBar(timeStr, this.isStale(now));
    if (this.last === null) {
      return { lines: [bar, 'connecting…'] };
    }
    const currentKind = SCREENS[this.screenIndex];
    const contentLines = renderScreen(currentKind, this.last, { selectedIndex: this.selectedIndex });
    const lines = [bar, ...contentLines].slice(0, 8);
    return { lines };
  }
}
