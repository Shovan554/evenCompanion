import { randomUUID } from 'node:crypto'

export type Role = 'pub' | 'sub'
export type SendFn = (data: string) => void

interface Client {
  role: Role
  send: SendFn
}

interface Room {
  latest?: string
  clients: Map<string, Client>
}

export class Hub {
  private rooms = new Map<string, Room>()

  constructor(private idFactory: () => string = randomUUID, private maxFrameBytes = 256 * 1024) {}

  addClient(token: string, role: Role, send: SendFn): string {
    const id = this.idFactory()
    let room = this.rooms.get(token)
    if (!room) {
      room = { clients: new Map() }
      this.rooms.set(token, room)
    }
    room.clients.set(id, { role, send })
    if (role === 'sub' && room.latest !== undefined) {
      send(room.latest)
    }
    return id
  }

  handleMessage(clientId: string, raw: string): void {
    const found = this.findClient(clientId)
    if (!found) return
    if (Buffer.byteLength(raw, 'utf8') > this.maxFrameBytes) return
    if (!isValidJson(raw)) return // drop malformed frames
    const { room, client } = found
    if (client.role === 'pub') {
      room.latest = raw
      for (const c of room.clients.values()) {
        if (c.role === 'sub') c.send(raw)
      }
    } else {
      for (const c of room.clients.values()) {
        if (c.role === 'pub') c.send(raw)
      }
    }
  }

  latestSnapshot(token: string): string | undefined {
    return this.rooms.get(token)?.latest
  }

  roomCount(): number {
    return this.rooms.size
  }

  removeClient(clientId: string): void {
    for (const [token, room] of this.rooms) {
      if (room.clients.delete(clientId)) {
        if (room.clients.size === 0) this.rooms.delete(token)
        return
      }
    }
  }

  protected findClient(clientId: string): { room: Room; client: Client } | undefined {
    for (const room of this.rooms.values()) {
      const client = room.clients.get(clientId)
      if (client) return { room, client }
    }
    return undefined
  }

}

function isValidJson(raw: string): boolean {
  try {
    JSON.parse(raw)
    return true
  } catch {
    return false
  }
}
