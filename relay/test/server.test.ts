import { describe, it, expect, afterEach } from 'vitest'
import { WebSocket } from 'ws'
import { createRelayServer, type RelayServer } from '../src/server'

let server: RelayServer | undefined
afterEach(async () => {
  await server?.close()
  server = undefined
})

function connect(port: number, role: string, token = 't1'): Promise<WebSocket> {
  const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}&role=${role}`)
  return new Promise((resolve, reject) => {
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
  })
}

function nextMessage(ws: WebSocket): Promise<string> {
  return new Promise((resolve) => ws.once('message', (d) => resolve(d.toString())))
}

describe('relay server', () => {
  it('serves /healthz', async () => {
    server = await createRelayServer().listen(0)
    const res = await fetch(`http://localhost:${server.port}/healthz`)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
  })

  it('returns 404 for unknown routes', async () => {
    server = await createRelayServer().listen(0)
    const res = await fetch(`http://localhost:${server.port}/nope`)
    expect(res.status).toBe(404)
  })

  it('forwards a publisher snapshot to a subscriber', async () => {
    server = await createRelayServer().listen(0)
    const sub = await connect(server.port, 'sub')
    await connect(server.port, 'pub').then((pub) => {
      const got = nextMessage(sub)
      pub.send(JSON.stringify({ cpu: 12 }))
      return got
    }).then((raw) => {
      expect(JSON.parse(raw)).toEqual({ cpu: 12 })
    })
  })

  it('rejects a wrong token with close code 1008 when authToken is set', async () => {
    server = await createRelayServer({ authToken: 'secret' }).listen(0)
    const ws = new WebSocket(`ws://localhost:${server.port}/ws?token=wrong&role=sub`)
    const code = await new Promise<number>((resolve) => ws.on('close', (c) => resolve(c)))
    expect(code).toBe(1008)
  })

  it('rejects a missing/invalid role with close code 1008', async () => {
    server = await createRelayServer().listen(0)
    const ws = new WebSocket(`ws://localhost:${server.port}/ws?token=t1&role=bogus`)
    const code = await new Promise<number>((resolve) => ws.on('close', (c) => resolve(c)))
    expect(code).toBe(1008)
  })
})
