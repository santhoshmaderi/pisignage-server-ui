import { api } from './api'
import { unwrapArray, unwrapObject } from './envelope'

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

/**
 * Field names mirror the server's Mongoose schema (app/models/settings.js) exactly
 * so the POST round-trips cleanly.
 */
export type Settings = {
  /** "username at pisignage.com". Changing it triggers a server restart. */
  installation?: string
  /** Download-access credentials — also the HTTP Basic creds for this console. */
  authCredentials?: AuthCredentials
  language?: string
  defaultDuration?: number
  /** Filename of the uploaded logo, served from /media/ by the server. */
  logo?: string
  url?: string
  sshPassword?: string
  reportIntervalMinutes?: number
  /** youtube-dl for livestreaming instead of livestreamer. */
  enableYoutubeDl?: boolean
  /** Keep TV on via CEC tv-on/off message every 3 minutes. */
  forceTvOn?: boolean
  /** Disable CEC power check of TV every 3 minutes. */
  disableCECPowerCheck?: boolean
  /** Hide system messages on TV screen (e.g. "Download in Progress"). */
  systemMessagesHide?: boolean
  /** Skip the startup welcome screen & network diagnostics. */
  hideWelcomeNotice?: boolean
  /** Enable per-file play-count logging (network intensive). */
  enableLog?: boolean
  newLayoutsEnable?: boolean
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

/**
 * License files registered on the server.
 *
 *   GET    /api/licensefiles            — array of .txt filenames
 *   POST   /api/licensefiles            — multipart upload, field name "assets"
 *   DELETE /api/licensefiles/:filename  — returns the remaining filenames
 */
export async function fetchLicenses(): Promise<string[]> {
  const res = await api.get('/licensefiles')
  return unwrapArray<string>(res.data)
}

export async function uploadLicenses(files: File[]): Promise<void> {
  const form = new FormData()
  for (const f of files) form.append('assets', f, f.name)
  await api.post('/licensefiles', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export async function deleteLicense(filename: string): Promise<string[]> {
  const res = await api.delete(`/licensefiles/${encodeURIComponent(filename)}`)
  return unwrapArray<string>(res.data)
}
