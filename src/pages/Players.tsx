import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Icon } from '@/components/Icon'
import { StatusBadge, type PlayerStatus } from '@/components/StatusBadge'
import { cn } from '@/lib/utils'
import { loadAuthHeader } from '@/lib/auth'
import { usePlayerStatusSocket } from '@/lib/socket'
import { fetchGroups } from '@/lib/groups'
import {
  deletePlayer,
  fetchPlayers,
  playerGroupId,
  playerGroupName,
  requestSnapshot,
  runShell,
  triggerUpdate,
  type Player,
} from '@/lib/players'

type StatusFilter = 'all' | 'online' | 'offline'

export function Players() {
  const queryClient = useQueryClient()
  const authHeader = loadAuthHeader()

  const playersQuery = useQuery({ queryKey: ['players'], queryFn: fetchPlayers, refetchInterval: 30_000 })
  const groupsQuery = useQuery({ queryKey: ['groups'], queryFn: fetchGroups, staleTime: 60_000 })

  const { lastEvent } = usePlayerStatusSocket(authHeader)
  useEffect(() => {
    if (lastEvent) queryClient.invalidateQueries({ queryKey: ['players'] })
  }, [lastEvent, queryClient])

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [groupFilter, setGroupFilter] = useState<string>('all')

  const groupNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of groupsQuery.data ?? []) m.set(g._id, g.name)
    return m
  }, [groupsQuery.data])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (playersQuery.data ?? []).filter((p) => {
      if (statusFilter === 'online' && !p.isConnected) return false
      if (statusFilter === 'offline' && p.isConnected) return false
      if (groupFilter !== 'all' && playerGroupId(p) !== groupFilter) return false
      if (term) {
        const hay = `${p.name} ${p.myIpAddress ?? ''} ${p.cpuSerialNumber} ${playerGroupName(p, groupNameById)}`.toLowerCase()
        if (!hay.includes(term)) return false
      }
      return true
    })
  }, [playersQuery.data, search, statusFilter, groupFilter, groupNameById])

  return (
    <>
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-headline-lg text-text-vibrant">Players</h2>
          <p className="text-body-md text-text-muted mt-1">
            {playersQuery.isLoading
              ? 'Loading fleet…'
              : `${filtered.length} of ${playersQuery.data?.length ?? 0} terminals shown`}
          </p>
        </div>
        <Button variant="outline">
          <Icon name="add" size={18} />
          Register Player
        </Button>
      </div>

      <Toolbar
        search={search}
        onSearch={setSearch}
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
        groupFilter={groupFilter}
        onGroupFilter={setGroupFilter}
        groups={groupsQuery.data ?? []}
      />

      {playersQuery.isError ? (
        <ErrorBlock error={playersQuery.error} />
      ) : playersQuery.isLoading ? (
        <SkeletonGrid />
      ) : filtered.length === 0 ? (
        <EmptyState hasAny={(playersQuery.data?.length ?? 0) > 0} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p) => (
            <PlayerCard key={p._id} player={p} groupNameById={groupNameById} />
          ))}
        </div>
      )}
    </>
  )
}

function Toolbar({
  search,
  onSearch,
  statusFilter,
  onStatusFilter,
  groupFilter,
  onGroupFilter,
  groups,
}: {
  search: string
  onSearch: (v: string) => void
  statusFilter: StatusFilter
  onStatusFilter: (v: StatusFilter) => void
  groupFilter: string
  onGroupFilter: (v: string) => void
  groups: { _id: string; name: string }[]
}) {
  return (
    <Card className="p-3 flex flex-wrap gap-3 items-center">
      <div className="relative flex-1 min-w-[240px] max-w-md">
        <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search name, IP, group…"
          className="pl-10"
        />
      </div>

      <div className="relative">
        <select
          value={groupFilter}
          onChange={(e) => onGroupFilter(e.target.value)}
          className="appearance-none h-9 bg-canvas-depth-1 border border-border-industrial rounded-industrial pl-3 pr-9 text-body-sm text-text-vibrant focus:outline-none focus:border-primary"
        >
          <option value="all">All Groups</option>
          {groups.map((g) => (
            <option key={g._id} value={g._id}>
              {g.name}
            </option>
          ))}
        </select>
        <Icon
          name="arrow_drop_down"
          size={20}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
        />
      </div>

      <SegmentedFilter value={statusFilter} onChange={onStatusFilter} />
    </Card>
  )
}

function SegmentedFilter({
  value,
  onChange,
}: {
  value: StatusFilter
  onChange: (v: StatusFilter) => void
}) {
  const options: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'online', label: 'Online' },
    { value: 'offline', label: 'Offline' },
  ]
  return (
    <div className="flex bg-canvas-depth-1 rounded-industrial border border-border-industrial p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 h-7 rounded text-body-sm transition-colors',
            value === opt.value
              ? 'bg-surface-variant text-text-vibrant'
              : 'text-text-muted hover:text-text-vibrant',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function PlayerCard({
  player,
  groupNameById,
}: {
  player: Player
  groupNameById: Map<string, string>
}) {
  const status: PlayerStatus = player.isConnected ? 'online' : 'offline'
  const borderClass =
    status === 'offline'
      ? 'border-status-offline/30 hover:border-status-offline/60'
      : 'border-border-industrial hover:border-outline-variant'
  const groupName = playerGroupName(player, groupNameById)

  return (
    <Card className={cn('p-0 overflow-hidden flex flex-col group', borderClass)}>
      <div className="p-4 flex justify-between items-start gap-2">
        <div className="min-w-0">
          <h3 className="text-headline-sm text-text-vibrant truncate">{player.name}</h3>
          <p className="text-body-sm text-text-muted flex items-center gap-1 mt-1 truncate">
            <Icon name="folder" size={14} />
            {groupName}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={status} />
          <PlayerActions player={player} />
        </div>
      </div>

      <PlayerThumbnail player={player} status={status} />

      <div className="p-4 mt-auto flex flex-col gap-1.5 font-mono text-[12px] text-text-muted">
        <div className="flex justify-between gap-2">
          <span className="truncate">IP: {player.myIpAddress ?? '—'}</span>
          <span className="truncate">V: {player.version ?? '—'}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="truncate">SN: {player.cpuSerialNumber.slice(-12)}</span>
          <span className="truncate">
            PL: {player.currentPlaylist || '—'}
          </span>
        </div>
        {player.labels && player.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {player.labels.slice(0, 4).map((l) => (
              <Badge key={l} tone="neutral">
                {l}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

function PlayerThumbnail({ player, status }: { player: Player; status: PlayerStatus }) {
  // pisignage stores snapshots under /media/snapshots/<id>.jpg on the server.
  // We render lazily and fall back to a placeholder if the file 404s.
  const [errored, setErrored] = useState(false)
  const src = `/media/snapshots/${player._id}.jpg`

  if (status === 'offline') {
    return (
      <div className="relative w-full aspect-video bg-surface-container-lowest border-y border-border-industrial flex flex-col items-center justify-center text-text-muted">
        <Icon name="signal_disconnected" size={40} className="opacity-50 mb-2" />
        <span className="font-mono text-[12px]">NO SIGNAL DETECTED</span>
      </div>
    )
  }

  return (
    <div className="relative w-full aspect-video bg-surface-container-lowest border-y border-border-industrial overflow-hidden">
      {errored ? (
        <div className="w-full h-full bg-surface-container-high flex items-center justify-center">
          <Icon name="play_circle" className="text-text-muted/30" size={48} />
        </div>
      ) : (
        <img
          src={src}
          alt={`${player.name} preview`}
          loading="lazy"
          onError={() => setErrored(true)}
          className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
        />
      )}
      {player.currentPlaylist && (
        <div className="absolute bottom-2 left-2 bg-canvas-depth-2/80 backdrop-blur px-2 py-1 rounded-industrial font-mono text-[11px] text-text-vibrant border border-outline-variant/50 flex items-center gap-1">
          <Icon name="play_circle" size={12} />
          {player.currentPlaylist}
        </div>
      )}
    </div>
  )
}

function PlayerActions({ player }: { player: Player }) {
  const queryClient = useQueryClient()
  const [pendingConfirm, setPendingConfirm] = useState<
    null | { kind: 'restart' | 'delete' | 'update'; label: string }
  >(null)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['players'] })

  const snapshotMut = useMutation({ mutationFn: () => requestSnapshot(player._id) })
  const updateMut = useMutation({ mutationFn: () => triggerUpdate(player._id) })
  const restartMut = useMutation({
    mutationFn: () => runShell(player._id, 'sudo reboot'),
  })
  const deleteMut = useMutation({
    mutationFn: () => deletePlayer(player._id),
    onSuccess: invalidate,
  })

  const runConfirmed = () => {
    if (!pendingConfirm) return
    const kind = pendingConfirm.kind
    setPendingConfirm(null)
    if (kind === 'restart') restartMut.mutate()
    else if (kind === 'update') updateMut.mutate()
    else if (kind === 'delete') deleteMut.mutate()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Actions for ${player.name}`}
            className="text-text-muted hover:text-text-vibrant p-1 rounded-industrial hover:bg-surface-container transition-colors"
          >
            <Icon name="more_vert" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{player.name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => snapshotMut.mutate()}
            disabled={!player.isConnected}
          >
            <Icon name="photo_camera" size={16} />
            Refresh Snapshot
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setPendingConfirm({ kind: 'update', label: 'Update Firmware' })}
            disabled={!player.isConnected}
          >
            <Icon name="system_update_alt" size={16} />
            Update Firmware
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setPendingConfirm({ kind: 'restart', label: 'Restart Player' })}
            disabled={!player.isConnected}
          >
            <Icon name="restart_alt" size={16} />
            Restart
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            destructive
            onSelect={() => setPendingConfirm({ kind: 'delete', label: 'Remove from Console' })}
          >
            <Icon name="delete" size={16} />
            Delete Player
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={pendingConfirm !== null}
        onOpenChange={(open) => !open && setPendingConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingConfirm?.label}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingConfirm?.kind === 'delete'
                ? `Remove "${player.name}" from this console. The player itself will not be wiped, but it will need to re-register to appear here again.`
                : pendingConfirm?.kind === 'restart'
                ? `Issue "sudo reboot" on ${player.name}. The display will be dark for ~30s.`
                : `Trigger a software update on ${player.name}. The player will restart when the update completes.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              destructive={pendingConfirm?.kind === 'delete'}
              onClick={runConfirmed}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function ErrorBlock({ error }: { error: unknown }) {
  const message =
    error instanceof Error ? error.message : 'Unable to reach pisignage-server at /api/players'
  return (
    <Card className="p-5 flex items-center gap-3 border-status-offline/30 bg-status-offline/10">
      <Icon name="cloud_off" className="text-status-offline" />
      <div>
        <p className="text-body-md text-text-vibrant">Backend unreachable</p>
        <p className="text-body-sm text-text-muted font-mono">{message}</p>
      </div>
    </Card>
  )
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <Card className="p-10 flex flex-col items-center justify-center text-center gap-2">
      <Icon name="devices_other" className="text-text-muted/50" size={48} />
      <p className="text-body-md text-text-vibrant">
        {hasAny ? 'No players match the current filters' : 'No players registered yet'}
      </p>
      <p className="text-body-sm text-text-muted">
        {hasAny
          ? 'Clear the search or status filter to widen the view.'
          : 'Pair a player to your server to see it appear here.'}
      </p>
    </Card>
  )
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="p-0 overflow-hidden animate-pulse">
          <div className="p-4 space-y-2">
            <div className="h-4 bg-surface-container rounded w-2/3" />
            <div className="h-3 bg-surface-container rounded w-1/3" />
          </div>
          <div className="aspect-video bg-surface-container" />
          <div className="p-4 space-y-2">
            <div className="h-2 bg-surface-container rounded w-1/2" />
            <div className="h-2 bg-surface-container rounded w-2/3" />
          </div>
        </Card>
      ))}
    </div>
  )
}
