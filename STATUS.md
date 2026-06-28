# macCompanion — Build Status & Configure-on-Return Guide

_Last updated: 2026-06-28. Everything below is built, tested, and committed on `main`._

## What got built (while you were away)

Three sub-projects, each designed → planned → built TDD-style with per-task + whole-app reviews, then merged to `main`.

| Piece | What it is | Tests | Build |
|---|---|---|---|
| **relay/** | Cloud WebSocket fan-out service (token rooms, Mac→glasses snapshots + reverse commands). Render-deployable. | 16 ✅ | `npm run build` ✅ |
| **glasses/** | `even-stats` Even Hub WebView app: subscribes to relay, renders 4 Ring-scrollable screens + top-bar clock. | 152 ✅ | 12 KB bundle ✅ |
| **mac/** | `even-reminder` SwiftUI menu bar app: collects stats + Reminders, publishes 1s snapshots, 2 menu bar items. | 81 ✅ | `swift build` ✅ |

**Total: 249 passing tests.** The one shared contract — the snapshot JSON — is guarded on both ends (Mac `SnapshotContractTests` encodes it; glasses `parseSnapshot` deep-validates it).

Docs:
- Design spec: `docs/superpowers/specs/2026-06-28-mac-companion-glasses-dashboard-design.md`
- Plans: `docs/superpowers/plans/2026-06-28-{relay,glasses-app,mac-app}.md`

## Architecture recap

```
even-reminder (Mac, SwiftUI)  ──WS pub──►  relay (Render)  ──WS sub──►  even-stats (glasses WebView)
  stats + Reminders + UI                  token rooms                   dashboard + Even Ring nav
        ▲──────────────────── reverse cmd {completeReminder} ───────────────────┘
```

The phone runs the glasses WebView; it reaches the Mac via the relay, so it works on any network.

---

## ⚙️ Configure-on-return checklist (the parts only you can do)

### 1. Deploy the relay to Render (~5 min)
1. Create a GitHub repo and push this project:
   ```bash
   cd /Users/shovansmini/codes/evenRealties/macCompanion
   gh repo create macCompanion --private --source=. --push   # or your preferred remote
   ```
2. Generate a strong secret token and keep it somewhere safe:
   ```bash
   openssl rand -hex 24
   ```
3. In Render: **New → Blueprint**, pick the repo. It reads the root `render.yaml` (service `maccompanion-relay`, `rootDir: relay`). When prompted, set env var **`RELAY_TOKEN`** = the token from step 2. (`NODE_ENV=production` is already set, so the relay refuses to start without it — by design.)
4. After deploy, confirm: open `https://maccompanion-relay.onrender.com/healthz` → should print `ok`.
   - Note: Render's free tier sleeps when idle; the Mac publisher's persistent connection keeps it warm while running. Upgrade later if you want guaranteed always-on.
5. Record your relay base URL: `wss://<your-service>.onrender.com`

### 2. Run the Mac app (even-reminder)
For day-to-day use you'll want a real `.app` bundle (icon, login item, Reminders permission). Two options:

**Quick test (CLI binary):**
```bash
cd /Users/shovansmini/codes/evenRealties/macCompanion/mac
swift run EvenReminder
```
Two icons appear in the menu bar (Reminders ✅, Settings/gauge ⚙️). The embedded Info.plist carries the Reminders usage description so the permission prompt works.

**Proper app bundle (recommended):** open the package in Xcode (`xed mac`) and either run the `EvenReminder` scheme, or do Product → Archive to get a signed `.app` you can keep in `/Applications`. Drop an `AppIcon` in an asset catalog when you do (see `mac/Sources/EvenReminder/` — icon is a documented TODO).

Then in the **Settings ⚙️ menu bar item**:
- Relay URL = `wss://<your-service>.onrender.com`
- Relay token = the secret from step 1.2
- Toggle **Publish** on; flip **Launch at login** if you want it always running.
- Grant the **Reminders** permission when macOS prompts.

### 3. Build & install the glasses app (even-stats) via Even Hub
1. You have the Even Hub dev account + CLI. From `glasses/`:
   ```bash
   cd /Users/shovansmini/codes/evenRealties/macCompanion/glasses
   npm install
   npm run build       # produces the WebView bundle
   ```
   (Use the Even Hub CLI / simulator per their docs to load `main.ts` / the built bundle — `npm run dev` for the simulator.)
2. The app reads two values from Even Hub local storage: **`relayUrl`** = `wss://<your-service>.onrender.com` and **`relayToken`** = your secret. Set these via the Even Hub app/local storage (or temporarily hardcode `DEFAULT_RELAY_WSS_URL` in `glasses/src/main.ts` for a first test).
3. Launch it on the glasses. You should see the top-bar clock immediately and the dashboard fill in within ~1s. Use the **Even Ring** to scroll screens: Vitals → Net/Proc → Ports → Reminders. On the Reminders screen, **click** completes the selected reminder (flows back through the relay to the Mac).

### 4. End-to-end smoke test
- Mac Settings shows "connected"; glasses top-bar dot is live (not `⟂stale`).
- CPU/RAM/disk numbers update each second.
- Add a reminder from the Mac Reminders menu → it appears on the glasses Reminders screen.
- Ring-click it on the glasses → it gets completed in Apple Reminders.

---

## Known limitations / v2 backlog (intentionally deferred)
- **Notes integration** and **terminal logs** — out of v1 scope (you dropped terminal logs).
- **Reminder selection on glasses** — v1 click completes the top reminder (`selectedIndex` fixed at 0); moving the selection with the Ring is a `// TODO v2`.
- **Sparkline graphs** (CPU/RAM history as images) — designed-for but deferred.
- **SSD wear %** — `ssdWearPct` is best-effort and usually `null` on Apple Silicon internal drives; SMART health string is shown instead.
- **Token in UserDefaults** (Mac) — fine for personal use; Keychain is a v2 hardening.
- **App icon** for the Mac app — placeholder; drop a real `AppIcon` when bundling.
- **Relay free-tier sleep** — see step 1.4.

## Handy commands
```bash
# run everything's tests
(cd relay && npm test) && (cd glasses && npm test) && (cd mac && swift test)
# relay locally (dev, no auth): PORT=8080 npm --prefix relay run dev
```
