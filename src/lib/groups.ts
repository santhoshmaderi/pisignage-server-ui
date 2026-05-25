import { api } from './api'
import { unwrapArray, unwrapObject } from './envelope'

/**
 * Group records from /api/groups carry a mix of string and object references.
 * `assets` / `deployedAssets` are filename strings, but `playlists` /
 * `deployedPlaylists` are objects with at least `{ name, plType, settings }`
 * (older docs may store them as bare strings). Use `playlistRefName()` to
 * read a stable display name regardless of shape.
 */
export type PlaylistRef = string | { name?: string; plType?: string; [k: string]: unknown }

export type Group = {
  _id: string
  name: string
  playlists?: PlaylistRef[]
  playlistToSchedule?: PlaylistRef
  assets?: string[]
  deployedPlaylists?: PlaylistRef[]
  deployedAssets?: string[]
  defaultCustomTemplate?: string
  enableMpv?: boolean
  orientation?: string
  resolution?: string
  signageBackgroundColor?: string
  showClock?: boolean | { enable?: boolean; format?: string; position?: string }
  sleep?: { ontime?: string; offtime?: string; enable?: boolean }
  reboot?: { hours?: number; minutes?: number; enable?: boolean }
  description?: string
  logo?: string
  lastDeployed?: string
  createdAt?: string
  updatedAt?: string
}

export function playlistRefName(ref: PlaylistRef | undefined): string {
  if (!ref) return ''
  if (typeof ref === 'string') return ref
  return ref.name ?? ''
}

export async function fetchGroups(): Promise<Group[]> {
  const res = await api.get('/groups')
  return unwrapArray<Group>(res.data)
}

export async function createGroup(name: string): Promise<Group> {
  const res = await api.post('/groups', { name })
  return unwrapObject<Group>(res.data, { _id: '', name } as Group)
}

export async function updateGroup(id: string, patch: Partial<Group>): Promise<Group> {
  const res = await api.put(`/groups/${encodeURIComponent(id)}`, patch)
  return unwrapObject<Group>(res.data, patch as Group)
}

export async function deleteGroup(id: string): Promise<void> {
  await api.delete(`/groups/${encodeURIComponent(id)}`)
}
