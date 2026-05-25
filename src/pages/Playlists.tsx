import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
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
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Icon } from '@/components/Icon'
import { createPlaylist, deletePlaylist, fetchPlaylists, type PlaylistSummary } from '@/lib/playlists'
import { findLayout } from '@/lib/layouts'

export function Playlists() {
  const queryClient = useQueryClient()
  const playlistsQuery = useQuery({ queryKey: ['playlists'], queryFn: fetchPlaylists })

  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PlaylistSummary | null>(null)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['playlists'] })

  const deleteMut = useMutation({
    mutationFn: (name: string) => deletePlaylist(name),
    onSuccess: () => {
      invalidate()
      setDeleteTarget(null)
    },
  })

  return (
    <>
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-headline-lg text-text-vibrant">Playlists</h2>
          <p className="text-body-md text-text-muted mt-1">
            {playlistsQuery.isLoading
              ? 'Loading…'
              : `${playlistsQuery.data?.length ?? 0} playlists`}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Icon name="add" size={18} />
          New Playlist
        </Button>
      </div>

      {playlistsQuery.isError ? (
        <ErrorBlock error={playlistsQuery.error} />
      ) : playlistsQuery.isLoading ? (
        <SkeletonGrid />
      ) : (playlistsQuery.data?.length ?? 0) === 0 ? (
        <EmptyState onCreate={() => setCreateOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {playlistsQuery.data!.map((p) => (
            <PlaylistCard key={p.name} playlist={p} onDelete={() => setDeleteTarget(p)} />
          ))}
        </div>
      )}

      <CreatePlaylistDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        existingNames={new Set((playlistsQuery.data ?? []).map((p) => p.name))}
        onCreated={() => {
          invalidate()
          setCreateOpen(false)
        }}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{deleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              The playlist file is removed from disk. Players already playing it will keep
              their cached copy until they next sync from their assigned group.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              destructive
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.name)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function PlaylistCard({
  playlist,
  onDelete,
}: {
  playlist: PlaylistSummary
  onDelete: () => void
}) {
  const layout = findLayout(playlist.layout)
  return (
    <Card className="p-0 overflow-hidden hover:border-outline-variant flex flex-col">
      <Link to={`/playlists/${encodeURIComponent(playlist.name)}`} className="flex flex-col flex-1">
        <div className="p-5 flex justify-between items-start gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Icon name="view_list" className="text-primary" size={20} />
              <h3 className="text-headline-sm text-text-vibrant truncate">{playlist.name}</h3>
            </div>
            <p className="text-body-sm text-text-muted mt-1 font-mono">
              {playlist.assets?.length ?? 0}{' '}
              {playlist.assets?.length === 1 ? 'asset' : 'assets'}
            </p>
          </div>
          <div onClick={(e) => e.preventDefault()}>
            <PlaylistActions name={playlist.name} onDelete={onDelete} />
          </div>
        </div>

        <div className="px-5 pb-5">
          <div className="aspect-video bg-surface-container-lowest border border-border-industrial rounded-industrial p-3 relative">
            {/* Mini layout diagram */}
            <div className="relative w-full h-full">
              {layout.zones.map((z, i) => (
                <div
                  key={i}
                  className="absolute border border-primary/30 bg-primary/5"
                  style={{
                    left: `${z.x * 100}%`,
                    top: `${z.y * 100}%`,
                    width: `${z.w * 100}%`,
                    height: `${z.h * 100}%`,
                  }}
                />
              ))}
            </div>
            <span className="absolute bottom-1 right-2 font-mono text-[10px] text-text-muted">
              {layout.name}
            </span>
          </div>
        </div>
      </Link>
    </Card>
  )
}

function PlaylistActions({ name, onDelete }: { name: string; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Actions for ${name}`}
          className="text-text-muted hover:text-text-vibrant p-1 rounded-industrial hover:bg-surface-container transition-colors"
        >
          <Icon name="more_vert" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            to={`/playlists/${encodeURIComponent(name)}`}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Icon name="edit" size={16} />
            Edit
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={onDelete}>
          <Icon name="delete" size={16} />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function CreatePlaylistDialog({
  open,
  onOpenChange,
  existingNames,
  onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  existingNames: Set<string>
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const createMut = useMutation({
    mutationFn: (n: string) => createPlaylist(n),
    onSuccess: () => {
      setName('')
      setError(null)
      onCreated()
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : 'Failed to create playlist'),
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setError('Name is required.')
    if (!/^[A-Za-z0-9_\- ]+$/.test(trimmed))
      return setError('Only letters, numbers, spaces, dashes, and underscores.')
    if (existingNames.has(trimmed))
      return setError('A playlist with that name already exists.')
    setError(null)
    createMut.mutate(trimmed)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) {
          setName('')
          setError(null)
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Playlist</DialogTitle>
          <DialogDescription>
            Pisignage stores playlists as JSON files on disk, so the name will become the
            filename. Pick something descriptive and URL-safe.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-label-caps text-text-muted uppercase">Name</span>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lobby_Welcome"
            />
          </label>
          {error != null && (
            <p className="text-body-sm text-status-offline" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={createMut.isPending}>
              {createMut.isPending ? 'Creating…' : 'Create Playlist'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ErrorBlock({ error }: { error: unknown }) {
  const msg =
    error instanceof Error ? error.message : 'Unable to reach pisignage-server at /api/playlists'
  return (
    <Card className="p-5 flex items-center gap-3 border-status-offline/30 bg-status-offline/10">
      <Icon name="cloud_off" className="text-status-offline" />
      <div>
        <p className="text-body-md text-text-vibrant">Backend unreachable</p>
        <p className="text-body-sm text-text-muted font-mono">{msg}</p>
      </div>
    </Card>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card className="p-10 flex flex-col items-center justify-center text-center gap-3">
      <Icon name="view_list" className="text-text-muted/50" size={48} />
      <p className="text-body-md text-text-vibrant">No playlists yet</p>
      <p className="text-body-sm text-text-muted max-w-sm">
        A playlist sequences assets into zones and pushes them to a group of players.
      </p>
      <Button onClick={onCreate} className="mt-2">
        <Icon name="add" size={18} />
        Create First Playlist
      </Button>
    </Card>
  )
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="p-5 animate-pulse space-y-4">
          <div className="h-5 bg-surface-container rounded w-2/3" />
          <div className="aspect-video bg-surface-container rounded" />
        </Card>
      ))}
    </div>
  )
}
