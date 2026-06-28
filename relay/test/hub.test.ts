import { describe, it, expect } from 'vitest'
import { Hub } from '../src/hub'

// Deterministic id factory for tests.
function counter() {
  let n = 0
  return () => `c${++n}`
}

describe('Hub pub/sub', () => {
  it('delivers the latest snapshot to a subscriber that joins after a publish', () => {
    const hub = new Hub(counter())
    const pub = hub.addClient('t', 'pub', () => {})
    hub.handleMessage(pub, JSON.stringify({ cpu: 10 }))

    const received: string[] = []
    hub.addClient('t', 'sub', (d) => received.push(d))

    expect(received).toEqual([JSON.stringify({ cpu: 10 })])
    expect(hub.latestSnapshot('t')).toBe(JSON.stringify({ cpu: 10 }))
  })

  it('broadcasts a publisher frame to subscribers but not back to the publisher', () => {
    const hub = new Hub(counter())
    const pubGot: string[] = []
    const subGot: string[] = []
    const pub = hub.addClient('t', 'pub', (d) => pubGot.push(d))
    hub.addClient('t', 'sub', (d) => subGot.push(d))

    hub.handleMessage(pub, JSON.stringify({ ram: 8 }))

    expect(subGot).toEqual([JSON.stringify({ ram: 8 })])
    expect(pubGot).toEqual([])
  })

  it('isolates rooms by token', () => {
    const hub = new Hub(counter())
    const a: string[] = []
    const b: string[] = []
    const pubA = hub.addClient('tokenA', 'pub', () => {})
    hub.addClient('tokenA', 'sub', (d) => a.push(d))
    hub.addClient('tokenB', 'sub', (d) => b.push(d))

    hub.handleMessage(pubA, JSON.stringify({ x: 1 }))

    expect(a).toEqual([JSON.stringify({ x: 1 })])
    expect(b).toEqual([])
    expect(hub.roomCount()).toBe(2)
  })
})

describe('Hub reverse channel and lifecycle', () => {
  it('forwards a subscriber frame to publishers, not to other subscribers', () => {
    const hub = new Hub(counter())
    const pubGot: string[] = []
    const sub2Got: string[] = []
    hub.addClient('t', 'pub', (d) => pubGot.push(d))
    const sub1 = hub.addClient('t', 'sub', () => {})
    hub.addClient('t', 'sub', (d) => sub2Got.push(d))

    hub.handleMessage(sub1, JSON.stringify({ cmd: 'completeReminder', id: 'x1' }))

    expect(pubGot).toEqual([JSON.stringify({ cmd: 'completeReminder', id: 'x1' })])
    expect(sub2Got).toEqual([])
  })

  it('drops malformed (non-JSON) frames without storing or forwarding', () => {
    const hub = new Hub(counter())
    const subGot: string[] = []
    const pub = hub.addClient('t', 'pub', () => {})
    hub.addClient('t', 'sub', (d) => subGot.push(d))

    hub.handleMessage(pub, 'not json {{{')

    expect(subGot).toEqual([])
    expect(hub.latestSnapshot('t')).toBeUndefined()
  })

  it('evicts the room once its last client leaves', () => {
    const hub = new Hub(counter())
    const pub = hub.addClient('t', 'pub', () => {})
    const sub = hub.addClient('t', 'sub', () => {})
    hub.handleMessage(pub, JSON.stringify({ cpu: 1 }))

    hub.removeClient(pub)
    expect(hub.roomCount()).toBe(1)
    hub.removeClient(sub)
    expect(hub.roomCount()).toBe(0)
    expect(hub.latestSnapshot('t')).toBeUndefined()
  })
})
