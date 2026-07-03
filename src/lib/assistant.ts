import { loadAuthHeader } from './auth'

/**
 * Client for the piSignage AI assistant.
 *
 * The backend (POST /api/assistant/chat/stream) replies with newline-delimited
 * JSON events so the UI can render the answer token-by-token as the local model
 * generates it — important because CPU inference is slow and a spinner alone
 * feels broken. We use fetch() + a ReadableStream reader (EventSource only
 * supports GET and can't send the Basic-auth header / body).
 */

export type ChatRole = 'user' | 'assistant'

export type ChatMessage = { role: ChatRole; content: string }

export type ToolEvent = { name: string; args: Record<string, unknown> }

type StreamEvent =
  | { type: 'token'; text: string }
  | { type: 'tool'; name: string; args: Record<string, unknown> }
  | { type: 'done'; toolTrace: Array<{ name: string; args: unknown; ok: boolean }> }
  | { type: 'error'; message: string }

export type StreamHandlers = {
  onToken?: (text: string) => void
  onTool?: (tool: ToolEvent) => void
  onDone?: () => void
  onError?: (message: string) => void
}

/**
 * Send a message and stream the reply. `history` is the prior turns (excluding
 * the message being sent). Pass an AbortSignal to cancel in flight.
 */
export async function streamChat(
  message: string,
  history: ChatMessage[],
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const authHeader = loadAuthHeader()
  const res = await fetch('/api/assistant/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify({ message, history }),
    signal,
  })

  if (!res.ok || !res.body) {
    handlers.onError?.(
      res.status === 401
        ? 'Session expired — please sign in again.'
        : `Assistant request failed (HTTP ${res.status}).`,
    )
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const handle = (evt: StreamEvent) => {
    switch (evt.type) {
      case 'token':
        handlers.onToken?.(evt.text)
        break
      case 'tool':
        handlers.onTool?.({ name: evt.name, args: evt.args })
        break
      case 'done':
        handlers.onDone?.()
        break
      case 'error':
        handlers.onError?.(evt.message)
        break
    }
  }

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // Process complete newline-delimited JSON objects.
      let nl: number
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).trim()
        buffer = buffer.slice(nl + 1)
        if (!line) continue
        try {
          handle(JSON.parse(line) as StreamEvent)
        } catch {
          // Ignore a malformed line rather than aborting the whole stream.
        }
      }
    }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return // caller cancelled
    handlers.onError?.(err instanceof Error ? err.message : 'Stream interrupted.')
  }
}

// Human-friendly labels for the tool chips shown in the transcript.
export const TOOL_LABELS: Record<string, string> = {
  list_players: 'Checked players',
  get_player_status: 'Checked player status',
  list_groups: 'Checked groups',
  get_group: 'Checked group',
  get_assigned_playlist: 'Checked assigned playlist',
  list_assets: 'Checked media assets',
  list_playlists: 'Checked playlists',
  get_playlist_assets: 'Read playlist contents',
  get_player_assets: 'Resolved player content',
  get_group_assets: 'Resolved group content',
  search_help_docs: 'Searched help docs',
}
