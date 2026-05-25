import { api } from './api'
import { unwrapArray, unwrapObject } from './envelope'

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
  /** Zone routing for multi-zone layouts. Default 'main'. */
  option?: { zone?: string } & Record<string, unknown>
}

export type TickerSettings = {
  enable?: boolean
  behavior?: 'scroll' | 'slide' | 'fade' | string
  /** Speed varies by fork: enum string ("slow"/"normal"/"fast") or numeric (1-5). */
  textSpeed?: 'slow' | 'normal' | 'fast' | number | string
  position?: 'top' | 'bottom' | string
  color?: string
  background?: string
  /** Server field name. */
  messages?: string
  /** Alias retained for backwards compat with older UIs. */
  text?: string
  rss?: { enable?: boolean; link?: string | null; feedDelay?: number; useDescription?: boolean }
}

export type AudioSettings = {
  enable?: boolean
  random?: boolean
  volume?: number
}

export type AdsSettings = {
  adPlaylist?: string
  adCount?: number
  adInterval?: number
}

export type PlaylistSettings = {
  ticker?: TickerSettings
  audio?: AudioSettings
  ads?: AdsSettings
  /** Asset shuffle on the player. */
  random?: boolean
  /** Cross-fade / cut / etc. */
  transition?: string
}

export type Playlist = {
  name: string
  /** Layout template id, see lib/layouts.ts (e.g. '1', '2a'). */
  layout?: string
  templateName?: string
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
  await api.post('/playlists', { name })
}

export async function savePlaylist(playlist: Playlist): Promise<Playlist> {
  const res = await api.put(`/playlists/${encodeURIComponent(playlist.name)}`, playlist)
  return withDefaults(unwrapObject<Playlist>(res.data, playlist))
}

export async function deletePlaylist(name: string): Promise<void> {
  await api.delete(`/playlists/${encodeURIComponent(name)}`)
}

/** Fill in safe defaults so the UI never has to null-check deep paths. */
export function withDefaults(p: Playlist): Playlist {
  return {
    ...p,
    layout: p.layout ?? '1',
    assets: p.assets ?? [],
    settings: {
      random: p.settings?.random ?? false,
      transition: p.settings?.transition ?? 'none',
      ticker: {
        enable: p.settings?.ticker?.enable ?? false,
        behavior: p.settings?.ticker?.behavior ?? 'scroll',
        textSpeed: p.settings?.ticker?.textSpeed ?? 'normal',
        position: p.settings?.ticker?.position ?? 'bottom',
        color: p.settings?.ticker?.color ?? '#ffffff',
        background: p.settings?.ticker?.background ?? '#000000',
        // Pisignage stores the ticker text in `messages`. Older UIs / forks
        // wrote it to `text`; preserve both so a save round-trip doesn't lose
        // either.
        messages: p.settings?.ticker?.messages ?? p.settings?.ticker?.text ?? '',
        text: p.settings?.ticker?.text ?? p.settings?.ticker?.messages ?? '',
        rss: {
          enable: p.settings?.ticker?.rss?.enable ?? false,
          link: p.settings?.ticker?.rss?.link ?? '',
          feedDelay: p.settings?.ticker?.rss?.feedDelay ?? 10,
        },
      },
      audio: {
        enable: p.settings?.audio?.enable ?? false,
        random: p.settings?.audio?.random ?? false,
        volume: p.settings?.audio?.volume ?? 100,
      },
      ads: {
        adPlaylist: p.settings?.ads?.adPlaylist ?? '',
        adCount: p.settings?.ads?.adCount ?? 0,
        adInterval: p.settings?.ads?.adInterval ?? 0,
      },
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
