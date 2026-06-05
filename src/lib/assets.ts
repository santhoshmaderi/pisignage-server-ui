import { api } from './api'
import { assertSuccess, unwrapArray } from './envelope'

export type AssetType = 'video' | 'image' | 'html' | 'link' | 'audio' | 'folder' | 'other'

/**
 * A "link" asset — a web/stream URL, an RSS feed, a text message, or a local
 * file/folder reference. The server (POST /api/links) writes `<name><type>` to
 * disk as JSON and registers it as a `link` asset. `type` is the file extension
 * that selects the behavior on the player.
 */
export type LinkDetails = {
  name: string
  /** .tv .stream .radio .link .weblink .mrss .txt .local */
  type: string
  link?: string
  zoom?: number
  duration?: number
  /** Media RSS: which fields to show (none|title|description|onlytitle|onlydescription|onlytitledescr). */
  hideTitle?: string
  numberOfItems?: number
  tcp?: boolean
  /** Optional inline CSS (message / RSS). */
  style?: string
  /** Message text (.txt). */
  message?: string
}

export async function createLink(details: LinkDetails, categories: string[] = []): Promise<void> {
  const res = await api.post('/links', { details, categories })
  assertSuccess(res.data, 'Failed to create link')
}

/**
 * Load a link asset's stored details for editing. The server's getLinkFileDetails
 * replies with { data: { data: <details>, dbdata } }, so the parsed link details
 * live at `res.data.data.data`. `filename` is the full asset name incl. extension
 * (e.g. "TEST-Webpage.weblink").
 */
export async function fetchLinkDetails(filename: string): Promise<LinkDetails> {
  const res = await api.get(`/links/${encodeURIComponent(filename)}`)
  const env = res.data as { data?: { data?: LinkDetails } } | undefined
  return (env?.data?.data ?? { name: '', type: '.tv' }) as LinkDetails
}

/**
 * Asset record. Field naming varies across pisignage-server forks — some use
 * `name`, others `filename` or `file`. Use `assetName()` to read the display
 * name instead of touching the property directly.
 *
 * Note: pisignage returns several fields as **strings** that look like numbers:
 *   - `size`: "1869888B", "116811KB", "0KB" (number + unit suffix)
 *   - `duration`: "180" (seconds, as a string)
 *   - `resolution.width/height`: "1920" (as a string)
 * Use `parseSize()` / `parseDuration()` helpers below; don't pass these to
 * arithmetic directly.
 */
export type Asset = {
  _id?: string
  name?: string
  filename?: string
  file?: string
  type?: AssetType | string
  size?: number | string
  duration?: number | string
  resolution?: { width?: number | string; height?: number | string }
  labels?: string[]
  playlists?: string[]
  thumbnail?: string
  validity?: unknown
  ctime?: string
  mtime?: string
  createdAt?: string
  updatedAt?: string
}

/** Read the display filename from an asset, no matter which field the server uses. */
export function assetName(asset: Asset): string {
  return asset.name ?? asset.filename ?? asset.file ?? ''
}

/**
 * Fetch the asset library.
 *
 * pisignage's /api/files envelope is layered:
 *   { success, stat_message, data: { files: string[], dbdata: Asset[], systemAssets } }
 *
 * `files` is just filenames on disk (no metadata) and `dbdata` holds the actual
 * Mongoose docs with type/size/labels/thumbnails. We want `dbdata` — the generic
 * heuristic would grab `files` first (it's the first array) and explode
 * downstream when code expects objects. We tolerate a bare-array shape too in
 * case a fork returns it that way.
 */
export async function fetchAssets(): Promise<Asset[]> {
  const res = await api.get('/files')
  const body = res.data as
    | { data?: { dbdata?: Asset[]; files?: string[]; systemAssets?: string[] } }
    | Asset[]
    | undefined

  // A fork might return a bare array of assets.
  if (Array.isArray(body)) return body

  const data = body?.data
  const dbdata = Array.isArray(data?.dbdata) ? data.dbdata : []
  const files = Array.isArray(data?.files) ? data.files : []

  // If the server didn't send the on-disk file list, fall back to DB records.
  if (files.length === 0) {
    return dbdata.length ? dbdata : unwrapArray<Asset>(body)
  }

  // Like the legacy UI (public/app/js/services/assets.js): list every file on
  // disk and enrich it with its DB record (type/thumbnail/duration/labels) when
  // one exists. This keeps files visible even before/without server-side
  // processing — e.g. a freshly uploaded video whose Asset doc isn't ready yet.
  const byName = new Map<string, Asset>()
  for (const a of dbdata) {
    const n = assetName(a)
    if (n) byName.set(n, a)
  }
  return files.map((name) => byName.get(name) ?? { name })
}

/**
 * Multipart upload to /api/files. Multer caps the server at 10 files/request.
 *
 * pisignage splits uploads into two steps: POST /files only moves the bytes to
 * the media dir; POST /postupload then probes metadata, builds the thumbnail and
 * creates the Asset DB record (processing runs in the background server-side).
 * Without the second call the file sits on disk but never shows up in the asset
 * list (which reads `dbdata`). So we always follow the upload with /postupload.
 */
export type UploadPhase = 'uploading' | 'processing'

export async function uploadAssets(
  files: File[],
  onProgress?: (pct: number) => void,
  onPhase?: (phase: UploadPhase) => void,
): Promise<void> {
  const form = new FormData()
  for (const f of files) form.append('newfiles', f, f.name)

  onPhase?.('uploading')
  const res = await api.post('/files', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) {
        onProgress(Math.round((evt.loaded / evt.total) * 100))
      }
    },
  })

  // The upload response carries the stored files as [{ name, size, type }].
  // Hand them to /postupload so the server creates DB records + thumbnails.
  // Processing (transcode/probe/thumbnail) runs in the background server-side,
  // so this returns quickly with a "queued" acknowledgement.
  const uploaded = unwrapArray<{ name: string; size: number }>(res.data)
  if (uploaded.length) {
    onPhase?.('processing')
    await api.post('/postupload', { files: uploaded, categories: [] })
  }
}

export async function deleteAsset(name: string): Promise<void> {
  await api.delete(`/files/${encodeURIComponent(name)}`)
}

/** Server URL to the raw file (works for images, videos, HTML). */
export function assetFileUrl(name: string): string {
  return `/media/${encodeURIComponent(name)}`
}

/**
 * Best-available preview URL for an asset.
 *
 * pisignage stores rendered thumbnails for images and videos under
 * `/media/_thumbnails/<hash>_<name>.<ext>` and exposes the path on the
 * Asset record's `thumbnail` field. For assets without a server-side
 * thumbnail (audio/notice/radio/etc.), we return null so the caller can
 * render an icon instead.
 */
export function assetThumbnailUrl(asset: Asset): string | null {
  if (asset.thumbnail) {
    return asset.thumbnail.startsWith('/') ? asset.thumbnail : `/${asset.thumbnail}`
  }
  if (inferType(asset) === 'image') {
    const n = assetName(asset)
    return n ? assetFileUrl(n) : null
  }
  return null
}

/**
 * Map an asset to one of the UI's display categories (the tabs: video / image /
 * html / audio / link, plus 'other').
 *
 * pisignage's server taxonomy is richer than the UI's tabs AND inconsistent
 * between code paths: getFileType() types .html as 'html', but processFile() —
 * which writes the DB `type` the list reads — types .html as 'notice' and leaves
 * link descriptors (.tv/.stream/.link/.weblink/.mrss) with no type at all. So we
 * normalize both the server `type` string and the file extension here.
 *
 * Server types with no dedicated tab ('pdf' | 'text' | 'radio' | 'gcal' | 'zip'
 * | 'repo' | 'local') fall through to 'other' and show only under "All Assets".
 */
export function inferType(asset: Asset): AssetType {
  const raw = (typeof asset.type === 'string' ? asset.type : '').toLowerCase()
  switch (raw) {
    case 'image':
      return 'image'
    case 'video':
      return 'video'
    case 'audio':
      return 'audio'
    case 'notice': // pisignage's type for HTML pages / dashboards / uploaded .html
    case 'html':
      return 'html'
    case 'link':
      return 'link'
    // pdf/text/radio/gcal/zip/repo/local/other/'' → sniff the extension below.
  }
  // Extension lists mirror config/env/all.js on the server.
  const ext = assetName(asset).split('.').pop()?.toLowerCase() ?? ''
  if (['mp4', 'mov', 'm4v', 'avi', 'webm', 'wmv', 'flv', 'mkv', 'mpg', 'mpeg', '3gp'].includes(ext)) return 'video'
  if (['mp3', 'm4a', 'mp4a', 'aac', 'wav', 'ogg', 'flac'].includes(ext)) return 'audio'
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) return 'image'
  if (['html', 'htm'].includes(ext)) return 'html'
  if (['tv', 'stream', 'link', 'weblink', 'mrss'].includes(ext)) return 'link'
  return 'other'
}

/**
 * Parse a pisignage `size` value (string-with-unit like "116811KB" / "1869888B")
 * to bytes. Falls back to NaN if unrecognized.
 */
export function parseSize(input: unknown): number {
  if (input == null) return NaN
  if (typeof input === 'number') return input
  const m = /^([\d.]+)\s*([KMG]?B)?$/i.exec(String(input).trim())
  if (!m) return NaN
  const n = Number(m[1])
  if (isNaN(n)) return NaN
  switch ((m[2] ?? 'B').toUpperCase()) {
    case 'GB': return n * 1024 ** 3
    case 'MB': return n * 1024 ** 2
    case 'KB': return n * 1024
    default:   return n
  }
}

/** Parse a pisignage `duration` value (often a string of seconds) to a number. */
export function parseDuration(input: unknown): number {
  if (input == null) return 0
  if (typeof input === 'number') return input
  const n = Number(input)
  return isNaN(n) ? 0 : n
}

export function formatBytes(input?: number | string): string {
  const bytes = typeof input === 'string' ? parseSize(input) : input
  if (bytes == null || isNaN(bytes)) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}
