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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Icon } from '@/components/Icon'
import { StatusBadge, type PlayerStatus } from '@/components/StatusBadge'
import { PiShellDialog } from '@/components/PiShellDialog'
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
  updatePlayer,
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
            <PlayerCard
              key={p._id}
              player={p}
              groupNameById={groupNameById}
              groups={groupsQuery.data ?? []}
            />
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
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-1 rounded-full text-label-caps uppercase tracking-wider border transition-colors',
            value === opt.value
              ? 'border-primary text-primary bg-primary/10'
              : 'border-border-industrial text-text-muted hover:border-outline-variant hover:text-text-vibrant',
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
  groups,
}: {
  player: Player
  groupNameById: Map<string, string>
  groups: { _id: string; name: string }[]
}) {
  const status: PlayerStatus = player.isConnected ? 'online' : 'offline'
  const borderClass =
    status === 'offline'
      ? 'border-status-offline/30 hover:border-status-offline/60'
      : 'border-border-industrial hover:border-outline-variant'
  const groupName = playerGroupName(player, groupNameById)
  // Bumped when a snapshot is taken so the thumbnail reloads the new image.
  const [snapNonce, setSnapNonce] = useState(0)
  const [shellOpen, setShellOpen] = useState(false)

  const statusText = player.syncInProgress ? 'Updating' : player.isConnected ? 'Active' : 'Offline'
  const statusTone = player.syncInProgress
    ? 'text-status-syncing'
    : player.isConnected
    ? 'text-status-online'
    : 'text-text-muted'

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
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setShellOpen(true)}
            title="Open Pi Shell"
            aria-label={`Open terminal for ${player.name}`}
            className="text-text-muted hover:text-primary p-1 rounded-industrial hover:bg-surface-container transition-colors"
          >
            <Icon name="terminal" size={18} />
          </button>
          <StatusBadge status={status} />
          <PlayerActions
            player={player}
            groups={groups}
            onSnapshot={() => setSnapNonce((n) => n + 1)}
          />
        </div>
      </div>

      <PlayerThumbnail player={player} status={status} refreshKey={snapNonce} />

      <div className="p-4 mt-auto flex flex-col gap-1.5 font-mono text-[12px] text-text-muted">
        <div className="flex justify-between gap-2">
          <span className="truncate">PL: {player.currentPlaylist || '—'}</span>
          <span className={cn('truncate shrink-0', statusTone)}>{statusText}</span>
        </div>
        <div className="truncate" title={player.cpuSerialNumber}>
          ID: {formatPlayerId(player.cpuSerialNumber)}
        </div>
        <div className="flex justify-between gap-2">
          <span className="truncate">IP: {player.myIpAddress || player.ip || '—'}</span>
          <span className="truncate shrink-0">V: {player.version ?? '—'}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="truncate">MAC: {player.ethMac || player.wifiMac || '—'}</span>
          <span className="truncate shrink-0">Up: {formatUptime(player.uptime)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="truncate">Temp: {formatTemp(player.piTemperature) ?? '—'}</span>
          <span className="truncate shrink-0">Free: {player.diskSpaceAvailable || '—'}</span>
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

      <PiShellDialog player={player} open={shellOpen} onOpenChange={setShellOpen} />
    </Card>
  )
}

function PlayerThumbnail({
  player,
  status,
  refreshKey = 0,
}: {
  player: Player
  status: PlayerStatus
  refreshKey?: number
}) {
  // pisignage stores the player snapshot at
  //   /media/_thumbnails/<cpuSerialNumber>.jpeg
  // (see players.takeSnapshot on the server). The cache-buster on lastReported
  // forces a reload after a fresh snapshot is taken. We render lazily and fall
  // back to a placeholder if the file 404s (no snapshot taken yet).
  const [errored, setErrored] = useState(false)
  const src = `/media/_thumbnails/${encodeURIComponent(player.cpuSerialNumber)}.jpeg?t=${encodeURIComponent(player.lastReported ?? '')}&n=${refreshKey}`

  // Retry the image when the URL changes (e.g. after a new snapshot).
  useEffect(() => setErrored(false), [src])

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

function PlayerActions({
  player,
  groups,
  onSnapshot,
}: {
  player: Player
  groups: { _id: string; name: string }[]
  onSnapshot?: () => void
}) {
  const queryClient = useQueryClient()
  const [pendingConfirm, setPendingConfirm] = useState<
    null | { kind: 'restart' | 'delete' | 'update'; label: string }
  >(null)
  // null = closed. Rename holds the editable name; group holds the selected id.
  const [renameValue, setRenameValue] = useState<string | null>(null)
  const [groupValue, setGroupValue] = useState<string | null>(null)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['players'] })

  const renameMut = useMutation({
    mutationFn: (name: string) => updatePlayer(player._id, { name }),
    onSuccess: () => {
      invalidate()
      setRenameValue(null)
    },
  })
  const changeGroupMut = useMutation({
    mutationFn: (g: { _id: string; name: string }) => updatePlayer(player._id, { group: g }),
    onSuccess: () => {
      invalidate()
      setGroupValue(null)
    },
  })

  const snapshotMut = useMutation({
    mutationFn: () => requestSnapshot(player._id),
    // The request resolves once the player has uploaded the new screenshot (or
    // times out). Reload the player record and bump the thumbnail to show it.
    onSuccess: () => {
      invalidate()
      onSnapshot?.()
    },
  })
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
          <DropdownMenuItem onSelect={() => setRenameValue(player.name ?? '')}>
            <Icon name="edit" size={16} />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setGroupValue(playerGroupId(player) ?? '')}>
            <Icon name="move_group" size={16} />
            Change Group
          </DropdownMenuItem>
          <DropdownMenuSeparator />
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

      {/* Rename */}
      <Dialog
        open={renameValue !== null}
        onOpenChange={(o) => {
          if (!o) {
            setRenameValue(null)
            renameMut.reset()
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Player</DialogTitle>
            <DialogDescription>Set a friendly name for “{player.name}”.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const n = (renameValue ?? '').trim()
              if (n) renameMut.mutate(n)
            }}
            className="flex flex-col gap-3"
          >
            <Input
              autoFocus
              value={renameValue ?? ''}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Player name"
            />
            {renameMut.error != null && (
              <p className="text-body-sm text-status-offline" role="alert">
                {renameMut.error instanceof Error ? renameMut.error.message : 'Rename failed'}
              </p>
            )}
            <div className="flex justify-end gap-2 mt-1">
              <Button type="button" variant="outline" onClick={() => setRenameValue(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!renameValue?.trim() || renameMut.isPending}>
                {renameMut.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change group */}
      <Dialog
        open={groupValue !== null}
        onOpenChange={(o) => {
          if (!o) {
            setGroupValue(null)
            changeGroupMut.reset()
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Group</DialogTitle>
            <DialogDescription>
              Move “{player.name}” to another group. The player re-syncs that group's content.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="relative">
              <select
                value={groupValue ?? ''}
                onChange={(e) => setGroupValue(e.target.value)}
                className="appearance-none w-full h-10 bg-canvas-depth-1 border border-border-industrial rounded-industrial pl-3 pr-9 text-body-md text-text-vibrant focus:outline-none focus:border-primary"
              >
                <option value="" disabled>
                  Select a group
                </option>
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
            {changeGroupMut.error != null && (
              <p className="text-body-sm text-status-offline" role="alert">
                {changeGroupMut.error instanceof Error ? changeGroupMut.error.message : 'Move failed'}
              </p>
            )}
            <div className="flex justify-end gap-2 mt-1">
              <Button type="button" variant="outline" onClick={() => setGroupValue(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!groupValue || groupValue === playerGroupId(player) || changeGroupMut.isPending}
                onClick={() => {
                  const g = groups.find((x) => x._id === groupValue)
                  if (g) changeGroupMut.mutate({ _id: g._id, name: g.name })
                }}
              >
                {changeGroupMut.isPending ? 'Moving…' : 'Move'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** cpuSerialNumber (16 hex chars) → grouped Player ID, e.g. 4000-0000-9e8e-1037. */
function formatPlayerId(sn: string): string {
  const s = (sn ?? '').trim()
  if (s.length < 8) return s || '—'
  return s.match(/.{1,4}/g)?.join('-') ?? s
}

/** uptime is /proc/uptime seconds-since-boot → "5m", "2h 10m", "14d 2h". */
function formatUptime(uptime?: string): string {
  if (!uptime) return '—'
  const secs = Number(uptime)
  if (!isFinite(secs) || secs <= 0) return uptime
  const m = Math.floor(secs / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${m % 60}m`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}

/** piTemperature (°C string) → "55.6°C / 132°F". */
function formatTemp(t?: string): string | null {
  if (!t) return null
  const c = parseFloat(t)
  if (!isFinite(c)) return t
  return `${c.toFixed(1)}°C / ${Math.round((c * 9) / 5 + 32)}°F`
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
