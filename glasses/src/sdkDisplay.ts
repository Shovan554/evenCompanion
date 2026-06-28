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
 * Subscribe to Even Ring hardware events via the bridge.
 * Maps SCROLL_TOP_EVENT → 'scrollUp', SCROLL_BOTTOM_EVENT → 'scrollDown', CLICK_EVENT → 'click'.
 * Ignores all other event types.
 * Returns an unsubscribe function.
 */
export function subscribeRingEvents(
  bridge: EvenAppBridge,
  handler: (e: RingEventType) => void
): () => void {
  return bridge.onEvenHubEvent((event: EvenHubEvent) => {
    const sysEvent = event.sysEvent;
    if (!sysEvent) return;

    const eventType = sysEvent.eventType;
    if (eventType === OsEventTypeList.SCROLL_TOP_EVENT) {
      handler('scrollUp');
    } else if (eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
      handler('scrollDown');
    } else if (eventType === OsEventTypeList.CLICK_EVENT) {
      handler('click');
    }
    // All other event types (FOREGROUND_ENTER, SYSTEM_EXIT, etc.) are ignored here.
  });
}
