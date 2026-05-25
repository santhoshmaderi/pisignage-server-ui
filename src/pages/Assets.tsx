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

export function Assets() {
  const queryClient = useQueryClient()

  const assetsQuery = useQuery({ queryKey: ['assets'], queryFn: fetchAssets, refetchInterval: 60_000 })
  const labelsQuery = useQuery({ queryKey: ['labels'], queryFn: fetchLabels, staleTime: 60_000 })

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [labelFilter, setLabelFilter] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null)

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
          <Button onClick={() => setUploadOpen(true)}>
            <Icon name="cloud_upload" size={18} />
            Upload Media
          </Button>
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
              className="ml-auto flex items-center gap-1 text-body-sm text-text-muted hover:text-text-vibrant"
            >
              <Icon name="close" size={14} />
              Clear label: <span className="text-primary">{labelFilter}</span>
            </button>
          )}
        </Card>

        {assetsQuery.isError ? (
          <ErrorBlock error={assetsQuery.error} />
        ) : assetsQuery.isLoading ? (
          <SkeletonGrid />
        ) : filtered.length === 0 ? (
          <EmptyState
            hasAny={(assetsQuery.data?.length ?? 0) > 0}
            onUpload={() => setUploadOpen(true)}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((asset) => (
              <AssetCard
                key={assetName(asset) || JSON.stringify(asset).slice(0, 40)}
                asset={asset}
                onDelete={() => setDeleteTarget(asset)}
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

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={() => {
          invalidateAssets()
          setUploadOpen(false)
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
    </div>
  )
}

function AssetCard({ asset, onDelete }: { asset: Asset; onDelete: () => void }) {
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
          <a
            href={`/media/${encodeURIComponent(name)}`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 text-center text-body-sm py-1 rounded text-text-muted hover:text-text-vibrant hover:bg-surface-container transition-colors"
          >
            <Icon name="open_in_new" size={14} /> Open
          </a>
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

  const uploadMut = useMutation({
    mutationFn: ({ files, onProgress }: { files: File[]; onProgress: (n: number) => void }) =>
      uploadAssets(files, onProgress),
    onSuccess: () => {
      setFiles([])
      onUploaded()
    },
  })

  const [progress, setProgress] = useState(0)

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

        {uploadMut.isPending && (
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

function formatDate(input?: string): string {
  if (!input) return '—'
  const d = new Date(input)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
