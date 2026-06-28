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
