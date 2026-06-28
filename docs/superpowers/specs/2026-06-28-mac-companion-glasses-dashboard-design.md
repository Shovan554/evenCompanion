# macCompanion — Mac Stats & Reminders Dashboard for Even Realities G2

**Date:** 2026-06-28
**Status:** Approved design
**Author:** Shovan (with Claude)

## 1. Overview

`macCompanion` is a system that surfaces live Mac telemetry and Reminders on Even
Realities G2 glasses, and lets the user act on reminders with the Even Ring. It is the
first project in the broader "Even Realities apps" effort.

The system is three independently-buildable pieces connected by a cloud relay:

1. **Relay** — a tiny cloud WebSocket fan-out service.
2. **even-reminder** — a native macOS menu bar app (the always-on hub) that collects
   stats, manages Reminders, and publishes snapshots to the relay.
3. **even-stats** — an Even Hub glasses app (a TypeScript WebView) that subscribes to
   the relay and renders the dashboard, navigated with the Even Ring.

## 2. Platform reality (Even Hub) — constraints that shaped this design

Established from the Even Hub docs (https://hub.evenrealities.com/docs) and the
`@evenrealities/even_hub_sdk` (npm, v0.0.11) TypeScript definitions:

- **An Even Hub app is a web page (TS/JS) running in a WebView inside the Even phone
  app.** It is not code on the glasses and not code on the Mac. The phone app bridges
  the WebView to the G2 over Bluetooth.
- **Rendering** is done by pushing "containers" via the SDK: up to **8 text fields**,
  **4 images**, plus lists — **max 12 containers total**, on a canvas of roughly
  **288×144 px, 4-bit grayscale** (monochrome-green HUD). Image container bounds in the
  SDK are width 20–288, height 20–144, which is where the canvas size is inferred.
  - `createStartUpPageContainer()` / `rebuildPageContainer()` define a screen.
  - `textContainerUpgrade()` updates a text field's content.
  - `updateImageRawData()` updates an image (e.g. a future sparkline).
  - Results can report `oversize` / `outOfMemory` and must be checked.
- **Input** arrives via `onEvenHubEvent()` as `OsEventTypeList` events
  (`CLICK_EVENT`, `SCROLL_TOP_EVENT`, `SCROLL_BOTTOM_EVENT`, `DOUBLE_CLICK_EVENT`),
  tagged with an `EventSourceType` of `RING`, `GLASSES_L`, or `GLASSES_R`. The **Even
  Ring** therefore drives navigation (scroll) and actions (click).
- **Networking** is a normal WebView → standard `fetch`/WebSocket are available.
- **Lifecycle** events include `FOREGROUND_ENTER`, `FOREGROUND_EXIT`,
  `ABNORMAL_EXIT`, `SYSTEM_EXIT`; launch source is `appMenu` or `glassesMenu`.
- **Device info** exposes model (`G1`/`G2`/`Ring1`), battery, wearing, charging, and
  connection status; local storage and location are also available.

**Consequence:** the WebView runs on the *phone*, not the Mac, so the phone must reach
the Mac over the network. The user chose an **anywhere / cloud-relay** topology over
LAN-only, so the Mac publishes to a relay the phone can always reach.

## 3. Architecture

```
┌─────────────────────────────┐         ┌──────────────┐         ┌──────────────────────────┐
│  even-reminder (macOS app)  │  WS push │    Relay     │  WS sub │  even-stats (webview)    │
│  SwiftUI menu bar, always-on│ ───────► │  (cloud, TS) │ ──────► │  TS + even_hub_sdk        │
│  • Stats collectors (1s)    │ snapshot │ latest       │ snapshot│  • Subscribe snapshots    │
│  • Reminders (EventKit)     │          │ snapshot per │         │  • Render dashboard text  │
│  • Relay publisher          │ ◄─────── │ secret token │ ◄────── │  • Ring → switch / act     │
│  • Add-reminder UI + icon   │ commands │              │ commands│                          │
└─────────────────────────────┘          └──────────────┘         └──────────────────────────┘
        (your Mac)              (auth: shared token)              (your phone → G2 over BLE)
```

**Data flow:** the Mac app builds a JSON snapshot every second and pushes it to the
relay over a persistent WebSocket keyed by a secret token. The glasses WebView
subscribes to the same token and updates text containers on each snapshot. A reverse
channel carries commands (e.g. `completeReminder`) from the glasses back to the Mac.

## 4. The data contract (snapshot)

The interface every piece agrees on. Pushed Mac → relay → glasses once per second:

```jsonc
{
  "ts": 1719600000,
  "host": "Shovan-MBP",
  "vitals":   { "cpu": 23.4, "ramUsedGB": 11.2, "ramTotalGB": 16, "ramPressure": "normal",
                "diskFreeGB": 142, "diskTotalGB": 512, "ssdHealth": "Verified", "ssdWearPct": null },
  "netProc":  { "upKBs": 48, "downKBs": 1200, "topProc": { "name": "Chrome", "cpu": 61.2 },
                "battery": { "pct": 88, "charging": true } },
  "ports":    [ { "port": 3000, "proc": "node" }, { "port": 5432, "proc": "postgres" } ],
  "reminders":[ { "id": "x1", "title": "Call dentist", "due": 1719605000, "overdue": false } ]
}
```

Reverse channel (glasses → relay → Mac):

```jsonc
{ "cmd": "completeReminder", "id": "x1" }
```

Notes:
- `ssdWearPct` is best-effort and may be `null` — deep SMART wear data is limited on
  Apple Silicon internal SSDs; `ssdHealth` reflects the macOS SMART status string.
- `battery` is present only on laptops; omitted/`null` on desktops.
- `ports` may be sampled less often than 1s (e.g. every 2–3s) since enumerating
  listening sockets is heavier; the field always carries the latest known list.

## 5. Glasses dashboard screens

A **persistent top bar** is shown on every screen: a **clock** (current local time,
e.g. `14:32`) on the left and a connection/stale indicator on the right. The clock is
driven locally by the WebView (not the snapshot), so it keeps ticking even if the relay
goes quiet. Below the top bar, the Even Ring scrolls between screens; click acts on the
current screen.

| Screen        | Contents (below the top-bar clock)                              |
|---------------|-----------------------------------------------------------------|
| 1 · Vitals    | CPU %, RAM used/total + pressure, Disk free, SSD health         |
| 2 · Net/Proc  | ↑↓ throughput, top CPU process, battery (if laptop)             |
| 3 · Ports     | listening port → process (e.g. `3000 node`, `5432 postgres`)    |
| 4 · Reminders | upcoming reminders; **Ring click = mark done** (reverse cmd)    |

The top-bar indicator shows **"stale ⟂"** if no snapshot has arrived for >3 seconds;
otherwise a small "live" dot. The clock occupies one text container; this leaves room
within the 8-text-field budget for each screen's content.

## 6. Components & boundaries

### 6.1 Relay (TypeScript, Node + `ws`)
- Auth by shared token → a "room". Holds the latest snapshot in memory.
- Fans out snapshots to all subscribers in the room; relays reverse commands back to
  the publisher.
- Knows nothing about stats or reminders — pure transport.
- Deployed to **Render** (chosen host) as a small always-on web service.

### 6.2 even-reminder (Swift + SwiftUI macOS menu bar app)
- **Collectors** — each stat source is its own small, testable function:
  CPU & RAM via Mach/`host_statistics`/`sysctl`; disk free + SSD SMART via
  `diskutil`; listening ports via `lsof -nP -iTCP -sTCP:LISTEN`; net throughput via
  interface counters; battery via IOKit.
- **Reminders module** — EventKit: read upcoming, complete by id.
- **Publisher** — reconnecting `URLSessionWebSocketTask` to the relay; sends snapshots,
  receives reverse commands and applies them (e.g. complete a reminder).
- **Menu bar UI** — the single app presents **two** separate menu bar items (both
  `MenuBarExtra` scenes, always-on icons):
  1. **Reminders** item — quick-add a reminder, view upcoming, see which were completed
     from the glasses.
  2. **Settings / Control** item — relay URL + secret token, connection status (relay +
     glasses), which screens/stats are enabled, launch-at-login toggle, and a
     publish/pause switch.
- **Launch at login** via `SMAppService`.

### 6.3 even-stats (TypeScript WebView, `@evenrealities/even_hub_sdk`)
- **Relay client** — reconnecting WebSocket subscriber.
- **Screen models** — one per screen (Vitals / Net-Proc / Ports / Reminders).
- **Renderer** — maps the active screen model to text containers via
  `createStartUpPageContainer` (first paint) and `textContainerUpgrade` (updates).
  Reserves the top row for the always-on **clock + live/stale indicator**, redrawn on a
  local 1s timer independent of snapshot arrival.
- **Input handler** — Ring `SCROLL_TOP/BOTTOM` switches screen; `CLICK` on the
  Reminders screen sends `completeReminder`.

## 7. Error handling

- Both Mac and glasses reconnect to the relay with exponential backoff.
- Glasses show **"stale ⟂"** when no snapshot for >3s; keep last values visible.
- Mac app handles denied EventKit permission gracefully (reminders section shows a
  "grant access" hint; stats still flow).
- Glasses check `createStartUpPageContainer` results for `oversize`/`outOfMemory` and
  fall back to fewer fields.
- Relay drops malformed frames; never crashes a room on bad input.

## 8. Testing strategy (TDD per piece)

- **Relay** — unit tests for token-room auth, latest-snapshot retention, fan-out, and
  reverse-command routing.
- **even-reminder** — each collector tested in isolation against known inputs;
  reminders module tested against EventKit test doubles; publisher tested against a
  mock relay.
- **even-stats** — rendered in the Even Hub **simulator** against a mock relay feeding
  scripted snapshots; input handling verified per event type.

## 9. Build order

1. **Relay** (smallest; unblocks end-to-end testing).
2. **even-stats glasses app** early, fed by the relay with mock snapshots — **de-risks
   the SDK**, the one true unknown, before investing in the Mac app.
3. **even-reminder** Mac app (the largest piece) — real collectors + reminders.
4. **Wire end-to-end**, then the reverse channel (Ring → complete reminder).

Each sub-project gets its own spec → plan → implementation cycle.

## 10. v1 scope

**In:** persistent top-bar **clock** + live/stale indicator, system vitals (CPU, RAM,
disk + SSD health), net throughput + top process, active listening ports, reminders
(view on glasses, add from Mac menu bar, **Ring click to mark done**), cloud-relay
transport, always-on menu bar app with icon + login item.

**Deferred:** notes integration, terminal logs, sparkline image graphs, richer Ring
actions (snooze/create from glasses), multiple Macs, LAN-direct mode.
