import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Icon } from '@/components/Icon'
import {
  streamChat,
  TOOL_LABELS,
  type ChatMessage,
  type ToolEvent,
} from '@/lib/assistant'

// ── Layered navy palette ──────────────────────────────────────────────────
// modal → bubbles/chips/input → nested cards, with a two-tone border pair.
const C = {
  modal: '#0f1623',
  raised: '#131c2c', // assistant bubble, chips, input
  borderSoft: '#1e2a3d',
  borderStrong: '#24344e',
  text: '#e4ecf7',
  textMuted: '#8b9bb4',
  teal: '#3cddc7', // functional accent (reused from READ-ONLY badge)
  link: '#7fb4f0',
}

type Turn = {
  role: 'user' | 'assistant'
  content: string
  tools?: ToolEvent[]
  streaming?: boolean
  error?: string
}

const SUGGESTIONS = [
  'Which players are offline?',
  'List all players and their status',
  'When was each group last deployed?',
  'What playlists exist?',
]

export function AssistantPanel({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [input, setInput] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  useEffect(() => {
    if (!open) abortRef.current?.abort()
  }, [open])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [turns])

  const send = async (raw: string) => {
    const text = raw.trim()
    if (!text || busy) return

    const history: ChatMessage[] = turns
      .filter((t) => t.content && !t.error)
      .map((t) => ({ role: t.role, content: t.content }))

    setInput('')
    setBusy(true)
    const assistantIdx = turns.length + 1
    setTurns((t) => [
      ...t,
      { role: 'user', content: text },
      { role: 'assistant', content: '', tools: [], streaming: true },
    ])

    const controller = new AbortController()
    abortRef.current = controller

    const patch = (fn: (turn: Turn) => Turn) =>
      setTurns((t) => t.map((turn, i) => (i === assistantIdx ? fn(turn) : turn)))

    await streamChat(
      text,
      history,
      {
        onTool: (tool) =>
          patch((turn) => ({ ...turn, tools: [...(turn.tools ?? []), tool] })),
        onToken: (chunk) =>
          patch((turn) => ({ ...turn, content: turn.content + chunk })),
        onDone: () => patch((turn) => ({ ...turn, streaming: false })),
        onError: (message) =>
          patch((turn) => ({ ...turn, streaming: false, error: message })),
      },
      controller.signal,
    )

    patch((turn) =>
      turn.streaming
        ? {
            ...turn,
            streaming: false,
            error: turn.content ? undefined : 'No response from the assistant.',
          }
        : turn,
    )
    setBusy(false)
  }

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    send(input)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl p-0 overflow-hidden flex flex-col h-[80vh] font-[Inter,system-ui,sans-serif]"
        style={{ backgroundColor: C.modal, borderColor: C.borderStrong }}
      >
        <DialogHeader
          className="px-6 pt-6 pb-4 mb-0 shrink-0 border-b"
          style={{ borderColor: C.borderSoft }}
        >
          <DialogTitle
            className="text-[17px] font-medium flex items-center gap-2"
            style={{ color: C.text }}
          >
            <Icon name="smart_toy" size={22} className="text-[#7fb4f0]" />
            piSignage Assistant
            <span
              className="ml-1 text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-full border font-medium"
              style={{
                color: C.teal,
                borderColor: `${C.teal}55`,
                backgroundColor: `${C.teal}14`,
              }}
            >
              Read-only
            </span>
          </DialogTitle>
          <DialogDescription className="text-[13px]" style={{ color: C.textMuted }}>
            Ask about players, groups, playlists and media in plain language.
          </DialogDescription>
        </DialogHeader>

        {/* Transcript */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {turns.length === 0 ? (
            <div className="pt-4">
              <p className="text-[13px] mb-3" style={{ color: C.textMuted }}>
                Try asking:
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="px-3 py-1.5 rounded-lg border text-[13px] bg-[#131c2c] border-[#1e2a3d] text-[#e4ecf7] hover:border-[#7fb4f0] transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            turns.map((turn, i) => <TurnView key={i} turn={turn} />)
          )}
        </div>

        {/* Prompt */}
        <form
          onSubmit={submit}
          className="px-6 py-4 shrink-0 border-t"
          style={{ borderColor: C.borderSoft }}
        >
          <div
            className="flex items-end gap-2 rounded-xl border px-3 focus-within:border-[color:var(--fw)]"
            style={
              {
                backgroundColor: C.raised,
                borderColor: C.borderStrong,
                ['--fw' as string]: C.link,
              } as React.CSSProperties
            }
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Ask about your fleet…  (Enter to send, Shift+Enter for newline)"
              className="flex-1 bg-transparent border-none py-3 resize-none max-h-32 text-[14px] focus:outline-none"
              style={{ color: C.text }}
            />
            <button
              type="submit"
              disabled={!input.trim() || busy}
              className="mb-1.5 px-4 py-1.5 rounded-lg text-[11px] tracking-wide uppercase font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: C.borderStrong, color: C.text }}
            >
              {busy ? '…' : 'Send'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function TurnView({ turn }: { turn: Turn }) {
  if (turn.role === 'user') {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[85%] rounded-xl border px-3.5 py-2 text-[14px] whitespace-pre-wrap"
          style={{ backgroundColor: C.raised, borderColor: C.borderStrong, color: C.text }}
        >
          {turn.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {turn.tools && turn.tools.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {turn.tools.map((t, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-md border"
              style={{ backgroundColor: C.raised, borderColor: C.borderSoft, color: C.textMuted }}
            >
              <Icon name="bolt" size={12} className="text-[#3cddc7]" />
              {TOOL_LABELS[t.name] ?? t.name}
            </span>
          ))}
        </div>
      )}

      <div
        className="max-w-[92%] rounded-xl border px-4 py-3 text-[14px] leading-relaxed"
        style={{ backgroundColor: C.raised, borderColor: C.borderSoft, color: C.text }}
      >
        {turn.content ? (
          <Markdown text={turn.content} />
        ) : turn.streaming ? (
          <span className="inline-flex items-center gap-1" style={{ color: C.textMuted }}>
            <Icon name="progress_activity" size={14} className="animate-spin" />
            thinking…
          </span>
        ) : null}
        {turn.streaming && turn.content && (
          <span
            className="inline-block w-1.5 h-4 ml-0.5 -mb-0.5 animate-pulse"
            style={{ backgroundColor: C.link }}
          />
        )}
        {turn.error && (
          <p className="mt-1 text-[13px]" style={{ color: '#f28b82' }}>
            {turn.error}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Minimal, dependency-free Markdown for exactly what the assistant emits:
// `code`, **bold**, [label](url), bare URLs, ordered/bullet lists, paragraphs. ──
const INLINE_RE =
  /`([^`]+)`|\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)]+)/g

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  let key = 0
  let m: RegExpExecArray | null
  INLINE_RE.lastIndex = 0
  while ((m = INLINE_RE.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    if (m[1] !== undefined) {
      // `code` → filename / identifier chip
      nodes.push(
        <code
          key={key++}
          className="font-mono text-[12.5px] px-1.5 py-0.5 rounded-md border break-all align-baseline"
          style={{ backgroundColor: '#0b111c', borderColor: C.borderStrong, color: '#7fe0d1' }}
        >
          {m[1]}
        </code>,
      )
    } else if (m[2] !== undefined) {
      nodes.push(
        <span key={key++} className="font-medium" style={{ color: C.text }}>
          {m[2]}
        </span>,
      )
    } else if (m[3] !== undefined) {
      nodes.push(
        <a key={key++} href={m[4]} target="_blank" rel="noreferrer" className="underline break-words" style={{ color: C.link }}>
          {m[3]}
        </a>,
      )
    } else if (m[5] !== undefined) {
      nodes.push(
        <a key={key++} href={m[5]} target="_blank" rel="noreferrer" className="underline break-all" style={{ color: C.link }}>
          {m[5]}
        </a>,
      )
    }
    last = INLINE_RE.lastIndex
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

function Markdown({ text }: { text: string }) {
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  let items: ReactNode[] | null = null
  let listType: 'ul' | 'ol' = 'ul'
  let key = 0

  const flush = () => {
    if (!items) return
    const cls = 'pl-5 space-y-1.5 my-1 ' + (listType === 'ol' ? 'list-decimal' : 'list-disc')
    blocks.push(
      listType === 'ol' ? (
        <ol key={`ol${key++}`} className={cls} style={{ color: C.textMuted }}>
          {items}
        </ol>
      ) : (
        <ul key={`ul${key++}`} className={cls} style={{ color: C.textMuted }}>
          {items}
        </ul>
      ),
    )
    items = null
  }

  const pushItem = (type: 'ul' | 'ol', content: string) => {
    if (items && listType !== type) flush()
    if (!items) {
      items = []
      listType = type
    }
    items.push(
      <li key={`li${key++}`} className="pl-1">
        <span style={{ color: C.text }}>{renderInline(content)}</span>
      </li>,
    )
  }

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/)
    if (ordered) {
      pushItem('ol', ordered[1])
      continue
    }
    const bullet = line.match(/^\s*[-*]\s+(.*)$/)
    if (bullet) {
      pushItem('ul', bullet[1])
      continue
    }
    flush()
    if (line.trim() === '') {
      blocks.push(<div key={`sp${key++}`} className="h-2" />)
      continue
    }
    const heading = line.match(/^#{1,6}\s+(.*)$/)
    if (heading) {
      blocks.push(
        <p key={`h${key++}`} className="font-medium" style={{ color: C.text }}>
          {renderInline(heading[1])}
        </p>,
      )
      continue
    }
    blocks.push(
      <p key={`p${key++}`} style={{ color: C.text }}>
        {renderInline(line)}
      </p>,
    )
  }
  flush()
  return <div className="space-y-0.5">{blocks}</div>
}
