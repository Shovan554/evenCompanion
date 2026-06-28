/**
 * relayClient.ts — reconnecting subscriber WebSocket client.
 * Uses injectable SocketFactory and scheduleReconnect so tests are deterministic.
 */

export interface SocketLike {
  send(data: string): void
  close(): void
  onopen: (() => void) | null
  onclose: (() => void) | null
  onerror: (() => void) | null
  onmessage: ((ev: { data: any }) => void) | null
}

export type SocketFactory = (url: string) => SocketLike

export interface RelayClientOptions {
  /** Base URL, e.g. wss://host — NO path/query. Client appends /ws?token=&role=sub */
  url: string
  token: string
  onSnapshot: (raw: string) => void
  onStatusChange?: (s: 'connected' | 'disconnected') => void
  /** Defaults to a wrapper over global WebSocket */
  socketFactory?: SocketFactory
  /** Injectable scheduler; default uses setTimeout with exponential backoff */
  scheduleReconnect?: (fn: () => void, attempt: number) => void
}

const defaultSocketFactory: SocketFactory = (url: string): SocketLike => {
  // In a browser WebView, the global WebSocket is available
  const ws = new WebSocket(url)
  return ws as unknown as SocketLike
}

const defaultScheduleReconnect = (fn: () => void, attempt: number): void => {
  const delay = Math.min(10_000, 100 * 2 ** attempt)
  setTimeout(fn, delay)
}

export class RelayClient {
  private readonly url: string
  private readonly token: string
  private readonly onSnapshot: (raw: string) => void
  private readonly onStatusChange: ((s: 'connected' | 'disconnected') => void) | undefined
  private readonly socketFactory: SocketFactory
  private readonly scheduleReconnect: (fn: () => void, attempt: number) => void

  private socket: SocketLike | null = null
  private isOpen = false
  private closed = false
  private attempt = 0

  constructor(opts: RelayClientOptions) {
    this.url = opts.url
    this.token = opts.token
    this.onSnapshot = opts.onSnapshot
    this.onStatusChange = opts.onStatusChange
    this.socketFactory = opts.socketFactory ?? defaultSocketFactory
    this.scheduleReconnect = opts.scheduleReconnect ?? defaultScheduleReconnect
  }

  connect(): void {
    const fullUrl = `${this.url}/ws?token=${encodeURIComponent(this.token)}&role=sub`
    const socket = this.socketFactory(fullUrl)
    this.socket = socket
    this.isOpen = false

    // Guard: ensure onerror + onclose for the same socket only trigger once.
    let disconnected = false

    socket.onopen = () => {
      this.isOpen = true
      this.attempt = 0
      this.onStatusChange?.('connected')
    }

    socket.onmessage = (ev: { data: any }) => {
      this.onSnapshot(String(ev.data))
    }

    const handleDisconnect = () => {
      if (disconnected) return
      disconnected = true
      this.isOpen = false
      this.onStatusChange?.('disconnected')
      if (!this.closed) {
        const currentAttempt = this.attempt
        this.attempt++
        this.scheduleReconnect(() => {
          if (!this.closed) {
            this.connect()
          }
        }, currentAttempt)
      }
    }

    socket.onclose = handleDisconnect
    socket.onerror = handleDisconnect
  }

  /** JSON-stringify obj and send if the socket is currently open; otherwise drop silently. */
  send(obj: object): void {
    if (this.isOpen && this.socket) {
      this.socket.send(JSON.stringify(obj))
    }
  }

  /** Stop reconnection and close the current socket. */
  close(): void {
    this.closed = true
    this.socket?.close()
  }
}
