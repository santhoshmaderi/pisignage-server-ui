/**
 * pisignage-server forks wrap list responses in any of these shapes:
 *
 *   [...]                                 — bare array
 *   { data: [...] }                       — standard envelope
 *   { success: true, data: [...] }
 *   { data: { files: [...] } }            — nested under data
 *   { data: { players: [...] } }
 *   { stat: 'ok', objects: [...] }        — older forks
 *
 * Rather than hardcode every variant per endpoint, this helper does a small
 * targeted walk: it inspects the body, then `body.data`, then any first-level
 * array-valued property, and returns the first array it finds. Falls back to
 * an empty array. Object-typed payloads (e.g. /api/settings) should use
 * `unwrapObject` instead.
 */

export type AnyEnvelope<T> = T | { data?: T; [key: string]: unknown }

/** Find an array anywhere within an envelope at depth ≤ 2. */
export function unwrapArray<T = unknown>(body: unknown): T[] {
  if (Array.isArray(body)) return body as T[]
  if (body == null || typeof body !== 'object') return []

  const obj = body as Record<string, unknown>

  // 1) `data` is the conventional envelope.
  if (Array.isArray(obj.data)) return obj.data as T[]

  // 2) `data` is itself a container — look one level deeper.
  if (obj.data && typeof obj.data === 'object') {
    for (const v of Object.values(obj.data as Record<string, unknown>)) {
      if (Array.isArray(v)) return v as T[]
    }
  }

  // 3) Top-level array property (e.g. `{ objects: [...] }`).
  for (const v of Object.values(obj)) {
    if (Array.isArray(v)) return v as T[]
  }

  return []
}

/**
 * Throw if the response envelope reports a failure.
 *
 * pisignage's restware.sendError replies with HTTP 200 and a
 * `{ success: false, stat_message }` body, so axios resolves even when the
 * operation failed server-side. Call this on `res.data` before trusting a
 * write so the failure surfaces as a thrown error (which React Query maps to
 * the mutation's error state). The reason is taken from `stat_message`.
 */
export function assertSuccess(body: unknown, fallback = 'Request failed'): void {
  if (body && typeof body === 'object' && (body as { success?: boolean }).success === false) {
    const msg = (body as { stat_message?: string }).stat_message
    throw new Error(typeof msg === 'string' && msg.trim() ? msg.trim() : fallback)
  }
}

/** Pull an object body out of any of the envelope shapes above. */
export function unwrapObject<T extends object>(body: unknown, fallback: T): T {
  if (body == null) return fallback
  if (typeof body !== 'object' || Array.isArray(body)) return fallback
  const obj = body as Record<string, unknown>
  if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
    return obj.data as T
  }
  return obj as T
}
