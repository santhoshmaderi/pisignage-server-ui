import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/Icon'
import { StatusBadge, type PlayerStatus } from '@/components/StatusBadge'
import { cn } from '@/lib/utils'
import { loadAuthHeader } from '@/lib/auth'
import { usePlayerStatusSocket } from '@/lib/socket'
import { countPlayers, fetchPlayers, type Player } from '@/lib/players'

export function Dashboard() {
  const queryClient = useQueryClient()
  const authHeader = loadAuthHeader()

  const { data: players = [], isLoading, isError, error, dataUpdatedAt } = useQuery({
    queryKey: ['players'],
    queryFn: fetchPlayers,
    refetchInterval: 30_000,
  })

  const { connected, lastEvent } = usePlayerStatusSocket(authHeader)

  // Whenever a live status event arrives, invalidate the players query so
  // counts/cards reflect the change. Cheap: react-query dedupes & caches.
  useEffect(() => {
    if (lastEvent) queryClient.invalidateQueries({ queryKey: ['players'] })
  }, [lastEvent, queryClient])

  const counts = useMemo(() => countPlayers(players), [players])
  const onlinePct = counts.total ? (counts.online / counts.total) * 100 : 0
  const offlinePct = counts.total ? (counts.offline / counts.total) * 100 : 0

  const recentPlayers = useMemo(
    () =>
      [...players]
        .sort((a, b) => (a.isConnected === b.isConnected ? 0 : a.isConnected ? -1 : 1))
        .slice(0, 4),
    [players],
  )

  return (
    <>
      <PageHeader connected={connected} lastUpdatedAt={dataUpdatedAt} />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="col-span-1 md:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Players"
            value={isLoading ? '—' : counts.total.toLocaleString()}
            icon="devices"
          />
          <StatCard
            label="Online"
            value={isLoading ? '—' : counts.online.toLocaleString()}
            footnote={counts.total ? `${onlinePct.toFixed(1)}%` : undefined}
            tone="online"
            icon="wifi"
          />
          <StatCard
            label="Offline / Error"
            value={isLoading ? '—' : counts.offline.toLocaleString()}
            footnote={counts.total ? `${offlinePct.toFixed(1)}%` : undefined}
            tone="offline"
            icon="wifi_off"
          />
          <StatCard
            label="Active Playlists"
            value={isLoading ? '—' : countActivePlaylists(players).toString()}
            icon="queue_music"
          />
        </div>

        <Card className="col-span-1 md:col-span-4 p-5 flex flex-col">
          <SectionHeader label="Fleet Health Status" />
          <div className="mt-auto space-y-4 w-full pt-4">
            <div className="h-4 w-full flex rounded overflow-hidden bg-surface-container">
              <div className="bg-status-online h-full" style={{ width: `${onlinePct}%` }} />
              <div className="bg-status-offline h-full" style={{ width: `${offlinePct}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-2 font-mono text-xs">
              <LegendDot tone="online" label={`${counts.online} healthy`} />
              <LegendDot tone="syncing" label="0 syncing" />
              <LegendDot tone="offline" label={`${counts.offline} critical`} />
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Icon name="live_tv" className="text-status-syncing animate-pulse" />
            <span className="text-headline-sm text-text-vibrant">Live Content Telemetry</span>
          </div>
          <a
            href="/players"
            className="text-body-sm text-primary hover:text-primary-fixed transition-colors flex items-center gap-1"
          >
            View All Terminals
            <Icon name="arrow_forward" size={16} />
          </a>
        </div>

        {isError ? (
          <ErrorBlock error={error} />
        ) : isLoading ? (
          <SkeletonPlayerGrid />
        ) : recentPlayers.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {recentPlayers.map((player) => (
              <PlayerCard key={player._id} player={player} />
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex justify-between items-center mb-4 border-b border-border-industrial pb-3">
          <SectionHeader label="System Event Log" />
          <span className="text-data-mono text-text-muted">
            No event stream wired yet
          </span>
        </div>
        <p className="text-body-sm text-text-muted">
          pisignage-server does not yet expose a structured event log endpoint. When one
          lands, this panel will tail it. For now, refer to the player cards above for
          live status changes.
        </p>
      </Card>
    </>
  )
}

function PageHeader({
  connected,
  lastUpdatedAt,
}: {
  connected: boolean
  lastUpdatedAt: number
}) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [])
  const relative = useMemo(() => formatRelative(lastUpdatedAt, now), [lastUpdatedAt, now])

  return (
    <div className="flex items-end justify-between mb-2">
      <div>
        <h2 className="text-headline-lg text-text-vibrant">System Overview</h2>
        <p className="text-body-md text-text-muted mt-1">
          Real-time telemetry and content deployment status.
        </p>
      </div>
      <div className="font-mono text-data-mono text-text-muted flex items-center gap-2">
        <span
          className={cn(
            'w-2 h-2 rounded-full',
            connected ? 'bg-status-online animate-pulse' : 'bg-status-offline',
          )}
        />
        {connected ? `Last updated: ${relative}` : 'Realtime offline'}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  footnote,
  tone,
  icon,
}: {
  label: string
  value: string
  footnote?: string
  tone?: 'online' | 'offline'
  icon: string
}) {
  const accent =
    tone === 'online'
      ? 'hover:border-status-online'
      : tone === 'offline'
      ? 'hover:border-status-offline'
      : 'hover:border-outline-variant'
  const footnoteClass =
    tone === 'online'
      ? 'text-status-online'
      : tone === 'offline'
      ? 'text-status-offline'
      : 'text-text-muted'
  const iconClass =
    tone === 'online'
      ? 'text-status-online'
      : tone === 'offline'
      ? 'text-status-offline'
      : 'text-text-muted group-hover:text-primary transition-colors'

  return (
    <Card className={cn('p-4 flex flex-col justify-between group relative overflow-hidden', accent)}>
      {tone && (
        <div
          className={cn(
            'absolute bottom-0 left-0 w-full h-1',
            tone === 'online' ? 'bg-status-online/20' : 'bg-status-offline/20',
          )}
        />
      )}
      <div className="flex justify-between items-start">
        <span className="text-label-caps text-text-muted uppercase tracking-wider">
          {label}
        </span>
        <Icon name={icon} className={iconClass} />
      </div>
      <div className="mt-4 flex items-end gap-2">
        <span className="text-headline-lg text-text-vibrant">{value}</span>
        {footnote && (
          <span className={cn('text-body-sm mb-1 font-bold', footnoteClass)}>{footnote}</span>
        )}
      </div>
    </Card>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <span className="text-label-caps text-text-muted uppercase tracking-wider">{label}</span>
  )
}

function LegendDot({ tone, label }: { tone: PlayerStatus; label: string }) {
  const color =
    tone === 'online'
      ? 'bg-status-online'
      : tone === 'offline'
      ? 'bg-status-offline'
      : 'bg-status-syncing'
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn('w-2 h-2 rounded-full', color)} />
      <span className="text-text-vibrant">{label}</span>
    </div>
  )
}

function PlayerCard({ player }: { player: Player }) {
  const status: PlayerStatus = player.isConnected ? 'online' : 'offline'
  const borderClass =
    status === 'offline' ? 'border-status-offline/50' : 'border-border-industrial hover:border-primary/50'

  return (
    <div className={cn('bg-surface border-2 rounded-industrial flex flex-col group overflow-hidden transition-colors', borderClass)}>
      <div className="relative aspect-video bg-black overflow-hidden flex items-center justify-center">
        {status === 'offline' ? (
          <Icon name="warning" className="text-status-offline/50" size={32} />
        ) : (
          <div className="w-full h-full bg-surface-container-high flex items-center justify-center">
            <Icon name="play_circle" className="text-text-muted/30" size={48} />
          </div>
        )}
        <div className="absolute top-2 right-2">
          <StatusBadge status={status} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent opacity-60 pointer-events-none" />
      </div>
      <div className="p-3 flex flex-col gap-2">
        <span className="text-body-md font-bold text-text-vibrant truncate">{player.name}</span>
        <div className="font-mono text-[11px] text-text-muted flex justify-between gap-2">
          <span className="truncate">PL: {player.currentPlaylist || '—'}</span>
          <span className="truncate">{player.myIpAddress || '—'}</span>
        </div>
      </div>
    </div>
  )
}

function ErrorBlock({ error }: { error: unknown }) {
  const message =
    error instanceof Error ? error.message : 'Unable to reach pisignage-server at /api/players'
  return (
    <div className="flex items-center gap-3 p-4 rounded-industrial border border-status-offline/30 bg-status-offline/10">
      <Icon name="cloud_off" className="text-status-offline" />
      <div>
        <p className="text-body-md text-text-vibrant">Backend unreachable</p>
        <p className="text-body-sm text-text-muted font-mono">{message}</p>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center p-10 text-center gap-2">
      <Icon name="devices_other" className="text-text-muted/50" size={48} />
      <p className="text-body-md text-text-vibrant">No players registered yet</p>
      <p className="text-body-sm text-text-muted">
        Pair a player from <span className="font-mono text-primary">/api/players</span> to see it here.
      </p>
    </div>
  )
}

function SkeletonPlayerGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="bg-surface border-2 border-border-industrial rounded-industrial overflow-hidden animate-pulse"
        >
          <div className="aspect-video bg-surface-container" />
          <div className="p-3 space-y-2">
            <div className="h-3 bg-surface-container rounded w-2/3" />
            <div className="h-2 bg-surface-container rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

function countActivePlaylists(players: Player[]): number {
  const set = new Set<string>()
  for (const p of players) {
    if (p.currentPlaylist) set.add(p.currentPlaylist)
  }
  return set.size
}

function formatRelative(then: number, now: number): string {
  if (!then) return 'never'
  const diffSec = Math.round((now - then) / 1000)
  if (diffSec < 5) return 'just now'
  if (diffSec < 60) return `${diffSec}s ago`
  const min = Math.round(diffSec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  return `${hr}h ago`
}
