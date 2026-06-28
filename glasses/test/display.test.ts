import { describe, it, expect } from 'vitest'
import { MockDisplay } from '../src/display.js'

describe('MockDisplay', () => {
  it('records init line counts', () => {
    const d = new MockDisplay()
    d.init(4)
    d.init(8)
    expect(d.inits).toEqual([4, 8])
  })

  it('records setLines calls as independent copies', () => {
    const d = new MockDisplay()
    const lines = ['Line A', 'Line B']
    d.setLines(lines)
    // Mutate the original array after the call
    lines[0] = 'MUTATED'
    // The recorded copy should be unchanged
    expect(d.setCalls[0]).toEqual(['Line A', 'Line B'])
  })

  it('setCalls stores each setLines call as a separate entry', () => {
    const d = new MockDisplay()
    d.setLines(['first'])
    d.setLines(['second', 'third'])
    expect(d.setCalls.length).toBe(2)
    expect(d.setCalls[0]).toEqual(['first'])
    expect(d.setCalls[1]).toEqual(['second', 'third'])
  })

  it('lastLines reflects the most recent setLines call', () => {
    const d = new MockDisplay()
    expect(d.lastLines).toBeNull()
    d.setLines(['hello'])
    expect(d.lastLines).toEqual(['hello'])
    d.setLines(['world'])
    expect(d.lastLines).toEqual(['world'])
  })

  it('lastLines is an independent copy — mutating input does not affect it', () => {
    const d = new MockDisplay()
    const lines = ['A', 'B']
    d.setLines(lines)
    lines[0] = 'Z'
    expect(d.lastLines).toEqual(['A', 'B'])
  })

  it('records shutdown calls', () => {
    const d = new MockDisplay()
    expect(d.shutdowns).toBe(0)
    d.shutdown()
    expect(d.shutdowns).toBe(1)
    d.shutdown()
    expect(d.shutdowns).toBe(2)
  })

  it('starts with empty inits and setCalls arrays and shutdowns=0', () => {
    const d = new MockDisplay()
    expect(d.inits).toEqual([])
    expect(d.setCalls).toEqual([])
    expect(d.shutdowns).toBe(0)
    expect(d.lastLines).toBeNull()
  })
})
