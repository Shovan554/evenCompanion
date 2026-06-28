/**
 * main.ts — Even-stats WebView entry point.
 * Wires the bridge, relay, state machine, and display together.
 */

import {
  waitForEvenAppBridge,
  OsEventTypeList,
  type EvenHubEvent,
} from '@evenrealities/even_hub_sdk';

import { parseSnapshot } from './snapshot.js';
import { clock } from './format.js';
import { AppState } from './state.js';
import { RelayClient } from './relayClient.js';
import { SdkGlassesDisplay, subscribeRingEvents } from './sdkDisplay.js';

/** Configure via Even Hub local storage key 'relayUrl'. Defaults to the deployed relay. */
const DEFAULT_RELAY_WSS_URL = 'wss://maccompanion-relay.onrender.com';

(async () => {
  // 1. Wait for the bridge to be ready. SDK returns the bridge instance.
  const bridge = await waitForEvenAppBridge();

  // 2. Read config. Precedence: URL query params (so a single pasted dev URL can
  //    carry everything) > Even Hub local storage > built-in default.
  const params = new URLSearchParams(location.search);
  const storedUrl = await bridge.getLocalStorage('relayUrl');
  const storedToken = await bridge.getLocalStorage('relayToken');
  const url = params.get('relayUrl') || storedUrl || DEFAULT_RELAY_WSS_URL;
  const token = params.get('token') || params.get('relayToken') || storedToken || '';

  // 3. Build the display adapter.
  const display = new SdkGlassesDisplay(bridge);

  // 4. Build relay first so the late-bound closure inside AppState can reference it.
  let relay: RelayClient;

  const state = new AppState({
    sendCommand: (cmd) => relay.send(cmd),
  });

  function render(): void {
    try {
      void display.setLines(state.view(Date.now(), clock(new Date())).lines);
    } catch (err) {
      console.warn('[even-stats] render error suppressed:', err);
    }
  }

  relay = new RelayClient({
    url,
    token,
    onSnapshot: (raw) => {
      const snap = parseSnapshot(raw);
      if (snap !== null) {
        state.onSnapshot(snap, Date.now());
      }
      render();
    },
  });

  // 5. Initialise the display (8 text containers: 1 top bar + 7 content lines).
  await display.init(8);

  // 6. Subscribe to Ring events.
  subscribeRingEvents(bridge, (e) => {
    state.onRingEvent(e);
    render();
  });

  // 7. Start the relay connection — only when a URL is configured.
  if (!url) {
    console.warn('[even-stats] relayUrl is unconfigured — skipping WebSocket connection');
    render();
  } else {
    relay.connect();
  }

  // 8. 1-second timer to keep the clock and stale indicator up-to-date.
  const timer = setInterval(render, 1000);

  // 9. Listen for foreground-exit / system-exit to clean up.
  bridge.onEvenHubEvent((event: EvenHubEvent) => {
    const sysEvent = event.sysEvent;
    if (!sysEvent) return;
    const et = sysEvent.eventType;
    if (
      et === OsEventTypeList.FOREGROUND_EXIT_EVENT ||
      et === OsEventTypeList.SYSTEM_EXIT_EVENT
    ) {
      clearInterval(timer);
      relay.close();
      void display.shutdown();
    }
  });

  // Initial render.
  render();
})();
