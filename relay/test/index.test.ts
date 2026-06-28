import { describe, it, expect, afterEach } from 'vitest'
import { main } from '../src/index'
import type { RelayServer } from '../src/server'

let server: RelayServer | undefined
afterEach(async () => {
  await server?.close()
  server = undefined
})

describe('main', () => {
  it('starts a server on the given PORT and serves health', async () => {
    server = await main({ PORT: '0' } as NodeJS.ProcessEnv)
    const res = await fetch(`http://localhost:${server.port}/healthz`)
    expect(await res.text()).toBe('ok')
  })
})
