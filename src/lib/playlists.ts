import { api } from './api'
import { assertSuccess, unwrapArray, unwrapObject } from './envelope'

/**
 * Playlist file as stored by pisignage-server.
 *
 * pisignage persists playlists as JSON files on disk (not Mongoose docs),
 * so there is no `_id`; `name` is the primary key. Endpoints:
 *   GET    /api/playlists           — list of names + summaries
 *   GET    /api/playlists/:name     — full playlist body
 *   POST   /api/playlists           — create  (body: { name })
 *   PUT    /api/playlists/:name     — save full body
 *   DELETE /api/playlists/:name
 *
 * The shape we read back includes a handful of "settings" branches that may
 * be missing on older playlists. We tolerate missing keys and provide
 * sensible defaults via `withDefaults`.
 */

export type PlaylistAsset = {
  /** Filename in the asset library. */
  filename: string
  /** Seconds. pisignage may return as a string ("180") rather than a number. */
  duration?: number | string
  selected?: boolean
  fullscreen?: boolean
  /** Attached zone content shown while this main asset plays: an asset filename
   *  or a playlist reference ("__<name>.json"). Keyed by layout zone id. */
  side?: string | null
  bottom?: string | null
  top?: string | null
  option?: {
    /** Legacy zone routing (no longer used by the v2 editor). */
    zone?: string
    /** Per-type flag: mute (video) / play-in-background (audio) / presentation (pdf). */
    main?: boolean
    /** Text overlaid on the image/video. */
    bannerText?: string
    /** PDF presentation mode: seconds per slide. */
    subduration?: number
  } & Record<string, unknown>
}

export type TickerSettings = {
  enable?: boolean
  behavior?: 'slide' | 'scroll' | 'scrollRight' | 'openvg_left' | 'openvg_right' | string
  /** pisignage stores ticker speed numerically: 1 (slow) / 2 (normal) / 3 (fast).
   *  Read may be a string on legacy playlists; we always write a number. */
  textSpeed?: number | string
  /** Free-form CSS applied to the ticker strip, e.g. "color:#eee; font-style:italic;". */
  style?: string
  /** Server field name. */
  messages?: string
  /** Alias retained for backwards compat with older UIs. */
  text?: string
  rss?: { enable?: boolean; link?: string | null; feedDelay?: number; useDescription?: boolean }
}

export type AudioSettings = {
  /** Play this as an independent audio playlist out the aux/3.5mm port (mp3 only). */
  enable?: boolean
  random?: boolean
  volume?: number
  /** Also output the audio on the HDMI port. */
  hdmi?: boolean
}

export type AdsSettings = {
  /** Make this an advert playlist (its assets are inserted into the running playlist). */
  adPlaylist?: boolean
  /** Don't play the main/regular playlist while this ad playlist runs. */
  noMainPlay?: boolean
  /** Number of assets to insert per cycle. */
  adCount?: number
  /** Interval between insertions (seconds). */
  adInterval?: number
}

/** "Play this playlist only once during selected duration" (a.k.a. domination). */
export type DominationSettings = {
  enable?: boolean
  /** Minutes between forced plays. */
  timeInterval?: number
}

/** Played when a SIGUSR2 event is signalled on the player. */
export type EventSettings = {
  enable?: boolean
  /** Seconds to play; 0 = until the next event. */
  duration?: number | string
}

/** Played when an assigned key is pressed on the player. */
export type KeyPressSettings = {
  enable?: boolean
  /** Key code that triggers this playlist. */
  key?: number
  /** Play through once, then return to the regular playlist. */
  playOnceParameter?: boolean
}

export type PlaylistSettings = {
  ticker?: TickerSettings
  audio?: AudioSettings
  ads?: AdsSettings
  domination?: DominationSettings
  event?: EventSettings
  keyPress?: KeyPressSettings
  /** Only play this playlist while the player is online. */
  onlineOnly?: boolean
}

/** Video-window geometry (pixels) — pisignage uses `length` for width and
 *  `width` for height, plus x/y offsets. Used for `videoWindow` (main zone)
 *  and each entry of `zoneVideoWindow`. */
export type VideoWindow = {
  length?: number | string
  width?: number | string
  xoffset?: number | string
  yoffset?: number | string
  /** Main-zone only: play video solely in the main zone. */
  mainzoneOnly?: boolean
}

export type Playlist = {
  name: string
  /** Layout template id, see lib/layouts.ts (e.g. '1', '2a'). */
  layout?: string
  /** Custom-layout HTML file name (used when layout starts with "custom"). */
  templateName?: string
  /** Main-zone video window position/size. null = player default. */
  videoWindow?: VideoWindow | null
  /** Per-zone video windows, keyed by zone id ('side', 'bottom', …). */
  zoneVideoWindow?: Record<string, VideoWindow>
  assets: PlaylistAsset[]
  settings?: PlaylistSettings
  /** ISO date or undefined; the server stamps these on save. */
  updatedAt?: string
  createdAt?: string
  /** Sometimes returned by the list endpoint summary; not always present. */
  duration?: number
}

/**
 * What pisignage actually returns from GET /api/playlists: the FULL playlist
 * body for every playlist, not lightweight summaries. We keep this alias for
 * the list page's prop names but it's just `Playlist`.
 */
export type PlaylistSummary = Playlist

export async function fetchPlaylists(): Promise<PlaylistSummary[]> {
  const res = await api.get('/playlists')
  return unwrapArray<PlaylistSummary>(res.data)
}

export async function fetchPlaylist(name: string): Promise<Playlist> {
  const res = await api.get(`/playlists/${encodeURIComponent(name)}`)
  return withDefaults(unwrapObject<Playlist>(res.data, { name, assets: [] } as Playlist))
}

export async function createPlaylist(name: string): Promise<void> {
  // The server's createPlaylist reads the name from `req.body.file` (not `name`).
  const res = await api.post('/playlists', { file: name })
  assertSuccess(res.data, 'Failed to create playlist')
}

export async function savePlaylist(playlist: Playlist): Promise<Playlist> {
  const res = await api.put(`/playlists/${encodeURIComponent(playlist.name)}`, playlist)
  assertSuccess(res.data, 'Failed to save playlist')
  return withDefaults(unwrapObject<Playlist>(res.data, playlist))
}

export async function deletePlaylist(name: string): Promise<void> {
  // There is no DELETE /api/playlists route. Playlists are stored as files named
  // `__<name>.json`, so (like the old UI) we delete via the files API.
  const res = await api.delete(`/files/${encodeURIComponent(`__${name}.json`)}`)
  assertSuccess(res.data, 'Failed to delete playlist')
}

/** Fill in safe defaults so the UI never has to null-check deep paths. */
export function withDefaults(p: Playlist): Playlist {
  return {
    ...p,
    layout: p.layout ?? '1',
    assets: p.assets ?? [],
    settings: {
      // Preserve any settings fields we don't explicitly model so a save
      // round-trip never drops them (e.g. ticker.style on older playlists).
      ...p.settings,
      ticker: {
        // Preserve fields we don't model (style, tickerHeight, openvg geometry…)
        // so a save round-trip doesn't drop them.
        ...p.settings?.ticker,
        enable: p.settings?.ticker?.enable ?? false,
        behavior: p.settings?.ticker?.behavior ?? 'scroll',
        // pisignage expects numeric speed (1/2/3). Coerce any legacy string
        // (incl. a previously-corrupted "normal") to a number; default 2.
        textSpeed: Number(p.settings?.ticker?.textSpeed ?? 2) || 2,
        // Pisignage stores the ticker text in `messages`. Older UIs / forks
        // wrote it to `text`; preserve both so a save round-trip doesn't lose
        // either.
        messages: p.settings?.ticker?.messages ?? p.settings?.ticker?.text ?? '',
        text: p.settings?.ticker?.text ?? p.settings?.ticker?.messages ?? '',
        rss: {
          ...p.settings?.ticker?.rss,
          enable: p.settings?.ticker?.rss?.enable ?? false,
          link: p.settings?.ticker?.rss?.link ?? '',
          feedDelay: p.settings?.ticker?.rss?.feedDelay ?? 10,
        },
      },
      audio: {
        enable: p.settings?.audio?.enable ?? false,
        random: p.settings?.audio?.random ?? false,
        volume: p.settings?.audio?.volume ?? 100,
        hdmi: p.settings?.audio?.hdmi ?? false,
      },
      ads: {
        adPlaylist: p.settings?.ads?.adPlaylist ?? false,
        noMainPlay: p.settings?.ads?.noMainPlay ?? false,
        adCount: p.settings?.ads?.adCount ?? 1,
        adInterval: p.settings?.ads?.adInterval ?? 60,
      },
      domination: {
        enable: p.settings?.domination?.enable ?? false,
        timeInterval: p.settings?.domination?.timeInterval ?? 60,
      },
      event: {
        enable: p.settings?.event?.enable ?? false,
        duration: p.settings?.event?.duration ?? 0,
      },
      keyPress: {
        enable: p.settings?.keyPress?.enable ?? false,
        key: p.settings?.keyPress?.key ?? 0,
        playOnceParameter: p.settings?.keyPress?.playOnceParameter ?? false,
      },
      onlineOnly: p.settings?.onlineOnly ?? false,
    },
  }
}

/** Total seconds of all assets in a zone (or whole playlist if zone omitted). */
export function totalDuration(playlist: Playlist, zone?: string): number {
  let total = 0
  for (const a of playlist.assets ?? []) {
    if (zone && (a.option?.zone ?? 'main') !== zone) continue
    // pisignage stores duration as string-or-number; coerce defensively.
    const d = typeof a.duration === 'string' ? Number(a.duration) : a.duration
    total += !d || isNaN(d) ? 10 : d
  }
  return total
}

export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
