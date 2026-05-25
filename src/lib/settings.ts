import { api } from './api'
import { unwrapObject } from './envelope'

/**
 * Global server settings (pisignage stores a single document).
 *
 * Endpoints:
 *   GET  /api/settings        — current configuration (auth creds included)
 *   POST /api/settings        — overwrite. Body is a partial; missing keys are kept.
 *   GET  /api/serverconfig    — read-only system info (IP, git version, installation id)
 */
export type AuthCredentials = {
  user?: string
  password?: string
}

export type Settings = {
  installation?: string
  authCredentials?: AuthCredentials
  language?: string
  defaultDuration?: number
  /** Filename of the uploaded logo, served from /media/ by the server. */
  logo?: string
  sshPassword?: string
  reportIntervalMinutes?: number
  enableYoutubeDl?: boolean
  hideWelcomeNotice?: boolean
  /** Some installs include this — we expose it but don't force it. */
  serverName?: string
}

export type ServerInfo = {
  ip?: string
  serverIp?: string
  gitVersion?: string
  installation?: string
  serverName?: string
  /** Anything else the endpoint hands us is surfaced as-is. */
  [key: string]: unknown
}

export async function fetchSettings(): Promise<Settings> {
  const res = await api.get('/settings')
  return unwrapObject<Settings>(res.data, {} as Settings)
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const res = await api.post('/settings', patch)
  return unwrapObject<Settings>(res.data, patch as Settings)
}

export async function fetchServerInfo(): Promise<ServerInfo> {
  const res = await api.get('/serverconfig')
  return unwrapObject<ServerInfo>(res.data, {} as ServerInfo)
}
