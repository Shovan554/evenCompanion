# even-stats — Glasses App

A lightweight WebView app for the Even G2 smart glasses that displays a live Mac dashboard (CPU, RAM, disk, network, ports, reminders) and navigates with the Even Ring.

## How it works

- `main.ts` is the WebView entry point.
- On start it connects to the relay WebSocket and renders four screens on the G2 display: **Vitals**, **Net/Proc**, **Ports**, and **Reminders**.
- The Even Ring controls navigation: scroll up/down changes screens; tap on the Reminders screen completes the selected reminder.
- The clock and stale indicator update every second via a local timer, independent of relay messages.

## Configuration

Two keys are read from Even Hub local storage at start-up:

| Key | Example | Description |
|---|---|---|
| `relayUrl` | `wss://maccompanion-relay.onrender.com` | WebSocket URL of the relay server |
| `relayToken` | `mysecret` | Shared auth token |

Set them in the Even Hub app before launching even-stats, or via the Even Hub simulator's localStorage panel.

## Running in the Even Hub simulator

```bash
# Install dependencies (first time)
npm install

# Start the dev server (uses tsx + the Even Hub CLI simulator)
npm run dev
```

Then open the Even Hub simulator and point it at the local dev URL.

## Building

```bash
npm run build
```

Produces a single ESM bundle under `dist/` (output of tsup). Load `dist/main.js` as the WebView entry in the Even Hub app manifest.

## Type-checking

```bash
npm run typecheck
```

## Running tests

```bash
npm test
```

Pure core modules (`snapshot`, `format`, `screens`, `state`, `relayClient`, `display`, `layout`) are fully unit-tested with vitest. The SDK-facing modules (`sdkDisplay`, `main`) require real hardware and are not unit-tested.
