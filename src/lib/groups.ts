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

/** Per-playlist schedule the server stores inside each group playlist entry. */
export type PlaylistSchedule = {
  durationEnable?: boolean
  startdate?: string
  enddate?: string
  timeEnable?: boolean
  starttime?: string
  endtime?: string
  weekdays?: number[]
  monthdays?: number[]
}

/**
 * A group's playlist entry. playlists[0] is the group's default playlist;
 * playlists[1..] are additional/scheduled playlists shown in the schedule table.
 */
export type GroupPlaylist = {
  name: string
  plType?: string
  settings?: PlaylistSchedule
}

/** Scrolling ticker shown along an edge of every player in the group. */
export type GroupTicker = {
  enable?: boolean
  /** Show asset-associated text. */
  bannerText?: boolean
  /** slide | scroll (left) | scrollRight | openvg_left | openvg_right (hardware). */
  behavior?: 'slide' | 'scroll' | 'scrollRight' | 'openvg_left' | 'openvg_right' | string
  /** Inline CSS (software modes only). */
  style?: string
  /** Hardware (openvg) modes only. */
  tickerFontSize?: string | number
  tickerWidth?: string | number
  tickerX?: string | number
  tickerY?: string | number
  /** 1 = slow, 2 = medium, 3 = full. */
  textSpeed?: '1' | '2' | '3' | number | string
  /** 60 | 100 | custom px. */
  tickerHeight?: string | number
  /** Newline-separated messages (used when RSS is off). */
  messages?: string
  rss?: {
    enable?: boolean
    link?: string | null
    feedDelay?: number
    encodeAsBinary?: boolean
    useDescription?: boolean
  }
}

/** High-priority overlay message shown on every player in the group. */
export type EmergencyMessage = {
  enable?: boolean
  msg?: string
  /** Horizontal position — old UI keeps this at 'middle' (control hidden). */
  hPos?: string
  vPos?: 'top' | 'middle' | 'bottom' | string
}

export type Group = {
  _id: string
  name: string
  playlists?: PlaylistRef[]
  playlistToSchedule?: PlaylistRef
  assets?: string[]
  deployedPlaylists?: PlaylistRef[]
  deployedAssets?: string[]
  defaultCustomTemplate?: string
  combineDefaultPlaylist?: boolean
  playAllEligiblePlaylists?: boolean
  alternateContent?: boolean
  shuffleContent?: boolean
  loadPlaylistOnCompletion?: boolean
  enableMpv?: boolean
  orientation?: string
  resolution?: string
  monitorArrangement?: { mode?: string; reverse?: boolean }
  animationEnable?: boolean
  animationType?: string | null
  signageBackgroundColor?: string
  omxVolume?: number
  logox?: string | number
  logoy?: string | number
  showClock?: boolean | { enable?: boolean; format?: string; position?: string }
  resizeAssets?: boolean
  imageLetterboxed?: boolean
  videoKeepAspect?: boolean
  urlReloadDisable?: boolean
  keepWeblinksInMemory?: boolean
  timeToStopVideo?: number
  sleep?: { ontime?: string; offtime?: string; enable?: boolean }
  reboot?: { hours?: number; minutes?: number; enable?: boolean; absoluteTime?: string }
  kioskUi?: { enable?: boolean; url?: string; timeout?: number }
  selectedVideoPlayer?: string
  mpvAudioDelay?: string
  disableAp?: boolean
  disableWebUi?: boolean
  disableWarnings?: boolean
  enablePio?: boolean
  ticker?: GroupTicker
  emergencyMessage?: EmergencyMessage
  description?: string
  logo?: string | null
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

/**
 * Deploy a group to its players.
 *
 * The server's updateObject honours a `deploy: true` flag: it copies the
 * group's `playlists`/`assets`/`ticker` into the `deployed*` fields, stamps
 * `lastDeployed`, and pushes the content to every player in the group (via the
 * player sockets). We send only the flag — updateObject merges it onto the
 * existing group, so no other fields are touched.
 */
export async function deployGroup(
  id: string,
  body: { assets?: string[]; playlists?: PlaylistRef[] } = {},
): Promise<Group> {
  const res = await api.put(`/groups/${encodeURIComponent(id)}`, { deploy: true, ...body })
  // The server's restware.sendError replies with HTTP 200 and { success: false,
  // stat_message } (e.g. "No Players associated"), so axios does NOT reject on a
  // failed deploy. Inspect the envelope and throw so callers see the failure.
  const env = res.data as { success?: boolean; stat_message?: string } | undefined
  if (env && env.success === false) {
    throw new Error(deployErrorMessage(env.stat_message))
  }
  return unwrapObject<Group>(res.data, { _id: id } as Group)
}

/** Behavior settings the deploy annotation reads off a source playlist. */
type PlaylistBehaviorSettings = {
  ads?: { adPlaylist?: unknown }
  domination?: { enable?: unknown }
  event?: { enable?: unknown }
  keyPress?: { enable?: unknown }
  onlineOnly?: unknown
  audio?: { enable?: unknown }
}

/** Minimal shape collectGroupAssets needs from a playlist (matches lib/playlists). */
type PlaylistLike = {
  name?: string
  assets?: Array<{ filename?: string }>
  templateName?: string
  settings?: PlaylistBehaviorSettings
}

/**
 * Expand a group's playlists into the flat list of files to sync to players.
 *
 * The server does NOT compute this — it syncs whatever `group.assets` holds — so
 * the client must build it before deploying, exactly like the old UI's
 * GroupFunctions.listFiles: every playlist asset's filename, the playlist's own
 * `__<name>.json` file, its template, the logo, and any nested-playlist assets.
 * Files starting with "_system" are excluded (player ships them). De-duplicated.
 */
export function collectGroupAssets(
  group: Pick<Group, 'playlists' | 'logo'>,
  playlists: PlaylistLike[],
): string[] {
  const byName = new Map<string, PlaylistLike>()
  for (const p of playlists) if (p.name) byName.set(p.name, p)

  const files: string[] = []
  const add = (f?: string | null) => {
    if (f && f.indexOf('_system') !== 0 && !files.includes(f)) files.push(f)
  }

  for (const ref of group.playlists ?? []) {
    const name = playlistRefName(ref)
    if (!name) continue
    const pl = byName.get(name)
    if (!pl) continue
    for (const a of pl.assets ?? []) {
      add(a.filename)
      // A nested playlist referenced as an asset (__sub.json) — pull its files too.
      const fn = a.filename
      if (fn && fn.startsWith('__') && fn.endsWith('.json')) {
        const nested = byName.get(fn.slice(2, -5))
        for (const na of nested?.assets ?? []) add(na.filename)
      }
    }
    add(`__${name}.json`)
    if (pl.templateName) add(pl.templateName)
  }
  if (group.logo) add(group.logo)
  return files
}

/**
 * Annotate the group's playlist entries for deployment, mirroring the old UI's
 * GroupFunctions.listFiles. The player's boot scheduler only plays entries
 * flagged schedulable (`plType: "regular"`, `skipForSchedule: false`), so a
 * deploy that omits these leaves the player on the Welcome screen after a
 * reboot. Each entry keeps its existing fields (e.g. schedule) and gains the
 * source playlist's behavior settings + the computed plType/skipForSchedule.
 */
export function buildGroupPlaylists(
  group: Pick<Group, 'playlists'>,
  playlists: PlaylistLike[],
): PlaylistRef[] {
  const byName = new Map<string, PlaylistLike>()
  for (const p of playlists) if (p.name) byName.set(p.name, p)

  const out: PlaylistRef[] = []
  for (const ref of group.playlists ?? []) {
    const name = playlistRefName(ref)
    if (!name) continue
    const pl = byName.get(name)
    const s = pl?.settings ?? {}
    const base = typeof ref === 'string' ? { name } : { ...ref }
    const entry: Record<string, unknown> = {
      ...base,
      settings: {
        ...((base as { settings?: Record<string, unknown> }).settings ?? {}),
        ads: s.ads,
        domination: s.domination,
        event: s.event,
        keyPress: s.keyPress,
        onlineOnly: s.onlineOnly,
        audio: s.audio,
      },
    }

    if (name === 'TV_OFF') {
      entry.plType = 'special'
    } else if (!pl || !(pl.assets && pl.assets.length)) {
      entry.skipForSchedule = true
      entry.plType = 'no assets'
    } else {
      entry.skipForSchedule = false
      if (s.ads?.adPlaylist) entry.plType = 'advt'
      else if (s.domination?.enable) entry.plType = 'domination'
      else if (s.event?.enable) entry.plType = 'event'
      else if (s.keyPress?.enable) entry.plType = 'keyPress'
      else if (s.audio?.enable) entry.plType = 'audio'
      else entry.plType = 'regular'
    }
    out.push(entry as PlaylistRef)
  }
  return out
}

/** Tidy the server's "Unable to update Group Error: <reason>" into just <reason>. */
function deployErrorMessage(stat?: string): string {
  if (!stat) return 'Deploy failed'
  const cleaned = stat
    .replace(/^Unable to update Group\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .trim()
  return cleaned || stat
}

/**
 * Save the group's ticker settings. Mirrors the old UI's saveTickerSettings:
 * strips double-quotes from `style` and swaps single-quotes for backticks in
 * `messages`. Persist only — the ticker reaches players on the next deploy
 * (use deployGroup / the group's Deploy button).
 */
export async function saveGroupTicker(id: string, ticker: GroupTicker): Promise<Group> {
  const clean: GroupTicker = {
    ...ticker,
    style: typeof ticker.style === 'string' ? ticker.style.replace(/"/g, '') : ticker.style,
    messages:
      typeof ticker.messages === 'string' ? ticker.messages.replace(/'/g, '`') : ticker.messages,
  }
  const res = await api.put(`/groups/${encodeURIComponent(id)}`, { ticker: clean })
  return unwrapObject<Group>(res.data, { _id: id } as Group)
}

/**
 * Save the group's emergency overlay message and deploy in one call, so it
 * takes effect on every player immediately. (The old UI saved the message then
 * relied on a separate deploy; the new dialog confirms deployment in one step.)
 */
export async function saveEmergencyMessage(id: string, em: EmergencyMessage): Promise<Group> {
  const res = await api.put(`/groups/${encodeURIComponent(id)}`, {
    emergencyMessage: em,
    deploy: true,
  })
  return unwrapObject<Group>(res.data, { _id: id } as Group)
}

/**
 * Display/player settings edited in the Group Settings dialog. Mirrors every
 * field of the old AngularJS display-set.html. `imageSize` / `videoSize` are
 * transient UI selectors that saveGroupSettings maps to the persisted
 * resizeAssets / imageLetterboxed / videoKeepAspect fields (see below).
 */
export type GroupSettings = {
  resolution?: string
  orientation?: string
  monitorArrangement?: { mode?: string; reverse?: boolean }
  animationEnable?: boolean
  animationType?: string | null
  signageBackgroundColor?: string
  omxVolume?: number
  logo?: string | null
  logox?: string | number
  logoy?: string | number
  showClock?: { enable?: boolean; format?: string; position?: string }
  /** 0 = Actual, 1 = Letterbox, 2 = Stretched (transient — see saveGroupSettings). */
  imageSize?: number
  /** 1 = Letterbox, 2 = Stretched (transient — see saveGroupSettings). */
  videoSize?: number
  urlReloadDisable?: boolean
  keepWeblinksInMemory?: boolean
  timeToStopVideo?: number
  sleep?: { enable?: boolean; ontime?: string; offtime?: string }
  reboot?: { enable?: boolean; absoluteTime?: string }
  kioskUi?: { enable?: boolean; url?: string; timeout?: number }
  selectedVideoPlayer?: string
  mpvAudioDelay?: string
  disableAp?: boolean
  disableWebUi?: boolean
  disableWarnings?: boolean
  enablePio?: boolean
}

/**
 * Save the group's display/player settings. Replicates the old UI's
 * saveSettings(): maps the imageSize/videoSize radio selectors onto the
 * persisted resizeAssets / imageLetterboxed / videoKeepAspect fields, and
 * derives enableMpv from the selected video player. Persist only — the
 * settings reach players on the next deploy (use the group's Deploy button).
 */
export async function saveGroupSettings(id: string, s: GroupSettings): Promise<Group> {
  const { imageSize, videoSize, ...rest } = s
  const patch: Partial<Group> = { ...rest }

  // Image fit selector → persisted fields.
  switch (imageSize) {
    case 1:
      patch.imageLetterboxed = true
      patch.resizeAssets = true
      break
    case 2:
      patch.imageLetterboxed = false
      patch.resizeAssets = true
      break
    default:
      patch.resizeAssets = false
  }
  // Video fit selector → persisted field (1 = keep aspect / letterbox).
  patch.videoKeepAspect = videoSize === 1
  // MPV is derived from the selected player.
  patch.enableMpv = s.selectedVideoPlayer === 'mpv'

  const res = await api.put(`/groups/${encodeURIComponent(id)}`, patch)
  return unwrapObject<Group>(res.data, { _id: id } as Group)
}
