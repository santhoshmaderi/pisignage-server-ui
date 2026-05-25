import { useEffect, useRef, useState } from 'react'
import io from 'socket.io-client'

type ManagerSocket = ReturnType<typeof io>

/**
 * Subscribe to player status events from the pisignage-server.
 *
 * The server runs socket.io v2.4 at /newsocket.io (see
 * pisignage-server/server.js — the v0.9 path /socket.io is for legacy hardware).
 * Players emit `status` updates we can use to live-update the dashboard.
 *
 * Auth: pisignage-server uses HTTP Basic Auth on the upgrade handshake too.
 * We forward credentials via the `query` param; the server checks them in
 * its socket.io authorization handler.
 */
export type PlayerStatusEvent = {
  cpuSerialNumber?: string
  name?: string
  isConnected?: boolean
  currentPlaylist?: string
  myIpAddress?: string
  [key: string]: unknown
}

export function usePlayerStatusSocket(authHeader: string | null) {
  const [connected, setConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<PlayerStatusEvent | null>(null)
  const socketRef = useRef<ManagerSocket | null>(null)

  useEffect(() => {
    if (!authHeader) return

    const socket = io('/', {
      path: '/newsocket.io',
      transports: ['websocket', 'polling'],
      query: { auth: authHeader },
    })
    socketRef.current = socket

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('status', (payload: PlayerStatusEvent) => setLastEvent(payload))

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
    }
  }, [authHeader])

  return { connected, lastEvent, socket: socketRef.current }
}
