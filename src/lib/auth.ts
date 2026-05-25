const STORAGE_KEY = 'pisignage.basicAuth'

export type Credentials = { username: string; password: string }

export function loadAuthHeader(): string | null {
  return sessionStorage.getItem(STORAGE_KEY)
}

export function saveCredentials({ username, password }: Credentials): string {
  const header = `Basic ${btoa(`${username}:${password}`)}`
  sessionStorage.setItem(STORAGE_KEY, header)
  return header
}

export function clearCredentials() {
  sessionStorage.removeItem(STORAGE_KEY)
}

export function decodeUsername(header: string | null): string | null {
  if (!header?.startsWith('Basic ')) return null
  try {
    const decoded = atob(header.slice('Basic '.length))
    const idx = decoded.indexOf(':')
    return idx === -1 ? decoded : decoded.slice(0, idx)
  } catch {
    return null
  }
}
