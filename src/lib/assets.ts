import { api } from './api'
import { unwrapArray } from './envelope'

export type AssetType = 'video' | 'image' | 'html' | 'link' | 'audio' | 'folder' | 'other'

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
    | { data?: { dbdata?: unknown; files?: unknown } }
    | Asset[]
    | undefined

  if (Array.isArray(body)) return body
  const dbdata = body?.data?.dbdata
  if (Array.isArray(dbdata)) return dbdata as Asset[]
  return unwrapArray<Asset>(body)
}

/** Multipart upload to /api/files. Multer caps the server at 10 files/request. */
export async function uploadAssets(
  files: File[],
  onProgress?: (pct: number) => void,
): Promise<void> {
  const form = new FormData()
  for (const f of files) form.append('newfiles', f, f.name)

  await api.post('/files', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) {
        onProgress(Math.round((evt.loaded / evt.total) * 100))
      }
    },
  })
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

/** Best-effort: infer asset type from name when the server didn't send one. */
export function inferType(asset: Asset): AssetType {
  if (asset.type && asset.type !== 'other') return asset.type as AssetType
  const ext = assetName(asset).split('.').pop()?.toLowerCase() ?? ''
  if (['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)) return 'video'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image'
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) return 'audio'
  if (['html', 'htm'].includes(ext)) return 'html'
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
