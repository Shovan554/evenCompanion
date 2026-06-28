# maccompanion-relay

Tiny WebSocket fan-out relay for the macCompanion glasses dashboard.

- Publisher (Mac app) connects: `wss://<host>/ws?token=<secret>&role=pub`
- Subscriber (glasses app) connects: `wss://<host>/ws?token=<secret>&role=sub`

The relay keeps the latest snapshot per token-room and forwards it to subscribers;
subscriber frames (commands) are forwarded to publishers. It validates that frames are
JSON but does not interpret their contents.

## Develop
- `npm install`
- `npm run dev`     # tsx watch on :8080 (override with PORT)
- `npm test`        # vitest
- `npm run build`   # tsup -> dist/index.js
- `npm start`       # node dist/index.js

## Environment
- `PORT` — listen port (Render injects this; default 8080).
- `RELAY_TOKEN` — if set, only this token is accepted; otherwise any token is a room.

## Security
The `token` is the relay's entire security boundary: knowing a room's token grants
read of its snapshots and the ability to send commands to its publisher. Use a long,
random token. In production (`NODE_ENV=production`) the server refuses to start unless
`RELAY_TOKEN` is set. Note: Render's free tier sleeps idle services; the Mac publisher's
persistent connection keeps it warm while running.
