import { createServer, type IncomingMessage, type Server } from 'node:http'
import { createHash } from 'node:crypto'
import { WebSocketServer, type WebSocket } from 'ws'
import { Hub, type Role } from './hub'
import { RELAY_NAME, RELAY_BUILD } from './version'

export interface RelayServer {
  port: number
  close(): Promise<void>
}

export function createRelayServer(opts: { authToken?: string } = {}) {
  const hub = new Hub()

  const http: Server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.end('ok')
      return
    }
    if (req.method === 'GET' && req.url === '/version') {
      res.writeHead(200, { 'content-type': 'application/json' })
      const tokenHash = opts.authToken
        ? createHash('sha256').update(opts.authToken).digest('hex').slice(0, 12)
        : null
      res.end(JSON.stringify({
        name: RELAY_NAME,
        build: RELAY_BUILD,
        auth: Boolean(opts.authToken),
        tokenLen: opts.authToken ? opts.authToken.length : 0,
        tokenHash,
      }))
      return
    }
    res.writeHead(404)
    res.end()
  })

  // perMessageDeflate disabled: compressed server->client frames can be dropped
  // by CDN/proxy layers (e.g. Render/Cloudflare), which silently breaks fan-out.
  // Payloads are small JSON snapshots, so compression isn't worth the risk.
  const wss = new WebSocketServer({ server: http, path: '/ws', perMessageDeflate: false })

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? '', 'http://localhost')
    const token = url.searchParams.get('token') ?? ''
    const role = url.searchParams.get('role')

    const authorized =
      token.length > 0 &&
      (role === 'pub' || role === 'sub') &&
      (!opts.authToken || token === opts.authToken)

    if (!authorized) {
      ws.close(1008, 'unauthorized')
      return
    }

    const id = hub.addClient(token, role as Role, (data) => {
      if (ws.readyState === ws.OPEN) ws.send(data)
    })
    let removed = false
    const remove = () => {
      if (removed) return
      removed = true
      hub.removeClient(id)
    }
    ws.on('message', (data) => hub.handleMessage(id, data.toString()))
    ws.on('close', remove)
    ws.on('error', remove)
  })

  return {
    listen(port: number): Promise<RelayServer> {
      return new Promise((resolve) => {
        http.listen(port, () => {
          const addr = http.address()
          const actualPort = typeof addr === 'object' && addr ? addr.port : port
          resolve({
            port: actualPort,
            close: async () => {
              // Force close all WebSocket connections
              for (const client of wss.clients) {
                client.close()
              }
              // Close the WebSocket server
              await new Promise<void>((res) => wss.close(() => res()))
              // Close the HTTP server
              await new Promise<void>((res) => http.close(() => res()))
            },
          })
        })
      })
    },
  }
}
