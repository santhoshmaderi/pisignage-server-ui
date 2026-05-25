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
  currentPlaylist?: string
  isConnected: boolean
  version?: string
  labels?: string[]
  licensed?: boolean
  lastReported?: string
  createdAt?: string
}

import { api } from './api'
import { unwrapArray } from './envelope'

export async function fetchPlayers(): Promise<Player[]> {
  const res = await api.get('/players')
  return unwrapArray<Player>(res.data)
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

/** Run a shell command on the player. The result returns via socket `shell_ack`. */
export async function runShell(playerId: string, command: string) {
  await api.post(`/pishell/${encodeURIComponent(playerId)}`, { cmd: command })
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
