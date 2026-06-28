/**
 * sdkDisplay.ts — SDK-backed display adapter and Ring event subscription.
 * This is the ONLY module (besides main.ts) that imports @evenrealities/even_hub_sdk.
 */

import {
  EvenAppBridge,
  CreateStartUpPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
  StartUpPageCreateResult,
  OsEventTypeList,
  type EvenHubEvent,
} from '@evenrealities/even_hub_sdk';

import type { GlassesDisplay } from './display.js';
import { layoutContainers } from './layout.js';

export class SdkGlassesDisplay implements GlassesDisplay {
  private readonly bridge: EvenAppBridge;
  private containerCount = 0;
  private lastLines: string[] = [];

  constructor(bridge: EvenAppBridge) {
    this.bridge = bridge;
  }

  async init(lineCount: number): Promise<void> {
    const n = Math.max(1, Math.min(8, lineCount));
    await this._tryInit(n);
  }

  private async _tryInit(n: number): Promise<void> {
    const layouts = layoutContainers(n);
    const textObject: TextContainerProperty[] = layouts.map((layout, i) =>
      new TextContainerProperty({
        containerID: i,
        xPosition: layout.xPosition,
        yPosition: layout.yPosition,
        width: layout.width,
        height: layout.height,
        // Explicitly borderless with no padding. Left unset, the host draws a
        // default container divider — that's the stray dotted vertical line on
        // the right edge — and reserves padding that vertically clipped the text.
        borderWidth: 0,
        borderColor: 0,
        borderRadius: 0,
        paddingLength: 0,
        content: '',
      })
    );

    const container = new CreateStartUpPageContainer({
      containerTotalNum: n,
      textObject,
    });

    const result = await this.bridge.createStartUpPageContainer(container);

    if (
      result === StartUpPageCreateResult.oversize ||
      result === StartUpPageCreateResult.outOfMemory
    ) {
      if (n > 1) {
        // Retry once with one fewer container
        return this._tryInit(n - 1);
      }
      // Can't reduce further — accept failure silently
      return;
    }

    this.containerCount = n;
    this.lastLines = [];
  }

  async setLines(lines: string[]): Promise<void> {
    const count = Math.min(lines.length, this.containerCount);
    for (let i = 0; i < count; i++) {
      const content = lines[i] ?? '';
      if (content !== (this.lastLines[i] ?? '')) {
        const upgrade = new TextContainerUpgrade({
          containerID: i,
          content,
        });
        await this.bridge.textContainerUpgrade(upgrade);
        this.lastLines[i] = content;
      }
    }
  }

  async shutdown(): Promise<void> {
    await this.bridge.shutDownPageContainer();
  }
}

type RingEventType = 'scrollUp' | 'scrollDown' | 'click';

/**
 * Subscribe to Even Ring hardware events (and, optionally, lifecycle exit) via the bridge.
 *
 * Maps SCROLL_TOP_EVENT → 'scrollUp', SCROLL_BOTTOM_EVENT → 'scrollDown',
 * CLICK_EVENT/DOUBLE_CLICK_EVENT → 'click'. FOREGROUND_EXIT_EVENT and
 * SYSTEM_EXIT_EVENT call `onExit` (if provided).
 *
 * Everything goes through a SINGLE onEvenHubEvent registration. Registering the
 * ring handler and a separate exit handler as two subscriptions risked one
 * clobbering the other on hosts that keep a single callback — which is the most
 * likely reason ring scrolls did nothing.
 *
 * Returns an unsubscribe function.
 */
export function subscribeRingEvents(
  bridge: EvenAppBridge,
  handler: (e: RingEventType) => void,
  onExit?: () => void
): () => void {
  return bridge.onEvenHubEvent((event: EvenHubEvent) => {
    const sysEvent = event.sysEvent;
    if (!sysEvent) return;

    switch (sysEvent.eventType) {
      case OsEventTypeList.SCROLL_TOP_EVENT:
        handler('scrollUp');
        break;
      case OsEventTypeList.SCROLL_BOTTOM_EVENT:
        handler('scrollDown');
        break;
      case OsEventTypeList.CLICK_EVENT:
      case OsEventTypeList.DOUBLE_CLICK_EVENT:
        handler('click');
        break;
      case OsEventTypeList.FOREGROUND_EXIT_EVENT:
      case OsEventTypeList.SYSTEM_EXIT_EVENT:
        onExit?.();
        break;
      // FOREGROUND_ENTER, IMU_DATA_REPORT, etc. are ignored.
    }
  });
}
