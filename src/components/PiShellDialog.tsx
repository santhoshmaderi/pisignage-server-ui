import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Icon } from '@/components/Icon'
import { cn } from '@/lib/utils'
import { runShell, setTvPower, type Player, type ShellResult } from '@/lib/players'

type LogEntry = { cmd: string; pending?: boolean; result?: ShellResult; error?: string }

const LOG_CMD = 'tail -200 /home/pi/forever_out.log'
// Pre-populated command history (matches the old UI's seed). Newest-first so the
// first ↑ surfaces the log-tail command.
const SEED_HISTORY = [LOG_CMD, 'ls ../media', 'ifconfig', 'date', 'uptime']

export function PiShellDialog({
  player,
  open,
  onOpenChange,
}: {
  player: Player
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [cmd, setCmd] = useState('')
  const [log, setLog] = useState<LogEntry[]>([])
  const [history, setHistory] = useState<string[]>([])
  const [histIdx, setHistIdx] = useState(-1)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [tvMsg, setTvMsg] = useState<string | null>(null)
  const runMut = useMutation({ mutationFn: (c: string) => runShell(player._id, c) })
  const tvMut = useMutation({
    mutationFn: (off: boolean) => setTvPower(player._id, off),
    onSuccess: (_d, off) => {
      setTvMsg(`TV ${off ? 'OFF' : 'ON'} request sent — allow ~10s to take effect.`)
      setTimeout(() => setTvMsg(null), 6000)
    },
    onError: (err) => setTvMsg(err instanceof Error ? err.message : 'TV command failed'),
  })

  // Reset the session each time the dialog opens; focus the prompt.
  useEffect(() => {
    if (open) {
      setLog([])
      setCmd('')
      setHistory(SEED_HISTORY)
      setHistIdx(-1)
      setTvMsg(null)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Keep the terminal scrolled to the newest output.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [log])

  const runCommand = async (raw: string) => {
    const c = raw.trim()
    if (!c || runMut.isPending) return
    setHistory((h) => [c, ...h.filter((x) => x !== c)])
    setHistIdx(-1)
    setCmd('')
    const idx = log.length
    setLog((l) => [...l, { cmd: c, pending: true }])
    try {
      const result = await runMut.mutateAsync(c)
      setLog((l) => l.map((e2, i) => (i === idx ? { cmd: c, result } : e2)))
    } catch (err) {
      setLog((l) =>
        l.map((e2, i) =>
          i === idx ? { cmd: c, error: err instanceof Error ? err.message : 'Command failed' } : e2,
        ),
      )
    }
  }

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    runCommand(cmd)
  }

  // Up/down arrows walk the command history (newest first).
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!history.length) return
      const ni = Math.min(histIdx + 1, history.length - 1)
      setHistIdx(ni)
      setCmd(history[ni] ?? '')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const ni = histIdx - 1
      if (ni < 0) {
        setHistIdx(-1)
        setCmd('')
      } else {
        setHistIdx(ni)
        setCmd(history[ni] ?? '')
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 mb-0">
          <DialogTitle className="text-headline-sm flex items-center gap-2">
            <Icon name="terminal" className="text-primary" />
            Pi Shell — {player.name}
            <span
              className={cn(
                'ml-2 text-label-caps uppercase px-2 py-0.5 rounded border',
                player.isConnected
                  ? 'text-status-online border-status-online/30 bg-status-online/10'
                  : 'text-status-offline border-status-offline/30 bg-status-offline/10',
              )}
            >
              {player.isConnected ? 'Online' : 'Offline'}
            </span>
          </DialogTitle>
          <DialogDescription className="text-body-sm">
            Run a shell command on the player. ↑/↓ recall previous commands.
            {!player.isConnected && ' Player is offline — commands will time out.'}
          </DialogDescription>
        </DialogHeader>

        {/* Quick actions */}
        <div className="mx-6 mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => tvMut.mutate(false)}
            disabled={tvMut.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-label-caps uppercase transition-colors disabled:opacity-50 bg-status-online/10 text-status-online border-status-online/30 hover:bg-status-online/20"
          >
            <Icon name="power_settings_new" size={16} />
            TV On
          </button>
          <button
            type="button"
            onClick={() => tvMut.mutate(true)}
            disabled={tvMut.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-label-caps uppercase transition-colors disabled:opacity-50 bg-surface-container text-text-muted border-border-industrial hover:text-text-vibrant hover:bg-surface-container-high"
          >
            <Icon name="power_off" size={16} />
            TV Off
          </button>
          <button
            type="button"
            onClick={() => runCommand('sudo reboot')}
            disabled={runMut.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-label-caps uppercase transition-colors disabled:opacity-50 bg-status-syncing/10 text-status-syncing border-status-syncing/30 hover:bg-status-syncing/20"
          >
            <Icon name="restart_alt" size={16} />
            Reboot
          </button>
          <div className="w-px h-5 bg-border-industrial" />
          <button
            type="button"
            onClick={() => runCommand(LOG_CMD)}
            disabled={runMut.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-label-caps uppercase transition-colors disabled:opacity-50 bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
          >
            <Icon name="description" size={16} />
            Show Logs
          </button>
          {tvMsg && <span className="text-body-sm text-text-muted ml-1">{tvMsg}</span>}
        </div>

        {/* Terminal output */}
        <div
          ref={scrollRef}
          className="mx-6 h-72 overflow-y-auto bg-surface-container-lowest border border-border-industrial rounded-industrial p-3 font-mono text-[12px] leading-relaxed"
        >
          {log.length === 0 ? (
            <p className="text-text-muted">Type a command below and press Execute.</p>
          ) : (
            log.map((entry, i) => (
              <div key={i} className="mb-2">
                <div className="text-primary">
                  <span className="text-text-muted">$</span> {entry.cmd}
                </div>
                {entry.pending && (
                  <div className="text-text-muted flex items-center gap-1">
                    <Icon name="progress_activity" size={12} className="animate-spin" />
                    waiting for player…
                  </div>
                )}
                {entry.error && <pre className="text-status-offline whitespace-pre-wrap">{entry.error}</pre>}
                {entry.result?.err && (
                  <pre className="text-status-offline whitespace-pre-wrap">{entry.result.err}</pre>
                )}
                {entry.result?.stdout && (
                  <pre className="text-text-vibrant whitespace-pre-wrap">{entry.result.stdout}</pre>
                )}
                {entry.result?.stderr && (
                  <pre className="text-status-syncing whitespace-pre-wrap">{entry.result.stderr}</pre>
                )}
                {entry.result &&
                  !entry.result.err &&
                  !entry.result.stdout &&
                  !entry.result.stderr && <div className="text-text-muted italic">(no output)</div>}
              </div>
            ))
          )}
        </div>

        {/* Prompt */}
        <form onSubmit={submit} className="px-6 py-5">
          <div className="flex items-center gap-2 bg-surface-container-low border border-border-industrial rounded-industrial px-3 focus-within:border-primary transition-colors">
            <span className="text-primary font-mono">$</span>
            <input
              ref={inputRef}
              value={cmd}
              onChange={(e) => setCmd(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="e.g. uptime"
              spellCheck={false}
              autoComplete="off"
              className="flex-1 bg-transparent border-none py-2.5 font-mono text-body-sm text-text-vibrant focus:outline-none placeholder:text-text-muted"
            />
            <button
              type="submit"
              disabled={!cmd.trim() || runMut.isPending}
              className="px-5 py-1.5 bg-primary text-on-primary rounded text-label-caps uppercase font-bold hover:bg-primary-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {runMut.isPending ? 'Running…' : 'Execute'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
