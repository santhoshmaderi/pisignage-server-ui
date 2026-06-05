import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Icon } from '@/components/Icon'
import { cn } from '@/lib/utils'
import {
  buildGroupPlaylists,
  collectGroupAssets,
  deployGroup,
  fetchGroups,
  playlistRefName,
  type Group,
} from '@/lib/groups'
import { fetchPlaylists } from '@/lib/playlists'

type RowStatus = 'idle' | 'pending' | 'ok' | 'error'
type Result = { status: RowStatus; error?: string }

function hasPlaylist(g: Group): boolean {
  return (g.playlists ?? []).some((p) => playlistRefName(p))
}

export function DeployContentDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const groupsQuery = useQuery({ queryKey: ['groups'], queryFn: fetchGroups, enabled: open })
  const playlistsQuery = useQuery({ queryKey: ['playlists'], queryFn: fetchPlaylists, enabled: open })

  const groups = groupsQuery.data ?? []
  const eligible = useMemo(() => groups.filter(hasPlaylist), [groups])
  const skipped = useMemo(() => groups.filter((g) => !hasPlaylist(g)), [groups])

  const [results, setResults] = useState<Record<string, Result>>({})
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)

  // Reset state each time the dialog opens.
  useEffect(() => {
    if (open) {
      setResults({})
      setRunning(false)
      setDone(false)
    }
  }, [open])

  const deployAll = async () => {
    setRunning(true)
    setDone(false)
    setResults(Object.fromEntries(eligible.map((g) => [g._id, { status: 'pending' as RowStatus }])))
    const playlists = playlistsQuery.data ?? []
    for (const g of eligible) {
      try {
        await deployGroup(g._id, {
          assets: collectGroupAssets(g, playlists),
          playlists: buildGroupPlaylists(g, playlists),
        })
        setResults((r) => ({ ...r, [g._id]: { status: 'ok' } }))
      } catch (e) {
        setResults((r) => ({
          ...r,
          [g._id]: { status: 'error', error: e instanceof Error ? e.message : 'Deploy failed' },
        }))
      }
    }
    setRunning(false)
    setDone(true)
    queryClient.invalidateQueries({ queryKey: ['groups'] })
  }

  const okCount = Object.values(results).filter((r) => r.status === 'ok').length
  const errCount = Object.values(results).filter((r) => r.status === 'error').length

  return (
    <Dialog open={open} onOpenChange={(o) => !running && onOpenChange(o)}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <DialogHeader className="px-8 pt-8 pb-4 mb-0">
          <DialogTitle className="text-headline-md flex items-center gap-3">
            <Icon name="send" className="text-primary" />
            Deploy Content
          </DialogTitle>
          <DialogDescription className="text-body-sm">
            Push each group's playlists, assets and ticker to its players. Only groups that have a
            playlist assigned are deployed.
          </DialogDescription>
        </DialogHeader>
        <hr className="border-border-industrial/50 mx-8" />

        <div className="px-8 py-6 space-y-4 max-h-[55vh] overflow-y-auto">
          {groupsQuery.isLoading ? (
            <p className="text-body-sm text-text-muted">Loading groups…</p>
          ) : groupsQuery.isError ? (
            <p className="text-body-sm text-status-offline">
              {groupsQuery.error instanceof Error ? groupsQuery.error.message : 'Failed to load groups'}
            </p>
          ) : eligible.length === 0 ? (
            <div className="p-4 border border-dashed border-border-industrial rounded-lg bg-surface/30 text-body-sm text-text-muted">
              No groups have a playlist assigned, so there's nothing to deploy. Assign a default
              playlist to a group first.
            </div>
          ) : (
            <>
              <ul className="space-y-2">
                {eligible.map((g) => {
                  const r = results[g._id]?.status ?? 'idle'
                  return (
                    <li
                      key={g._id}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border border-border-industrial bg-surface-container-low"
                    >
                      <span className="flex items-center gap-2 text-body-md text-text-vibrant min-w-0">
                        <Icon name="group_work" size={16} className="text-text-muted shrink-0" />
                        <span className="truncate">{g.name}</span>
                      </span>
                      <StatusChip status={r} error={results[g._id]?.error} />
                    </li>
                  )
                })}
              </ul>
              {skipped.length > 0 && (
                <p className="text-body-sm text-text-muted">
                  {skipped.length} group{skipped.length === 1 ? '' : 's'} skipped (no playlist
                  assigned).
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-surface-container-high px-8 py-5 flex items-center justify-between gap-4 border-t border-border-industrial">
          <span className="text-body-sm" aria-live="polite">
            {running ? (
              <span className="text-text-muted">Deploying…</span>
            ) : done ? (
              <span className={cn(errCount ? 'text-status-syncing' : 'text-status-online')}>
                {okCount} deployed{errCount ? `, ${errCount} failed` : ''}
              </span>
            ) : (
              <span className="text-text-muted">
                {eligible.length} group{eligible.length === 1 ? '' : 's'} ready
              </span>
            )}
          </span>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={running}
              className="px-6 py-2 border border-border-industrial text-text-muted hover:bg-surface-container-high rounded text-label-caps uppercase transition-colors disabled:opacity-50"
            >
              {done ? 'Close' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={deployAll}
              disabled={running || eligible.length === 0}
              className="px-8 py-2 bg-primary text-on-primary hover:bg-primary-container rounded text-label-caps uppercase font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {running
                ? 'Deploying…'
                : done
                ? 'Deploy again'
                : `Deploy to ${eligible.length} group${eligible.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function StatusChip({ status, error }: { status: RowStatus; error?: string }) {
  if (status === 'pending') {
    return (
      <span className="flex items-center gap-1 text-body-sm text-text-muted shrink-0">
        <Icon name="progress_activity" size={16} className="animate-spin" />
        Deploying
      </span>
    )
  }
  if (status === 'ok') {
    return (
      <span className="flex items-center gap-1 text-body-sm text-status-online shrink-0">
        <Icon name="check_circle" size={16} />
        Deployed
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="flex items-center gap-1 text-body-sm text-status-offline shrink-0" title={error}>
        <Icon name="error" size={16} />
        {error ?? 'Failed'}
      </span>
    )
  }
  return null
}
