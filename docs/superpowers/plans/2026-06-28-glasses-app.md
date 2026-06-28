# even-stats (Glasses App) Implementation Plan

> **For agentic workers:** executed via subagent-driven development. Tasks are design-level contracts; implementers write code TDD-style (mid-tier model). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the Even Hub WebView app (`even-stats`) that subscribes to the relay, renders the Mac dashboard on the G2, and navigates with the Even Ring.

**Architecture:** A small TypeScript app. Pure, framework-free core modules (snapshot parsing, screen formatting, app state machine) are fully unit-tested with vitest. Side-effectful edges (the relay WebSocket subscriber and the glasses display) sit behind injected interfaces so they are testable with fakes; the real glasses display is the only module that imports `@evenrealities/even_hub_sdk`. `main.ts` wires everything for the WebView.

**Tech Stack:** TypeScript (ESM), `@evenrealities/even_hub_sdk`, vitest + `ws` (test-only WebSocket), tsup (bundle for the WebView), tsx. Lives in `glasses/`.

## Global Constraints

- All app code lives under `glasses/`. ESM, Node `>=20` for tooling.
- The glasses display budget: one screen = a **top bar** (clock + live/stale indicator) plus up to **7 content lines**. Never emit more than 8 text fields total. Keep each line short (the canvas is ~288×144 px, 4-bit grayscale).
- The snapshot shape MUST match the relay/Mac data contract in the design spec §4 exactly (`ts, host, vitals{cpu,ramUsedGB,ramTotalGB,ramPressure,diskFreeGB,diskTotalGB,ssdHealth,ssdWearPct}, netProc{upKBs,downKBs,topProc{name,cpu},battery{pct,charging}|null}, ports[{port,proc}], reminders[{id,title,due,overdue}]`).
- Reverse command to the relay: `{ "cmd": "completeReminder", "id": <string> }`.
- Connection: subscriber WebSocket to `wss://<relay>/ws?token=<secret>&role=sub`. Reconnect with exponential backoff (cap ~10s).
- Screens, in Ring-scroll order: `vitals`, `netproc`, `ports`, `reminders`. Ring `SCROLL_TOP` → previous screen, `SCROLL_BOTTOM` → next (wrapping), `CLICK` on the reminders screen → complete the selected reminder.
- "Stale" = no snapshot received for >3000 ms. The clock updates on a local 1s timer, independent of snapshots.
- Pure core modules (`snapshot.ts`, `screens.ts`, `state.ts`) MUST NOT import the SDK, WebSocket, or any I/O — they are pure and unit-tested.

## File Structure

- `glasses/src/snapshot.ts` — `Snapshot` types + `parseSnapshot(raw: string): Snapshot | null` (safe parse + shape guard).
- `glasses/src/format.ts` — small pure formatting helpers (e.g. `clock(date)`, `pct`, `gb`, `kbps`, truncation to a max width).
- `glasses/src/screens.ts` — pure: `renderScreen(kind, snapshot, opts): string[]` returning the content lines for a screen; plus `topBar(timeStr, stale): string`.
- `glasses/src/state.ts` — `AppState` class: holds current screen index, last snapshot + last-received time, selected reminder index; methods `onSnapshot`, `onRingEvent`, `isStale(now)`, `view(now)` → `{ lines: string[] }`, and emits reverse commands via an injected callback.
- `glasses/src/relayClient.ts` — `RelayClient`: reconnecting subscriber. Constructor takes `{ url, token, socketFactory, onSnapshot, onStatusChange }`. `send(cmd)` for reverse commands. `socketFactory` defaults to global `WebSocket`; tests inject a fake.
- `glasses/src/display.ts` — `GlassesDisplay` interface (`init(lineCount)`, `setLines(lines: string[])`, `shutdown()`); plus `MockDisplay` for tests. NO SDK import here.
- `glasses/src/sdkDisplay.ts` — the ONLY SDK-importing module: `SdkGlassesDisplay implements GlassesDisplay` using `createStartUpPageContainer` / `textContainerUpgrade` / `shutDownPageContainer`, and an input bridge translating `onEvenHubEvent` Ring events to a callback.
- `glasses/src/main.ts` — wires bridge (`waitForEvenAppBridge`), config (relay url/token from `getLocalStorage` or launch params), `RelayClient`, `AppState`, `SdkGlassesDisplay`, the 1s clock timer.
- `glasses/test/*.test.ts` — vitest unit tests per pure module + relay client (fake socket) + state machine.

---

### Task G1: Scaffold + snapshot types & parser

**Deliverable:** `glasses/` project builds and tests run; `parseSnapshot` validated.

- [ ] Create `glasses/package.json` (ESM, `"type":"module"`, scripts: `dev` tsx, `build` `tsup src/main.ts --format esm --target es2020 --clean`, `test` vitest, `typecheck` `tsc --noEmit`), dep `@evenrealities/even_hub_sdk@^0.0.11`, devDeps `ws`, `@types/ws`, `@types/node`, `tsup`, `tsx`, `typescript`, `vitest`.
- [ ] Create `glasses/tsconfig.json` (target ES2020, module ESNext, moduleResolution Bundler, strict, `lib: ["ES2020","DOM"]` so `WebSocket` is typed, noEmit).
- [ ] TDD `glasses/src/snapshot.ts`: define the `Snapshot`, `Vitals`, `NetProc`, `Port`, `Reminder` interfaces matching the contract. `parseSnapshot(raw)` returns a typed `Snapshot` for valid JSON with the required top-level keys (`ts`, `vitals`, `netProc`, `ports`, `reminders`), else `null`. Tests: valid snapshot parses; malformed JSON → null; missing `vitals` → null; `battery: null` allowed.
- [ ] `npm install`, `npm test` (green), `npm run build` (exit 0), commit `feat(glasses): scaffold + snapshot parser`.

### Task G2: Screen formatting + app state machine

**Deliverable:** pure rendering of all four screens + Ring navigation/stale logic, fully unit-tested.

- [ ] TDD `glasses/src/format.ts`: `clock(d: Date): string` → `HH:MM` zero-padded; `pct(n)` → e.g. `23%`; `gb(n)` → `142G`; `kbps(n)` → `1.2M`/`48K`; `trunc(s, n)`; all pure. Tests for each.
- [ ] TDD `glasses/src/screens.ts`:
  - `topBar(timeStr, stale)` → e.g. `"14:32        ●"` (live dot) or `"14:32      ⟂stale"`.
  - `renderScreen('vitals', snap)` → lines like `CPU 23%`, `RAM 11.2/16G`, `DISK 142G free`, `SSD Verified` (≤7 lines).
  - `renderScreen('netproc', snap)` → `NET ↑48K ↓1.2M`, `TOP Chrome 61%`, battery line if present.
  - `renderScreen('ports', snap)` → one line per listening port `3000 node` (cap at 6, append `+N more` if more).
  - `renderScreen('reminders', snap, {selectedIndex})` → one line per reminder, marking the selected one (e.g. leading `›`), overdue marked `!`; `No reminders` when empty; cap at 6.
  - Tests assert exact line arrays for representative snapshots, the ≤7-line cap, selection marker, empty states.
- [ ] TDD `glasses/src/state.ts`: `AppState` holding `screenIndex` (0..3 over `['vitals','netproc','ports','reminders']`), `last: Snapshot|null`, `lastAt: number`, `selectedIndex`. Methods:
  - `onSnapshot(snap, now)` — store + reset stale timer; clamp `selectedIndex` to reminders length.
  - `onRingEvent(evt)` where evt ∈ `{scrollUp, scrollDown, click}` — scroll changes screen (wrapping); on the reminders screen, scrolls move `selectedIndex` instead of screen ONLY IF you decide per-screen — KEEP IT SIMPLE: scroll always changes screen; `click` on reminders screen emits `completeReminder` for `reminders[selectedIndex]` via injected `sendCommand`; for selecting which reminder, `click` cycles selection then a `doubleClick`/long acts — NO: v1 = click completes the FIRST overdue or selectedIndex=0 reminder. Implement: scroll = change screen; click on reminders screen completes `reminders[0]` (selectedIndex stays 0 in v1) — document this clearly and leave selection movement as a TODO comment for v2.
  - `isStale(now)` → `now - lastAt > 3000`.
  - `view(now, timeStr)` → `{ lines: [topBar, ...renderScreen(currentKind, last, {selectedIndex})] }`; when `last` is null show a `connecting…` placeholder under the top bar.
  - Tests: scroll wraps across 4 screens both directions; click on reminders emits exactly one `completeReminder` with the right id; click on non-reminders screen emits nothing; stale boundary at 3000ms; view shape ≤8 lines.
- [ ] `npm test` green, commit `feat(glasses): screen formatting + state machine`.

### Task G3: Relay client + glasses display interface

**Deliverable:** reconnecting subscriber and a mockable display, both tested with fakes.

- [ ] TDD `glasses/src/relayClient.ts`: `RelayClient` connects to `${url}/ws?token=${token}&role=sub` via injected `socketFactory(url)`. On message → `onSnapshot(raw)`. On open → `onStatusChange('connected')`; on close/error → `onStatusChange('disconnected')` then reconnect with exponential backoff (100ms→…→cap 10s; injectable timer/`scheduleReconnect` so tests are deterministic). `send(obj)` JSON-stringifies and sends if open. `close()` stops reconnection. Tests with a `FakeSocket`: connects to correct URL; forwards messages to `onSnapshot`; reconnects after a close; `send` writes JSON; `close()` prevents further reconnects.
- [ ] `glasses/src/display.ts`: `GlassesDisplay` interface + `MockDisplay` recording `init`/`setLines`/`shutdown` calls. Pure (no SDK). Trivial test that `MockDisplay` records calls.
- [ ] `npm test` green, commit `feat(glasses): relay client + display interface`.

### Task G4: SDK display adapter + main wiring + build

**Deliverable:** the WebView entrypoint assembled; builds to a bundle. (SDK-facing code is integration glue — light/no unit tests; keep it thin.)

- [ ] `glasses/src/sdkDisplay.ts`: `SdkGlassesDisplay implements GlassesDisplay` using the SDK bridge — `init(n)` calls `createStartUpPageContainer` with `n` text containers laid out vertically within 288×144 (top bar at y=0, content lines stacked); `setLines(lines)` calls `textContainerUpgrade` per changed line; `shutdown()` calls `shutDownPageContainer`. Also export `subscribeRingEvents(bridge, handler)` translating `onEvenHubEvent` → `{scrollUp|scrollDown|click}` (map `SCROLL_TOP→scrollUp`, `SCROLL_BOTTOM→scrollDown`, `CLICK→click`; only for `eventSource` RING or glasses touch). Guard container-create results (`oversize`/`outOfMemory`) by reducing line count. Keep this file focused; do not unit-test the SDK calls (no hardware) but DO keep the layout math in a small pure helper `layoutContainers(n)` that IS unit-tested.
- [ ] TDD the pure `layoutContainers(n): {x,y,width,height}[]` helper (in `sdkDisplay.ts` or a sibling `layout.ts`): n containers stacked in 144px height, full 288 width, non-overlapping, top bar first. Test bounds for n=4 and n=8.
- [ ] `glasses/src/main.ts`: `await waitForEvenAppBridge()`; read relay `url`+`token` via `getLocalStorage('relayUrl'|'relayToken')` (fallback to constants/launch params); create `AppState` with `sendCommand` wired to `RelayClient.send`; `RelayClient` with `onSnapshot` → `state.onSnapshot(parseSnapshot(raw), Date.now())` then re-render; `subscribeRingEvents` → `state.onRingEvent` then re-render; a `setInterval(1s)` re-render for the clock + stale check; render = `display.setLines(state.view(Date.now(), clock(new Date())).lines)`. Handle `FOREGROUND_EXIT`/`SYSTEM_EXIT` → `display.shutdown()` + `relay.close()`.
- [ ] Create `glasses/README.md`: how to set relay url/token, how to run in the Even Hub simulator, how to package. Note that `main.ts` is the WebView entry.
- [ ] `npm test` green, `npm run build` exit 0, `npm run typecheck` clean, commit `feat(glasses): sdk display adapter + main wiring`.

## Self-Review checklist (controller, after G4)
- All four screens covered; ≤8 text fields enforced; reverse command shape correct; reconnect/stale logic tested; pure core has zero I/O imports; only `sdkDisplay.ts`/`main.ts` import the SDK.
