/**
 * Player shape returned by GET /api/players.
 *
 * Field set distilled from pisignage-server/app/models/player.js — the
 * server response wraps `data: [...]` around the array, so consumers should
 * use `fetchPlayers()` which unwraps it.
 */
export type Player = {
  _id: string
  name: string
  group?: { _id?: string; name?: string } | string
  cpuSerialNumber: string
  myIpAddress?: string
  ip?: string
  currentPlaylist?: string
  isConnected: boolean
  syncInProgress?: boolean
  version?: string
  platform_version?: string
  ethMac?: string
  wifiMac?: string
  uptime?: string
  piTemperature?: string
  diskSpaceUsed?: string
  diskSpaceAvailable?: string
  tvStatus?: boolean
  labels?: string[]
  licensed?: boolean
  lastReported?: string
  createdAt?: string
}

/** Shell command result returned by the player (via POST /api/pishell). */
export type ShellResult = { err?: string; stdout?: string; stderr?: string }

import { api } from './api'
import { assertSuccess, unwrapArray } from './envelope'

export async function fetchPlayers(): Promise<Player[]> {
  const res = await api.get('/players')
  return unwrapArray<Player>(res.data)
}

/**
 * Update a player record. The server (POST /api/players/:id) merges the patch
 * and re-pushes config to the device. Use `{ name }` to rename and
 * `{ group: { _id, name } }` to move the player to another group.
 */
export async function updatePlayer(playerId: string, patch: Partial<Player>): Promise<void> {
  const res = await api.post(`/players/${encodeURIComponent(playerId)}`, patch)
  assertSuccess(res.data, 'Failed to update player')
}

/** Resolve a Player.group field (either populated object or raw ObjectId string) to a name. */
export function playerGroupName(player: Player, groupNameById?: Map<string, string>): string {
  const g = player.group
  if (!g) return 'Default'
  if (typeof g === 'string') return groupNameById?.get(g) ?? 'Default'
  return g.name ?? (g._id && groupNameById?.get(g._id)) ?? 'Default'
}

export function playerGroupId(player: Player): string | null {
  const g = player.group
  if (!g) return null
  if (typeof g === 'string') return g
  return g._id ?? null
}

// --- mutations ---

/** Trigger an out-of-band screenshot. Player pushes the result via socket. */
export async function requestSnapshot(playerId: string) {
  await api.post(`/snapshot/${encodeURIComponent(playerId)}`)
}

/**
 * Run a shell command on the player and return its output.
 *
 * The server holds the HTTP response open until the player replies over its
 * socket (server-side `shellAck`), then returns `{ data: { err, stdout, stderr } }`
 * — or `{ data: { err: 'Request Timeout…' } }` after 60s if the player is offline.
 */
export async function runShell(playerId: string, command: string): Promise<ShellResult> {
  const res = await api.post(`/pishell/${encodeURIComponent(playerId)}`, { cmd: command })
  const d = ((res.data as { data?: unknown })?.data ?? {}) as Record<string, unknown>

  // On a non-zero exit the player sends the Node exec error OBJECT as `err`
  // (e.g. { code, killed, signal, cmd, stdout, stderr }). Coerce everything to
  // strings so callers/React never receive an object, and lift the error
  // object's streams up so real output still shows.
  const errObj = d.err && typeof d.err === 'object' ? (d.err as Record<string, unknown>) : null
  const err = errObj
    ? `Command failed${errObj.code != null ? ` (exit ${asText(errObj.code)})` : ''}`
    : asText(d.err)
  return {
    err: err || undefined,
    stdout: asText(d.stdout) || asText(errObj?.stdout) || undefined,
    stderr: asText(d.stderr) || asText(errObj?.stderr) || undefined,
  }
}

/** Coerce any value (string, object, number, null) to a displayable string. */
function asText(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v, null, 2)
    } catch {
      return String(v)
    }
  }
  return String(v)
}

/**
 * Turn the player's TV/display on or off via CEC. The server's tvPower handler
 * sends `{ off: status }` to the player, so `off=false` powers the TV ON and
 * `off=true` powers it OFF. Takes ~10s to take effect on the device.
 */
export async function setTvPower(playerId: string, off: boolean) {
  await api.post(`/pitv/${encodeURIComponent(playerId)}`, { status: off })
}

/** Trigger pisignage-player firmware/software update. */
export async function triggerUpdate(playerId: string) {
  await api.post(`/swupdate/${encodeURIComponent(playerId)}`)
}

/** Switch the player to a different playlist by name. */
export async function setPlaylist(playerId: string, playlistName: string) {
  await api.post(
    `/setplaylist/${encodeURIComponent(playerId)}/${encodeURIComponent(playlistName)}`,
  )
}

/** Delete a player record. Does not unpair the device itself. */
export async function deletePlayer(playerId: string) {
  await api.delete(`/players/${encodeURIComponent(playerId)}`)
}

export type PlayerCounts = {
  total: number
  online: number
  offline: number
}

export function countPlayers(players: Player[] | unknown): PlayerCounts {
  if (!Array.isArray(players)) return { total: 0, online: 0, offline: 0 }
  const total = players.length
  const online = players.filter((p) => p.isConnected).length
  return { total, online, offline: total - online }
}
