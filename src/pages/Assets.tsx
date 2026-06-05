import { useMemo, useRef, useState, type DragEvent, type ChangeEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Icon } from '@/components/Icon'
import { cn } from '@/lib/utils'
import {
  assetName,
  assetThumbnailUrl,
  deleteAsset,
  fetchAssets,
  formatBytes,
  inferType,
  uploadAssets,
  type Asset,
  type AssetType,
} from '@/lib/assets'
import { AddLinkDialog } from '@/components/AddLinkDialog'
import { fetchLabels } from '@/lib/labels'

type TypeFilter = 'all' | AssetType
const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All Assets' },
  { value: 'video', label: 'Videos' },
  { value: 'image', label: 'Images' },
  { value: 'html', label: 'HTML' },
  { value: 'audio', label: 'Audio' },
  { value: 'link', label: 'Links' },
]

const MAX_UPLOAD = 10 // matches multer limit in pisignage-server

type ViewMode = 'list' | 'grid'
const VIEW_KEY = 'pisignage.assetsView'

export function Assets() {
  const queryClient = useQueryClient()

  const assetsQuery = useQuery({ queryKey: ['assets'], queryFn: fetchAssets, refetchInterval: 60_000 })
  const labelsQuery = useQuery({ queryKey: ['labels'], queryFn: fetchLabels, staleTime: 60_000 })

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [labelFilter, setLabelFilter] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [linkType, setLinkType] = useState<string | null>(null)
  const [editLinkFile, setEditLinkFile] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkConfirm, setBulkConfirm] = useState(false)
  const [view, setViewState] = useState<ViewMode>(
    () => (localStorage.getItem(VIEW_KEY) as ViewMode) || 'list',
  )
  const setView = (v: ViewMode) => {
    setViewState(v)
    localStorage.setItem(VIEW_KEY, v)
  }

  const invalidateAssets = () => queryClient.invalidateQueries({ queryKey: ['assets'] })

  const labelCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of assetsQuery.data ?? []) {
      for (const l of a.labels ?? []) m.set(l, (m.get(l) ?? 0) + 1)
    }
    return m
  }, [assetsQuery.data])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (assetsQuery.data ?? []).filter((a) => {
      const t = inferType(a)
      if (typeFilter !== 'all' && t !== typeFilter) return false
      if (labelFilter && !(a.labels ?? []).includes(labelFilter)) return false
      if (term && !assetName(a).toLowerCase().includes(term)) return false
      return true
    })
  }, [assetsQuery.data, search, typeFilter, labelFilter])

  const deleteMut = useMutation({
    mutationFn: (name: string) => deleteAsset(name),
    onSuccess: () => {
      invalidateAssets()
      setDeleteTarget(null)
    },
  })

  const bulkDeleteMut = useMutation({
    mutationFn: async (names: string[]) => {
      // No bulk endpoint — delete sequentially.
      for (const n of names) await deleteAsset(n)
    },
    onSuccess: () => {
      invalidateAssets()
      setSelected(new Set())
      setBulkConfirm(false)
    },
  })

  const toggleOne = (name: string) =>
    setSelected((cur) => {
      const next = new Set(cur)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  const toggleAll = () =>
    setSelected((cur) => {
      const names = filtered.map(assetName).filter(Boolean)
      const allSel = names.length > 0 && names.every((n) => cur.has(n))
      return allSel ? new Set() : new Set(names)
    })

  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0 flex flex-col gap-6">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-headline-lg text-text-vibrant">Asset Library</h2>
            <p className="text-body-md text-text-muted mt-1">
              {assetsQuery.isLoading
                ? 'Loading…'
                : `${filtered.length} of ${assetsQuery.data?.length ?? 0} assets shown`}
            </p>
          </div>
          <div className="flex">
            <Button onClick={() => setUploadOpen(true)} className="rounded-r-none">
              <Icon name="cloud_upload" size={18} />
              Upload Files
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="rounded-l-none border-l border-on-primary/20 px-2" aria-label="More upload options">
                  <Icon name="arrow_drop_down" size={20} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setUploadOpen(true)}>
                  <Icon name="upload" size={16} />
                  Upload local files
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setLinkType('.tv')}>
                  <Icon name="link" size={16} />
                  Add a Link
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setLinkType('.txt')}>
                  <Icon name="chat" size={16} />
                  Add a Message
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setLinkType('.local')}>
                  <Icon name="folder" size={16} />
                  Add a local folder/file
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Card className="p-3 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assets…"
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TYPE_FILTERS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTypeFilter(opt.value)}
                className={cn(
                  'px-3 py-1 rounded-full text-label-caps uppercase tracking-wider border transition-colors',
                  typeFilter === opt.value
                    ? 'border-primary text-primary bg-primary/10'
                    : 'border-border-industrial text-text-muted hover:border-outline-variant hover:text-text-vibrant',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {labelFilter && (
            <button
              type="button"
              onClick={() => setLabelFilter(null)}
              className="flex items-center gap-1 text-body-sm text-text-muted hover:text-text-vibrant"
            >
              <Icon name="close" size={14} />
              Clear label: <span className="text-primary">{labelFilter}</span>
            </button>
          )}
          {/* View toggle */}
          <div className="ml-auto flex bg-surface-container rounded p-1 border border-border-industrial">
            <button
              type="button"
              onClick={() => setView('list')}
              title="List view"
              className={cn(
                'p-1.5 rounded transition-colors',
                view === 'list' ? 'bg-primary/20 text-primary' : 'text-text-muted hover:text-text-vibrant',
              )}
            >
              <Icon name="view_list" size={20} />
            </button>
            <button
              type="button"
              onClick={() => setView('grid')}
              title="Grid view"
              className={cn(
                'p-1.5 rounded transition-colors',
                view === 'grid' ? 'bg-primary/20 text-primary' : 'text-text-muted hover:text-text-vibrant',
              )}
            >
              <Icon name="grid_view" size={20} />
            </button>
          </div>
        </Card>

        {/* Bulk actions bar */}
        {view === 'list' && selected.size > 0 && (
          <Card className="p-3 flex items-center justify-between bg-surface-container-high">
            <div className="flex items-center gap-4">
              <span className="text-body-sm text-text-muted">{selected.size} selected</span>
              <div className="h-4 w-px bg-border-industrial" />
              <button
                type="button"
                onClick={() => setBulkConfirm(true)}
                className="flex items-center gap-1 text-label-caps uppercase tracking-wider text-status-offline hover:bg-status-offline/10 px-2 py-1 rounded transition-colors"
              >
                <Icon name="delete" size={16} />
                Delete selected
              </button>
            </div>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-body-sm text-text-muted hover:text-text-vibrant"
            >
              Clear
            </button>
          </Card>
        )}

        {assetsQuery.isError ? (
          <ErrorBlock error={assetsQuery.error} />
        ) : assetsQuery.isLoading ? (
          view === 'list' ? <SkeletonTable /> : <SkeletonGrid />
        ) : filtered.length === 0 ? (
          <EmptyState
            hasAny={(assetsQuery.data?.length ?? 0) > 0}
            onUpload={() => setUploadOpen(true)}
          />
        ) : view === 'list' ? (
          <AssetTable
            assets={filtered}
            selected={selected}
            onToggleOne={toggleOne}
            onToggleAll={toggleAll}
            onDelete={setDeleteTarget}
            onEditLink={(a) => setEditLinkFile(assetName(a))}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((asset) => (
              <AssetCard
                key={assetName(asset) || JSON.stringify(asset).slice(0, 40)}
                asset={asset}
                onDelete={() => setDeleteTarget(asset)}
                onEditLink={() => setEditLinkFile(assetName(asset))}
              />
            ))}
          </div>
        )}
      </div>

      <LabelsSidebar
        labels={(labelsQuery.data ?? []).map((l) => l.name)}
        labelCounts={labelCounts}
        active={labelFilter}
        onSelect={(name) => setLabelFilter((cur) => (cur === name ? null : name))}
      />

      <AddLinkDialog
        open={linkType !== null || editLinkFile !== null}
        initialType={linkType ?? '.tv'}
        editFile={editLinkFile}
        onOpenChange={(o) => {
          if (!o) {
            setLinkType(null)
            setEditLinkFile(null)
          }
        }}
        onSaved={() => {
          invalidateAssets()
          ;[1500, 4000].forEach((ms) => window.setTimeout(invalidateAssets, ms))
        }}
      />

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={() => {
          // Server processing (probe/transcode/thumbnail) runs asynchronously, so
          // re-check a few times — processed assets (especially transcoded video)
          // appear without waiting for the 60s background poll.
          invalidateAssets()
          ;[1500, 4000, 8000, 15000].forEach((ms) => window.setTimeout(invalidateAssets, ms))
        }}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &quot;{deleteTarget ? assetName(deleteTarget) : ''}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {(deleteTarget?.playlists?.length ?? 0) > 0
                ? `This asset is used in ${deleteTarget?.playlists?.length} playlist(s). Removing it will leave those playlists with a missing item.`
                : 'This asset is not currently in any playlist.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              destructive
              onClick={() => deleteTarget && deleteMut.mutate(assetName(deleteTarget))}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkConfirm} onOpenChange={(o) => !o && !bulkDeleteMut.isPending && setBulkConfirm(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} asset{selected.size === 1 ? '' : 's'}?</AlertDialogTitle>
            <AlertDialogDescription>
              The selected files are removed from disk. Playlists using them will be left with
              missing items. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {bulkDeleteMut.error != null && (
            <p className="text-body-sm text-status-offline" role="alert">
              {bulkDeleteMut.error instanceof Error ? bulkDeleteMut.error.message : 'Bulk delete failed'}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleteMut.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              destructive
              disabled={bulkDeleteMut.isPending}
              onClick={(e) => {
                e.preventDefault()
                bulkDeleteMut.mutate(Array.from(selected))
              }}
            >
              {bulkDeleteMut.isPending ? 'Deleting…' : `Delete ${selected.size}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function AssetTable({
  assets,
  selected,
  onToggleOne,
  onToggleAll,
  onDelete,
  onEditLink,
}: {
  assets: Asset[]
  selected: Set<string>
  onToggleOne: (name: string) => void
  onToggleAll: () => void
  onDelete: (asset: Asset) => void
  onEditLink: (asset: Asset) => void
}) {
  const names = assets.map(assetName).filter(Boolean)
  const allSelected = names.length > 0 && names.every((n) => selected.has(n))
  const checkboxCls =
    'w-4 h-4 rounded border-border-industrial bg-surface-container-low text-primary focus:ring-0 cursor-pointer'
  const thCls = 'p-3 text-label-caps text-text-muted uppercase tracking-wider text-[11px] font-bold'

  return (
    <Card className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-surface-container-high border-b border-border-industrial">
            <tr>
              <th className="p-3 w-10">
                <input type="checkbox" checked={allSelected} onChange={onToggleAll} className={checkboxCls} aria-label="Select all" />
              </th>
              <th className={thCls}>Preview</th>
              <th className={thCls}>Filename</th>
              <th className={thCls}>Type</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>Size</th>
              <th className={cn(thCls, 'text-right')}>Added</th>
              <th className="p-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border-industrial">
            {assets.map((asset) => (
              <AssetRow
                key={assetName(asset) || JSON.stringify(asset).slice(0, 40)}
                asset={asset}
                selected={selected.has(assetName(asset))}
                onToggle={() => onToggleOne(assetName(asset))}
                onDelete={() => onDelete(asset)}
                onEditLink={() => onEditLink(asset)}
                checkboxCls={checkboxCls}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function AssetRow({
  asset,
  selected,
  onToggle,
  onDelete,
  onEditLink,
  checkboxCls,
}: {
  asset: Asset
  selected: boolean
  onToggle: () => void
  onDelete: () => void
  onEditLink: () => void
  checkboxCls: string
}) {
  const type = inferType(asset)
  const name = assetName(asset)
  const date = asset.ctime ?? asset.createdAt ?? asset.mtime
  const { icon, tone } = ICON_BY_TYPE[type] ?? ICON_BY_TYPE.other

  return (
    <tr className={cn('group transition-colors', selected ? 'bg-primary/5' : 'hover:bg-surface-container')}>
      <td className="p-3">
        <input type="checkbox" checked={selected} onChange={onToggle} className={checkboxCls} aria-label={`Select ${name}`} />
      </td>
      <td className="p-3">
        <MiniThumb asset={asset} type={type} />
      </td>
      <td className="p-3">
        <div className="flex flex-col min-w-0">
          <span className="text-body-sm font-bold text-text-vibrant truncate max-w-[280px]" title={name}>
            {name || <span className="text-text-muted italic">(unnamed)</span>}
          </span>
          {asset.labels && asset.labels.length > 0 && (
            <div className="flex gap-1 mt-1">
              {asset.labels.slice(0, 3).map((l) => (
                <span key={l} className="px-1.5 py-0.5 rounded-sm bg-primary/10 text-[9px] text-primary font-bold uppercase">
                  {l}
                </span>
              ))}
              {asset.labels.length > 3 && (
                <span className="text-[9px] text-text-muted">+{asset.labels.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </td>
      <td className="p-3">
        <div className="flex items-center gap-2 text-text-muted">
          <Icon name={icon} size={16} className={tone} />
          <span className="text-body-sm font-data-mono capitalize">{type}</span>
        </div>
      </td>
      <td className="p-3">
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-status-online/10 text-status-online border border-status-online/20">
          <span className="w-1.5 h-1.5 rounded-full bg-status-online" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">{type === 'link' ? 'Active' : 'Ready'}</span>
        </div>
      </td>
      <td className="p-3 text-body-sm font-data-mono text-text-muted whitespace-nowrap">
        {formatBytes(asset.size) || '—'}
      </td>
      <td className="p-3 text-body-sm text-text-muted text-right whitespace-nowrap">{formatDate(date)}</td>
      <td className="p-3 text-right">
        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {type === 'link' ? (
            <button
              type="button"
              onClick={onEditLink}
              aria-label={`Edit ${name}`}
              className="p-1.5 rounded text-text-muted hover:text-primary hover:bg-surface-container-high transition-colors"
            >
              <Icon name="edit" size={18} />
            </button>
          ) : (
            <a
              href={`/media/${encodeURIComponent(name)}`}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${name}`}
              className="p-1.5 rounded text-text-muted hover:text-primary hover:bg-surface-container-high transition-colors"
            >
              <Icon name="open_in_new" size={18} />
            </a>
          )}
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${name}`}
            className="p-1.5 rounded text-text-muted hover:text-status-offline hover:bg-status-offline/10 transition-colors"
          >
            <Icon name="delete" size={18} />
          </button>
        </div>
      </td>
    </tr>
  )
}

function MiniThumb({ asset, type }: { asset: Asset; type: AssetType }) {
  const [errored, setErrored] = useState(false)
  const thumb = assetThumbnailUrl(asset)
  const name = assetName(asset)

  if (thumb && !errored) {
    return (
      <div className="w-16 h-10 rounded overflow-hidden border border-border-industrial bg-black relative shrink-0">
        <img
          src={thumb}
          alt={name}
          loading="lazy"
          onError={() => setErrored(true)}
          className="w-full h-full object-cover opacity-90"
        />
        {type === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon name="play_circle" size={18} className="text-white/80" />
          </div>
        )}
      </div>
    )
  }

  const { icon, tone } = ICON_BY_TYPE[type] ?? ICON_BY_TYPE.other
  return (
    <div className="w-16 h-10 rounded border border-border-industrial bg-surface-container flex items-center justify-center shrink-0">
      <Icon name={icon} size={20} className={cn('opacity-60', tone)} />
    </div>
  )
}

function AssetCard({
  asset,
  onDelete,
  onEditLink,
}: {
  asset: Asset
  onDelete: () => void
  onEditLink: () => void
}) {
  const type = inferType(asset)
  const date = asset.ctime ?? asset.createdAt ?? asset.mtime
  const name = assetName(asset)
  return (
    <Card className="p-0 overflow-hidden flex flex-col group hover:border-primary/50">
      <AssetThumbnail asset={asset} type={type} />
      <div className="p-3 flex-1 flex flex-col gap-2">
        <h3 className="text-body-md font-bold text-text-vibrant truncate" title={name}>
          {name || <span className="text-text-muted italic">(unnamed)</span>}
        </h3>
        {asset.labels && asset.labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {asset.labels.slice(0, 3).map((l) => (
              <span
                key={l}
                className="px-2 py-0.5 bg-surface-container-high text-text-muted text-label-caps uppercase rounded text-[10px]"
              >
                {l}
              </span>
            ))}
            {asset.labels.length > 3 && (
              <span className="px-1.5 py-0.5 text-text-muted text-[10px]">
                +{asset.labels.length - 3}
              </span>
            )}
          </div>
        )}
        <div className="mt-auto flex justify-between items-end font-mono text-[11px] text-text-muted border-t border-border-industrial pt-2">
          <span>{formatBytes(asset.size)}</span>
          <span>{formatDate(date)}</span>
        </div>
        <div className="flex gap-1 -mb-1">
          {type === 'link' ? (
            <button
              type="button"
              onClick={onEditLink}
              className="flex-1 text-center text-body-sm py-1 rounded text-text-muted hover:text-text-vibrant hover:bg-surface-container transition-colors"
            >
              <Icon name="edit" size={14} /> Edit
            </button>
          ) : (
            <a
              href={`/media/${encodeURIComponent(name)}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 text-center text-body-sm py-1 rounded text-text-muted hover:text-text-vibrant hover:bg-surface-container transition-colors"
            >
              <Icon name="open_in_new" size={14} /> Open
            </a>
          )}
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${name}`}
            className="px-3 py-1 rounded text-text-muted hover:text-status-offline hover:bg-status-offline/10 transition-colors"
          >
            <Icon name="delete" size={16} />
          </button>
        </div>
      </div>
    </Card>
  )
}

function AssetThumbnail({ asset, type }: { asset: Asset; type: AssetType }) {
  const [errored, setErrored] = useState(false)
  const thumb = assetThumbnailUrl(asset)
  const name = assetName(asset)

  if (thumb && !errored) {
    return (
      <div className="h-40 bg-surface-container relative">
        <img
          src={thumb}
          alt={name}
          loading="lazy"
          onError={() => setErrored(true)}
          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
        />
        <TypeBadge type={type} />
      </div>
    )
  }

  const { icon, tone } = ICON_BY_TYPE[type] ?? ICON_BY_TYPE.other
  return (
    <div className="h-40 bg-surface-container relative flex items-center justify-center">
      <Icon name={icon} size={56} className={cn('opacity-40', tone)} />
      <TypeBadge type={type} />
    </div>
  )
}

const ICON_BY_TYPE: Record<AssetType, { icon: string; tone: string }> = {
  video: { icon: 'movie', tone: 'text-primary' },
  image: { icon: 'image', tone: 'text-tertiary' },
  audio: { icon: 'music_note', tone: 'text-secondary' },
  html: { icon: 'code', tone: 'text-status-syncing' },
  link: { icon: 'link', tone: 'text-primary' },
  folder: { icon: 'folder', tone: 'text-text-muted' },
  other: { icon: 'description', tone: 'text-text-muted' },
}

function TypeBadge({ type }: { type: AssetType }) {
  const { icon, tone } = ICON_BY_TYPE[type] ?? ICON_BY_TYPE.other
  return (
    <div className="absolute top-2 right-2 bg-surface/80 backdrop-blur p-1 rounded-industrial">
      <Icon name={icon} size={16} className={tone} />
    </div>
  )
}

function LabelsSidebar({
  labels,
  labelCounts,
  active,
  onSelect,
}: {
  labels: string[]
  labelCounts: Map<string, number>
  active: string | null
  onSelect: (name: string) => void
}) {
  // Show the union of named labels (from /api/labels) AND any labels that
  // appear on an asset but aren't in the label registry (orphaned labels).
  const all = useMemo(() => {
    const set = new Set<string>(labels)
    for (const l of labelCounts.keys()) set.add(l)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [labels, labelCounts])

  return (
    <aside className="w-64 shrink-0 hidden xl:flex flex-col">
      <Card className="p-0 sticky top-0">
        <div className="p-4 border-b border-border-industrial flex justify-between items-center">
          <h3 className="text-headline-sm text-text-vibrant">Labels</h3>
          <span className="text-data-mono text-text-muted">{all.length}</span>
        </div>
        <div className="p-3 max-h-[60vh] overflow-y-auto">
          {all.length === 0 ? (
            <p className="text-body-sm text-text-muted px-2 py-4 text-center">
              No labels yet. Tag assets to organize them.
            </p>
          ) : (
            <ul className="space-y-1">
              {all.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    onClick={() => onSelect(name)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded border text-left transition-colors',
                      active === name
                        ? 'bg-surface-container-high border-primary text-text-vibrant'
                        : 'bg-transparent border-transparent text-text-muted hover:bg-surface-container hover:text-text-vibrant',
                    )}
                  >
                    <span className="text-body-sm truncate">{name}</span>
                    <span className="font-mono text-[10px] text-text-muted bg-surface px-1.5 py-0.5 rounded shrink-0">
                      {labelCounts.get(name) ?? 0}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </aside>
  )
}

function UploadDialog({
  open,
  onOpenChange,
  onUploaded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploaded: () => void
}) {
  const [files, setFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'processing' | 'done'>('idle')

  const uploadMut = useMutation({
    mutationFn: ({ files, onProgress }: { files: File[]; onProgress: (n: number) => void }) =>
      uploadAssets(files, onProgress, setPhase),
    onSuccess: () => {
      setFiles([])
      setPhase('done')
      onUploaded()
      // Keep the confirmation visible briefly, then close.
      window.setTimeout(() => onOpenChange(false), 2600)
    },
    onError: () => setPhase('idle'),
  })

  const addFiles = (incoming: File[]) => {
    const merged = [...files]
    for (const f of incoming) {
      if (!merged.find((m) => m.name === f.name && m.size === f.size)) merged.push(f)
    }
    setFiles(merged.slice(0, MAX_UPLOAD))
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files?.length) addFiles(Array.from(e.dataTransfer.files))
  }

  const handlePick = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  const submit = () => {
    if (files.length === 0) return
    setProgress(0)
    setPhase('uploading')
    uploadMut.mutate({ files, onProgress: setProgress })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) {
          setFiles([])
          setProgress(0)
          setPhase('idle')
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Media</DialogTitle>
          <DialogDescription>
            Drop up to {MAX_UPLOAD} files. Videos, images, HTML, and audio are accepted.
          </DialogDescription>
        </DialogHeader>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'cursor-pointer rounded-lg border-2 border-dashed p-8 flex flex-col items-center justify-center gap-2 text-center transition-colors',
            dragOver
              ? 'border-primary bg-primary/5'
              : 'border-border-industrial hover:border-outline-variant',
          )}
        >
          <Icon name="cloud_upload" size={40} className="text-text-muted" />
          <p className="text-body-md text-text-vibrant">
            <span className="text-primary font-bold">Click to choose</span> or drag files here
          </p>
          <p className="text-body-sm text-text-muted">
            Max {MAX_UPLOAD} files per upload
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={handlePick}
          />
        </div>

        {files.length > 0 && (
          <ul className="max-h-56 overflow-y-auto border border-border-industrial rounded-industrial divide-y divide-border-industrial">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="px-3 py-2 flex items-center justify-between gap-2 text-body-sm"
              >
                <span className="truncate text-text-vibrant">{f.name}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-text-muted font-mono text-[11px]">{formatBytes(f.size)}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${f.name}`}
                    onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}
                    className="text-text-muted hover:text-status-offline"
                    disabled={uploadMut.isPending}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {(phase === 'uploading' || phase === 'processing') && (
          <div className="space-y-1">
            <div className="h-1.5 bg-surface-container rounded overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-body-sm text-text-muted text-right">Uploading… {progress}%</p>
          </div>
        )}

        {phase === 'done' && (
          <div className="flex items-center gap-2 rounded-industrial border border-primary/30 bg-primary/10 p-3">
            <Icon name="check_circle" size={18} className="text-primary" />
            <p className="text-body-md text-text-vibrant">Uploaded</p>
          </div>
        )}

        {uploadMut.error != null && (
          <p className="text-body-sm text-status-offline" role="alert">
            {uploadMut.error instanceof Error ? uploadMut.error.message : 'Upload failed'}
          </p>
        )}

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploadMut.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={files.length === 0 || uploadMut.isPending}>
            {uploadMut.isPending ? 'Uploading…' : `Upload ${files.length || ''}`.trim()}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ErrorBlock({ error }: { error: unknown }) {
  const message =
    error instanceof Error ? error.message : 'Unable to reach pisignage-server at /api/files'
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

function EmptyState({
  hasAny,
  onUpload,
}: {
  hasAny: boolean
  onUpload: () => void
}) {
  return (
    <Card className="p-10 flex flex-col items-center justify-center text-center gap-3">
      <Icon name="perm_media" className="text-text-muted/50" size={48} />
      <p className="text-body-md text-text-vibrant">
        {hasAny ? 'No assets match the current filters' : 'The library is empty'}
      </p>
      <p className="text-body-sm text-text-muted max-w-sm">
        {hasAny
          ? 'Clear filters or change the search to see more.'
          : 'Upload videos, images, or HTML pages to start building playlists.'}
      </p>
      {!hasAny && (
        <Button onClick={onUpload} className="mt-2">
          <Icon name="cloud_upload" size={18} />
          Upload First Asset
        </Button>
      )}
    </Card>
  )
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="p-0 overflow-hidden animate-pulse">
          <div className="h-40 bg-surface-container" />
          <div className="p-3 space-y-2">
            <div className="h-3 bg-surface-container rounded w-3/4" />
            <div className="h-2 bg-surface-container rounded w-1/2" />
          </div>
        </Card>
      ))}
    </div>
  )
}

function SkeletonTable() {
  return (
    <Card className="p-0 overflow-hidden animate-pulse">
      <div className="h-11 bg-surface-container-high border-b border-border-industrial" />
      <div className="divide-y divide-border-industrial">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <div className="w-4 h-4 rounded bg-surface-container" />
            <div className="w-16 h-10 rounded bg-surface-container" />
            <div className="h-3 bg-surface-container rounded flex-1 max-w-[260px]" />
            <div className="h-3 bg-surface-container rounded w-20" />
            <div className="h-3 bg-surface-container rounded w-16 ml-auto" />
          </div>
        ))}
      </div>
    </Card>
  )
}

function formatDate(input?: string): string {
  if (!input) return '—'
  const d = new Date(input)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
