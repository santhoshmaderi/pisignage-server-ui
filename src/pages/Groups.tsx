import { useEffect, useMemo, useState, type FormEvent } from 'react'
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
import {
  createGroup,
  deleteGroup,
  deployGroup,
  fetchGroups,
  playlistRefName,
  updateGroup,
  type Group,
} from '@/lib/groups'
import { fetchPlayers, playerGroupId } from '@/lib/players'
import { GroupDetail } from './GroupDetail'

export function Groups() {
  const queryClient = useQueryClient()
  const groupsQuery = useQuery({ queryKey: ['groups'], queryFn: fetchGroups })
  const playersQuery = useQuery({ queryKey: ['players'], queryFn: fetchPlayers, staleTime: 30_000 })

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Group | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null)
  const [deployTarget, setDeployTarget] = useState<Group | null>(null)
  const [openGroup, setOpenGroup] = useState<Group | null>(null)

  const invalidateGroups = () => queryClient.invalidateQueries({ queryKey: ['groups'] })

  // `openGroup` is just a selection snapshot; always render the detail view from
  // the freshest group in the query cache so saves (ticker, settings, playlists)
  // are reflected when a dialog re-seeds. Falls back to the snapshot if the group
  // momentarily isn't in the list (e.g. mid-refetch).
  const liveOpenGroup = useMemo(
    () => (openGroup ? (groupsQuery.data?.find((g) => g._id === openGroup._id) ?? openGroup) : null),
    [openGroup, groupsQuery.data],
  )

  const memberCountByGroupId = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of playersQuery.data ?? []) {
      const id = playerGroupId(p)
      if (id) map.set(id, (map.get(id) ?? 0) + 1)
    }
    return map
  }, [playersQuery.data])

  const createMut = useMutation({
    mutationFn: (name: string) => createGroup(name),
    onSuccess: () => {
      invalidateGroups()
      setCreateOpen(false)
    },
  })

  const renameMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateGroup(id, { name }),
    onSuccess: () => {
      invalidateGroups()
      setEditTarget(null)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteGroup(id),
    onSuccess: () => {
      invalidateGroups()
      queryClient.invalidateQueries({ queryKey: ['players'] })
      setDeleteTarget(null)
    },
  })

  const deployMut = useMutation({
    mutationFn: (id: string) => deployGroup(id),
    onSuccess: () => {
      invalidateGroups()
      queryClient.invalidateQueries({ queryKey: ['players'] })
      setDeployTarget(null)
    },
  })

  return (
    <>
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-headline-lg text-text-vibrant">Groups</h2>
          <p className="text-body-md text-text-muted mt-1">
            {groupsQuery.isLoading
              ? 'Loading groups…'
              : `${groupsQuery.data?.length ?? 0} groups · ${playersQuery.data?.length ?? 0} players`}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Icon name="add" size={18} />
          New Group
        </Button>
      </div>

      {liveOpenGroup ? (
        <GroupDetail
          group={liveOpenGroup}
          onClose={() => setOpenGroup(null)}
          onChanged={invalidateGroups}
        />
      ) : groupsQuery.isError ? (
        <ErrorBlock error={groupsQuery.error} />
      ) : groupsQuery.isLoading ? (
        <SkeletonGrid />
      ) : (groupsQuery.data?.length ?? 0) === 0 ? (
        <EmptyState onCreate={() => setCreateOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {groupsQuery.data!.map((group) => (
            <GroupCard
              key={group._id}
              group={group}
              memberCount={memberCountByGroupId.get(group._id) ?? 0}
              onOpen={() => setOpenGroup(group)}
              onEdit={() => setEditTarget(group)}
              onDelete={() => setDeleteTarget(group)}
              onDeploy={() => setDeployTarget(group)}
            />
          ))}
        </div>
      )}

      <CreateGroupDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={(name) => createMut.mutate(name)}
        existingNames={new Set((groupsQuery.data ?? []).map((g) => g.name))}
        pending={createMut.isPending}
        error={createMut.error}
      />

      <RenameGroupDialog
        target={editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        onSubmit={(name) =>
          editTarget && renameMut.mutate({ id: editTarget._id, name })
        }
        pending={renameMut.isPending}
        error={renameMut.error}
      />

      <DeleteGroupConfirm
        target={deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget._id)}
        memberCount={
          deleteTarget ? memberCountByGroupId.get(deleteTarget._id) ?? 0 : 0
        }
      />

      <DeployGroupConfirm
        target={deployTarget}
        onOpenChange={(open) => !open && !deployMut.isPending && setDeployTarget(null)}
        onConfirm={() => deployTarget && deployMut.mutate(deployTarget._id)}
        memberCount={
          deployTarget ? memberCountByGroupId.get(deployTarget._id) ?? 0 : 0
        }
        pending={deployMut.isPending}
        error={deployMut.error}
      />
    </>
  )
}

function GroupCard({
  group,
  memberCount,
  onOpen,
  onEdit,
  onDelete,
  onDeploy,
}: {
  group: Group
  memberCount: number
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
  onDeploy: () => void
}) {
  const deployed = (group.deployedPlaylists ?? [])
    .map(playlistRefName)
    .filter((n) => n.length > 0)
  const isDefault = group.name === 'default'
  const canDeploy = (group.playlists?.length ?? 0) > 0

  return (
    <Card
      onClick={onOpen}
      className="p-5 flex flex-col gap-4 hover:border-outline-variant cursor-pointer"
    >
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon name="group_work" className="text-primary" size={20} />
            <h3 className="text-headline-sm text-text-vibrant truncate">{group.name}</h3>
          </div>
          <p className="text-body-sm text-text-muted mt-1 font-mono">
            {memberCount} {memberCount === 1 ? 'player' : 'players'}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Actions for ${group.name}`}
              onClick={(e) => e.stopPropagation()}
              className="text-text-muted hover:text-text-vibrant p-1 rounded-industrial hover:bg-surface-container transition-colors"
            >
              <Icon name="more_vert" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{group.name}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onOpen}>
              <Icon name="open_in_full" size={16} />
              Open / Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!canDeploy} onSelect={onDeploy}>
              <Icon name="rocket_launch" size={16} />
              {canDeploy ? 'Deploy to group' : 'Deploy (no playlists)'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onEdit}>
              <Icon name="edit" size={16} />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive disabled={isDefault} onSelect={onDelete}>
              <Icon name="delete" size={16} />
              {isDefault ? 'Delete (default protected)' : 'Delete Group'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-col gap-2">
        <MetaRow label="Deployed Playlists" value={deployed.length.toString()} icon="queue_music" />
        <MetaRow
          label="Deployed Assets"
          value={(group.deployedAssets?.length ?? 0).toString()}
          icon="perm_media"
        />
        {group.resolution && (
          <MetaRow label="Resolution" value={group.resolution} icon="aspect_ratio" />
        )}
      </div>

      {deployed.length > 0 && (
        <div className="border-t border-border-industrial pt-3">
          <p className="text-label-caps text-text-muted uppercase tracking-wider mb-2">
            Now Playing
          </p>
          <div className="flex flex-wrap gap-1.5">
            {deployed.slice(0, 4).map((name) => (
              <span
                key={name}
                className="font-mono text-[11px] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded"
              >
                {name}
              </span>
            ))}
            {deployed.length > 4 && (
              <span className="font-mono text-[11px] text-text-muted px-2 py-0.5">
                +{deployed.length - 4} more
              </span>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

function MetaRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex items-center justify-between text-body-sm">
      <span className="text-text-muted flex items-center gap-1.5">
        <Icon name={icon} size={14} />
        {label}
      </span>
      <span className="font-mono text-text-vibrant">{value}</span>
    </div>
  )
}

function CreateGroupDialog({
  open,
  onOpenChange,
  onSubmit,
  existingNames,
  pending,
  error,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (name: string) => void
  existingNames: Set<string>
  pending: boolean
  error: unknown
}) {
  const [name, setName] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setLocalError('Name is required.')
    if (existingNames.has(trimmed)) return setLocalError('A group with that name already exists.')
    setLocalError(null)
    onSubmit(trimmed)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) {
          setName('')
          setLocalError(null)
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Group</DialogTitle>
          <DialogDescription>
            Groups bundle shared playlists, schedules, and display settings for one or more players.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-label-caps text-text-muted uppercase">Name</span>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lobby Displays"
            />
          </label>
          {(localError !== null || error != null) && (
            <p className="text-body-sm text-status-offline" role="alert">
              {localError ?? formatError(error)}
            </p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create Group'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RenameGroupDialog({
  target,
  onOpenChange,
  onSubmit,
  pending,
  error,
}: {
  target: Group | null
  onOpenChange: (open: boolean) => void
  onSubmit: (name: string) => void
  pending: boolean
  error: unknown
}) {
  const [name, setName] = useState('')

  // Prefill when a new target opens.
  useEffect(() => {
    if (target) setName(target.name)
  }, [target])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || trimmed === target?.name) {
      onOpenChange(false)
      return
    }
    onSubmit(trimmed)
  }

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) setName('')
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Group</DialogTitle>
          <DialogDescription>
            Players already in this group will follow the new name automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-label-caps text-text-muted uppercase">Name</span>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {error != null && (
            <p className="text-body-sm text-status-offline" role="alert">
              {formatError(error)}
            </p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteGroupConfirm({
  target,
  onOpenChange,
  onConfirm,
  memberCount,
}: {
  target: Group | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  memberCount: number
}) {
  return (
    <AlertDialog open={target !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &quot;{target?.name}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            {memberCount > 0
              ? `${memberCount} player${memberCount === 1 ? '' : 's'} are assigned to this group and will fall back to the default group.`
              : 'This group has no players assigned and can be safely removed.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction destructive onClick={onConfirm}>
            Delete Group
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function DeployGroupConfirm({
  target,
  onOpenChange,
  onConfirm,
  memberCount,
  pending,
  error,
}: {
  target: Group | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  memberCount: number
  pending: boolean
  error: unknown
}) {
  const playlistCount = target?.playlists?.length ?? 0
  return (
    <AlertDialog open={target !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deploy &quot;{target?.name}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            {memberCount > 0
              ? `${memberCount} player${memberCount === 1 ? '' : 's'} in this group will fetch and play its ${playlistCount} playlist${playlistCount === 1 ? '' : 's'}, replacing what they currently show.`
              : `This group has no players assigned yet. Deploying sets its content so any player added later picks it up.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error != null && (
          <p className="text-body-sm text-status-offline" role="alert">
            {formatError(error)}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          {/* Plain Button (not AlertDialogAction) so the dialog stays open while
              the deploy request is in flight and can show the pending state. */}
          <Button onClick={onConfirm} disabled={pending}>
            {pending ? 'Deploying…' : 'Deploy'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ErrorBlock({ error }: { error: unknown }) {
  return (
    <Card className="p-5 flex items-center gap-3 border-status-offline/30 bg-status-offline/10">
      <Icon name="cloud_off" className="text-status-offline" />
      <div>
        <p className="text-body-md text-text-vibrant">Backend unreachable</p>
        <p className="text-body-sm text-text-muted font-mono">{formatError(error)}</p>
      </div>
    </Card>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card className="p-10 flex flex-col items-center justify-center text-center gap-3">
      <Icon name="group_work" className="text-text-muted/50" size={48} />
      <p className="text-body-md text-text-vibrant">No groups yet</p>
      <p className="text-body-sm text-text-muted max-w-sm">
        Groups bundle players that should share a playlist, schedule, and display configuration.
        Create one to get started.
      </p>
      <Button onClick={onCreate} className="mt-2">
        <Icon name="add" size={18} />
        Create First Group
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
          <div className="space-y-2">
            <div className="h-3 bg-surface-container rounded w-1/2" />
            <div className="h-3 bg-surface-container rounded w-1/3" />
          </div>
        </Card>
      ))}
    </div>
  )
}

function formatError(error: unknown): string {
  if (!error) return ''
  if (error instanceof Error) return error.message
  return 'Request failed'
}
