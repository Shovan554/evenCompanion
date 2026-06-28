import { createRelayServer, type RelayServer } from './server'

export async function main(env: NodeJS.ProcessEnv): Promise<RelayServer> {
  const rawPort = env.PORT ?? ''
  const port = rawPort === '' ? 8080 : Number(rawPort)
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${env.PORT}`)
  }
  const authToken = env.RELAY_TOKEN || undefined
  if (env.NODE_ENV === 'production' && !authToken) {
    throw new Error('RELAY_TOKEN must be set in production (the token is the relay\'s only security boundary)')
  }
  const server = await createRelayServer({ authToken }).listen(port)
  console.log(`relay listening on :${server.port} (auth ${authToken ? 'on' : 'off'})`)
  return server
}

// Auto-start only when executed directly (not when imported by tests).
const invokedDirectly =
  typeof process.argv[1] === 'string' && import.meta.url === `file://${process.argv[1]}`
if (invokedDirectly) {
  void main(process.env)
}
