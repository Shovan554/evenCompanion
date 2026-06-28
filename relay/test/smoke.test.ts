import { describe, it, expect } from 'vitest'
import { RELAY_NAME } from '../src/version'

describe('toolchain', () => {
  it('imports source modules', () => {
    expect(RELAY_NAME).toBe('maccompanion-relay')
  })
})
