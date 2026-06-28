import { describe, it, expect, vi } from 'vitest'
import { RelayClient, SocketLike } from '../src/relayClient.js'

// FakeSocket: a minimal SocketLike that lets tests fire events imperatively
class FakeSocket implements SocketLike {
  url: string
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((ev: { data: any }) => void) | null = null
  sent: string[] = []
  closed = false

  constructor(url: string) {
    this.url = url
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.closed = true
  }
}

function makeFactory(sockets: FakeSocket[]) {
  return (url: string): SocketLike => {
    const s = new FakeSocket(url)
    sockets.push(s)
    return s
  }
}

// Synchronous scheduleReconnect that immediately invokes fn
// and records the (fn, attempt) calls
function makeSyncScheduler(log: { attempt: number }[]) {
  return (fn: () => void, attempt: number) => {
    log.push({ attempt })
    fn()
  }
}

describe('RelayClient', () => {
  it('connects to the exact URL with token and role=sub', () => {
    const sockets: FakeSocket[] = []
    const client = new RelayClient({
      url: 'wss://relay.example',
      token: 'secret',
      onSnapshot: () => {},
      socketFactory: makeFactory(sockets),
      scheduleReconnect: () => {}, // don't auto-reconnect in this test
    })
    client.connect()
    expect(sockets.length).toBe(1)
    expect(sockets[0].url).toBe('wss://relay.example/ws?token=secret&role=sub')
  })

  it('URL-encodes special characters in the token', () => {
    const sockets: FakeSocket[] = []
    const client = new RelayClient({
      url: 'wss://relay.example',
      token: 'tok en+val=x&y',
      onSnapshot: () => {},
      socketFactory: makeFactory(sockets),
      scheduleReconnect: () => {},
    })
    client.connect()
    const expectedToken = encodeURIComponent('tok en+val=x&y')
    expect(sockets[0].url).toBe(`wss://relay.example/ws?token=${expectedToken}&role=sub`)
  })

  it('forwards onmessage data to onSnapshot', () => {
    const sockets: FakeSocket[] = []
    const snapshots: string[] = []
    const client = new RelayClient({
      url: 'wss://relay.example',
      token: 'secret',
      onSnapshot: (raw) => snapshots.push(raw),
      socketFactory: makeFactory(sockets),
      scheduleReconnect: () => {},
    })
    client.connect()
    sockets[0].onopen?.()
    sockets[0].onmessage?.({ data: '{"hello":"world"}' })
    expect(snapshots).toEqual(['{"hello":"world"}'])
  })

  it('converts non-string data to string before passing to onSnapshot', () => {
    const sockets: FakeSocket[] = []
    const snapshots: string[] = []
    const client = new RelayClient({
      url: 'wss://relay.example',
      token: 'secret',
      onSnapshot: (raw) => snapshots.push(raw),
      socketFactory: makeFactory(sockets),
      scheduleReconnect: () => {},
    })
    client.connect()
    sockets[0].onopen?.()
    sockets[0].onmessage?.({ data: 42 })
    expect(snapshots).toEqual(['42'])
  })

  it('fires onStatusChange("connected") on open', () => {
    const sockets: FakeSocket[] = []
    const statuses: string[] = []
    const client = new RelayClient({
      url: 'wss://relay.example',
      token: 'secret',
      onSnapshot: () => {},
      onStatusChange: (s) => statuses.push(s),
      socketFactory: makeFactory(sockets),
      scheduleReconnect: () => {},
    })
    client.connect()
    sockets[0].onopen?.()
    expect(statuses).toEqual(['connected'])
  })

  it('fires onStatusChange("disconnected") on close', () => {
    const sockets: FakeSocket[] = []
    const statuses: string[] = []
    const client = new RelayClient({
      url: 'wss://relay.example',
      token: 'secret',
      onSnapshot: () => {},
      onStatusChange: (s) => statuses.push(s),
      socketFactory: makeFactory(sockets),
      scheduleReconnect: () => {},
    })
    client.connect()
    sockets[0].onopen?.()
    sockets[0].onclose?.()
    expect(statuses).toContain('disconnected')
  })

  it('fires onStatusChange("disconnected") on error', () => {
    const sockets: FakeSocket[] = []
    const statuses: string[] = []
    const client = new RelayClient({
      url: 'wss://relay.example',
      token: 'secret',
      onSnapshot: () => {},
      onStatusChange: (s) => statuses.push(s),
      socketFactory: makeFactory(sockets),
      scheduleReconnect: () => {},
    })
    client.connect()
    sockets[0].onerror?.()
    expect(statuses).toContain('disconnected')
  })

  it('reconnects after a close — factory is called again', () => {
    const sockets: FakeSocket[] = []
    const reconnectLog: { attempt: number }[] = []
    const client = new RelayClient({
      url: 'wss://relay.example',
      token: 'secret',
      onSnapshot: () => {},
      socketFactory: makeFactory(sockets),
      scheduleReconnect: makeSyncScheduler(reconnectLog),
    })
    client.connect()
    sockets[0].onopen?.()
    sockets[0].onclose?.()
    // After first close, reconnect should have fired → factory called a second time
    expect(sockets.length).toBe(2)
  })

  it('backoff attempt increments on repeated closes — delays 100, 200, 400...', () => {
    const sockets: FakeSocket[] = []
    const reconnectLog: { attempt: number }[] = []
    const client = new RelayClient({
      url: 'wss://relay.example',
      token: 'secret',
      onSnapshot: () => {},
      socketFactory: makeFactory(sockets),
      scheduleReconnect: makeSyncScheduler(reconnectLog),
    })
    client.connect()
    // First close → attempt 0 → delay 100 * 2^0 = 100
    sockets[0].onclose?.()
    // Second close (on reconnected socket) → attempt 1 → delay 100 * 2^1 = 200
    sockets[1].onclose?.()
    // Third close → attempt 2 → delay 100 * 2^2 = 400
    sockets[2].onclose?.()

    expect(reconnectLog.map((r) => r.attempt)).toEqual([0, 1, 2])
  })

  it('resets backoff attempt to 0 after a successful open', () => {
    const sockets: FakeSocket[] = []
    const reconnectLog: { attempt: number }[] = []
    const client = new RelayClient({
      url: 'wss://relay.example',
      token: 'secret',
      onSnapshot: () => {},
      socketFactory: makeFactory(sockets),
      scheduleReconnect: makeSyncScheduler(reconnectLog),
    })
    client.connect()
    // Close without opening → attempt 0
    sockets[0].onclose?.()
    // Now the reconnect opened socket[1]; fire open to reset backoff
    sockets[1].onopen?.()
    // Close again → attempt should be back to 0
    sockets[1].onclose?.()

    expect(reconnectLog[0].attempt).toBe(0)
    expect(reconnectLog[1].attempt).toBe(0)
  })

  it('send writes JSON string when socket is open', () => {
    const sockets: FakeSocket[] = []
    const client = new RelayClient({
      url: 'wss://relay.example',
      token: 'secret',
      onSnapshot: () => {},
      socketFactory: makeFactory(sockets),
      scheduleReconnect: () => {},
    })
    client.connect()
    sockets[0].onopen?.()
    client.send({ cmd: 'completeReminder', id: '42' })
    expect(sockets[0].sent).toEqual(['{"cmd":"completeReminder","id":"42"}'])
  })

  it('send drops silently when socket is not yet open', () => {
    const sockets: FakeSocket[] = []
    const client = new RelayClient({
      url: 'wss://relay.example',
      token: 'secret',
      onSnapshot: () => {},
      socketFactory: makeFactory(sockets),
      scheduleReconnect: () => {},
    })
    client.connect()
    // onopen not called — socket not "open" in our model
    client.send({ cmd: 'completeReminder', id: '1' })
    expect(sockets[0].sent).toEqual([])
  })

  it('after close(), a subsequent socket close does NOT reconnect', () => {
    const sockets: FakeSocket[] = []
    const reconnectLog: { attempt: number }[] = []
    const client = new RelayClient({
      url: 'wss://relay.example',
      token: 'secret',
      onSnapshot: () => {},
      socketFactory: makeFactory(sockets),
      scheduleReconnect: makeSyncScheduler(reconnectLog),
    })
    client.connect()
    sockets[0].onopen?.()
    // Caller closes the client
    client.close()
    // Socket fires onclose after being closed
    sockets[0].onclose?.()
    // No reconnect should have happened
    expect(sockets.length).toBe(1)
    expect(reconnectLog.length).toBe(0)
  })

  it('close() calls close() on the underlying socket', () => {
    const sockets: FakeSocket[] = []
    const client = new RelayClient({
      url: 'wss://relay.example',
      token: 'secret',
      onSnapshot: () => {},
      socketFactory: makeFactory(sockets),
      scheduleReconnect: () => {},
    })
    client.connect()
    client.close()
    expect(sockets[0].closed).toBe(true)
  })
})
