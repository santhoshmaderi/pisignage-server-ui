import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Icon } from '@/components/Icon'
import { cn } from '@/lib/utils'
import {
  assetName,
  assetThumbnailUrl,
  fetchAssets,
  formatBytes,
  inferType,
  type Asset,
  type AssetType,
} from '@/lib/assets'
import {
  findLayout,
  attachableZones,
  zoneDisplayLabel,
  type LayoutZone,
  type LayoutZoneId,
} from '@/lib/layouts'
import {
  fetchPlaylists,
  formatDuration,
  totalDuration,
  type Playlist,
  type PlaylistAsset,
} from '@/lib/playlists'

export type SequenceSectionProps = {
  playlist: Playlist
  onChange: (next: Playlist) => void
}

/** Zones an asset can carry attachments for (everything except 'main'). */
type AttachZone = Exclude<LayoutZoneId, 'main'>

const LIBRARY_TYPES: { value: AssetType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'video', label: 'Video' },
  { value: 'image', label: 'Image' },
  { value: 'html', label: 'HTML' },
]

const DEFAULT_DURATION: Record<AssetType, number> = {
  video: 0,
  image: 10,
  html: 30,
  link: 30,
  audio: 0,
  folder: 0,
  other: 10,
}

function defaultDurationFor(asset: Asset): number {
  const type = inferType(asset)
  if (type === 'video' || type === 'audio') {
    const known = Math.round(Number(asset.duration))
    return known > 0 ? known : 0
  }
  return DEFAULT_DURATION[type] ?? 10
}

/** Infer an asset type from a bare filename (timeline rows only store the name). */
function typeFromName(name: string): AssetType {
  return inferType({ name } as Asset)
}

export function SequenceSection({ playlist, onChange }: SequenceSectionProps) {
  const layout = findLayout(playlist.layout)
  const zones = layout.zones
  const otherZones = attachableZones(layout) // non-main zone objects; empty for single-zone

  const assetsQuery = useQuery({ queryKey: ['assets'], queryFn: fetchAssets, staleTime: 60_000 })
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<AssetType | 'all'>('all')

  // Which (assetIndex, zone) the zone-attach picker is open for.
  const [attachTarget, setAttachTarget] = useState<{ index: number; zone: AttachZone } | null>(
    null,
  )

  const libraryAssets = useMemo(() => {
    const term = search.trim().toLowerCase()
    const list = (assetsQuery.data ?? []).filter((a) => {
      if (typeFilter !== 'all' && inferType(a) !== typeFilter) return false
      if (term && !assetName(a).toLowerCase().includes(term)) return false
      return true
    })
    return [...list].sort((a, b) => assetTime(b) - assetTime(a))
  }, [assetsQuery.data, search, typeFilter])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const [activeDragLabel, setActiveDragLabel] = useState<string | null>(null)

  const assets = playlist.assets

  const handleDragStart = (e: DragStartEvent) => {
    setActiveDragLabel(String(e.active.data.current?.label ?? e.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragLabel(null)
    const { active, over } = event
    if (!over) return

    if (active.data.current?.source === 'library') {
      const file = active.data.current?.asset as Asset | undefined
      const fname = file ? assetName(file) : ''
      if (!fname) return
      const newAsset: PlaylistAsset = {
        filename: fname,
        duration: defaultDurationFor(file!),
        selected: true,
        // Single-zone layouts always play fullscreen (matches the server's saveData).
        fullscreen: otherZones.length === 0,
        option: {},
      }
      onChange({ ...playlist, assets: insertAfter(assets, newAsset, String(over.id)) })
      return
    }

    if (active.data.current?.source === 'timeline' && active.id !== over.id) {
      const ids = assets.map((_, i) => timelineId(i))
      const oldIndex = ids.indexOf(String(active.id))
      const newIndex = ids.indexOf(String(over.id))
      if (oldIndex < 0 || newIndex < 0) return
      onChange({ ...playlist, assets: arrayMove(assets, oldIndex, newIndex) })
    }
  }

  const updateAsset = (idx: number, patch: Partial<PlaylistAsset>) => {
    const next = assets.map((a, i) => (i === idx ? { ...a, ...patch } : a))
    onChange({ ...playlist, assets: next })
  }

  const removeAsset = (idx: number) => {
    onChange({ ...playlist, assets: assets.filter((_, i) => i !== idx) })
  }

  const duplicateAsset = (idx: number) => {
    const next = [...assets]
    next.splice(idx + 1, 0, { ...assets[idx] })
    onChange({ ...playlist, assets: next })
  }

  const saveAttach = (value: string) => {
    if (!attachTarget) return
    updateAsset(attachTarget.index, { [attachTarget.zone]: value } as Partial<PlaylistAsset>)
    setAttachTarget(null)
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-12 gap-4">
        {/* Asset library */}
        <Card className="col-span-12 lg:col-span-3 p-3 flex flex-col gap-3 self-start max-h-[calc(100vh-220px)]">
          <header>
            <h3 className="text-headline-sm text-text-vibrant">Asset Library</h3>
            <p className="text-body-sm text-text-muted mt-1">Drag onto the timeline.</p>
          </header>
          <div className="relative">
            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="pl-9 h-8 text-body-sm"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {LIBRARY_TYPES.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setTypeFilter(o.value)}
                className={cn(
                  'px-2 py-0.5 rounded-full text-label-caps uppercase border transition-colors',
                  typeFilter === o.value
                    ? 'border-primary text-primary bg-primary/10'
                    : 'border-border-industrial text-text-muted hover:border-outline-variant',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="overflow-y-auto -mx-1 px-1 space-y-1 min-h-0">
            {assetsQuery.isLoading ? (
              <p className="text-body-sm text-text-muted text-center py-6">Loading assets…</p>
            ) : libraryAssets.length === 0 ? (
              <p className="text-body-sm text-text-muted text-center py-6">No assets match.</p>
            ) : (
              libraryAssets.map((asset, i) => (
                <LibraryItem key={assetName(asset) || `idx-${i}`} asset={asset} />
              ))
            )}
          </div>
        </Card>

        {/* Timeline */}
        <div className="col-span-12 lg:col-span-6 flex flex-col gap-3">
          <Timeline
            assets={assets}
            otherZones={otherZones}
            totalSec={totalDuration(playlist)}
            onRemove={removeAsset}
            onUpdate={updateAsset}
            onDuplicate={duplicateAsset}
            onAttach={(index, zone) => setAttachTarget({ index, zone })}
            onDetach={(index, zone) =>
              updateAsset(index, { [zone]: null } as Partial<PlaylistAsset>)
            }
          />
        </div>

        {/* Layout preview */}
        <Card className="col-span-12 lg:col-span-3 p-4 self-start">
          <h3 className="text-headline-sm text-text-vibrant mb-3">Layout</h3>
          <LayoutPreview zones={zones} />
          <dl className="mt-4 space-y-1 font-mono text-[11px] text-text-muted">
            <div className="flex justify-between">
              <dt>Layout</dt>
              <dd className="text-text-vibrant">{playlist.layout ?? '1'}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Zones</dt>
              <dd className="text-text-vibrant">{zones.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Total</dt>
              <dd className="text-text-vibrant">{formatDuration(totalDuration(playlist))}</dd>
            </div>
          </dl>
          {otherZones.length > 0 && (
            <p className="text-body-sm text-text-muted mt-3">
              This layout has extra zones — use <strong className="text-text-vibrant">Add zone
              content</strong> on each item to fill the{' '}
              {otherZones.map(zoneDisplayLabel).join(' / ')} zone(s).
            </p>
          )}
        </Card>
      </div>

      <DragOverlay>
        {activeDragLabel ? (
          <div className="px-3 py-1.5 rounded-industrial bg-primary text-on-primary text-body-sm font-bold shadow-lg">
            {activeDragLabel}
          </div>
        ) : null}
      </DragOverlay>

      <ZoneAttachDialog
        target={attachTarget}
        current={
          attachTarget ? (assets[attachTarget.index]?.[attachTarget.zone] ?? null) : null
        }
        onSelect={saveAttach}
        onClose={() => setAttachTarget(null)}
      />
    </DndContext>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Library draggable
// ────────────────────────────────────────────────────────────────────────────

function LibraryItem({ asset }: { asset: Asset }) {
  const type = inferType(asset)
  const name = assetName(asset)
  const thumb = assetThumbnailUrl(asset)
  const meta = assetMeta(asset, type)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `lib:${name}`,
    data: { source: 'library', asset, label: name },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      title={name}
      className={cn(
        'group flex items-center gap-2 p-1.5 rounded border border-transparent hover:border-outline-variant hover:bg-surface-bright cursor-grab active:cursor-grabbing transition-colors',
        isDragging && 'opacity-30',
      )}
    >
      <Icon
        name="drag_indicator"
        size={16}
        className="text-text-muted opacity-40 group-hover:opacity-100 shrink-0"
      />
      <div className="w-9 h-9 rounded overflow-hidden bg-black border border-border-industrial shrink-0 flex items-center justify-center">
        {thumb ? (
          <img src={thumb} alt={name} loading="lazy" className="w-full h-full object-cover opacity-80" />
        ) : (
          <Icon name={iconFor(type)} size={16} className="text-text-muted opacity-60" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-body-sm text-on-surface truncate">{name}</p>
        {meta && <p className="font-mono text-[9px] text-text-muted">{meta}</p>}
      </div>
    </div>
  )
}

function assetMeta(asset: Asset, type: AssetType): string {
  const parts: string[] = []
  const dur = Number(asset.duration)
  if ((type === 'video' || type === 'audio') && dur > 0) parts.push(formatDuration(dur))
  const w = asset.resolution?.width
  const h = asset.resolution?.height
  if (type === 'image' && w && h) parts.push(`${w}x${h}`)
  const size = formatBytes(asset.size)
  if (size) parts.push(size)
  return parts.join(' • ')
}

function assetTime(a: Asset): number {
  const v = a.ctime ?? a.createdAt ?? a.mtime
  const t = v ? new Date(v).getTime() : NaN
  return isNaN(t) ? 0 : t
}

function iconFor(type: AssetType): string {
  switch (type) {
    case 'video':
      return 'movie'
    case 'image':
      return 'image'
    case 'audio':
      return 'music_note'
    case 'html':
      return 'code'
    case 'link':
      return 'link'
    default:
      return 'description'
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Timeline + sortable rows
// ────────────────────────────────────────────────────────────────────────────

function timelineId(index: number): string {
  return `tl:${index}`
}

function Timeline({
  assets,
  otherZones,
  totalSec,
  onRemove,
  onUpdate,
  onDuplicate,
  onAttach,
  onDetach,
}: {
  assets: PlaylistAsset[]
  otherZones: LayoutZone[]
  totalSec: number
  onRemove: (idx: number) => void
  onUpdate: (idx: number, patch: Partial<PlaylistAsset>) => void
  onDuplicate: (idx: number) => void
  onAttach: (idx: number, zone: AttachZone) => void
  onDetach: (idx: number, zone: AttachZone) => void
}) {
  const ids = assets.map((_, i) => timelineId(i))
  const { setNodeRef, isOver } = useDroppable({ id: 'drop:timeline' })

  return (
    <Card className={cn('p-4 flex flex-col min-h-[420px]', isOver && 'border-primary/60')}>
      <header className="flex justify-between items-center mb-3">
        <div>
          <p className="text-label-caps text-text-muted uppercase tracking-wider">Sequence</p>
          <p className="text-body-sm text-text-vibrant font-mono">
            {assets.length} {assets.length === 1 ? 'item' : 'items'} · {formatDuration(totalSec)}
          </p>
        </div>
      </header>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            'flex-1 flex flex-col gap-2 rounded-industrial border border-dashed transition-colors p-2',
            isOver ? 'border-primary bg-primary/5' : 'border-border-industrial',
          )}
        >
          {assets.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-12 text-text-muted">
              <Icon name="drag_handle" size={32} />
              <p className="text-body-md">Drop assets from the library to build the sequence.</p>
            </div>
          ) : (
            assets.map((asset, idx) => (
              <SortableTimelineItem
                key={timelineId(idx)}
                id={timelineId(idx)}
                asset={asset}
                otherZones={otherZones}
                onRemove={() => onRemove(idx)}
                onUpdate={(patch) => onUpdate(idx, patch)}
                onDuplicate={() => onDuplicate(idx)}
                onAttach={(zone) => onAttach(idx, zone)}
                onDetach={(zone) => onDetach(idx, zone)}
              />
            ))
          )}
        </div>
      </SortableContext>
    </Card>
  )
}

function SortableTimelineItem({
  id,
  asset,
  otherZones,
  onRemove,
  onUpdate,
  onDuplicate,
  onAttach,
  onDetach,
}: {
  id: string
  asset: PlaylistAsset
  otherZones: LayoutZone[]
  onRemove: () => void
  onUpdate: (patch: Partial<PlaylistAsset>) => void
  onDuplicate: () => void
  onAttach: (zone: AttachZone) => void
  onDetach: (zone: AttachZone) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { source: 'timeline', label: asset.filename },
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  const type = typeFromName(asset.filename)
  const setOption = (patch: Partial<NonNullable<PlaylistAsset['option']>>) =>
    onUpdate({ option: { ...(asset.option ?? {}), ...patch } })

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-col gap-2 p-2 rounded-industrial bg-surface-container border border-border-industrial"
    >
      {/* Row 1 — drag, name, duration, duplicate, remove */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Drag to reorder"
          className="cursor-grab text-text-muted hover:text-text-vibrant"
          {...listeners}
          {...attributes}
        >
          <Icon name="drag_indicator" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-body-md text-text-vibrant truncate">{asset.filename}</p>
          <p className="font-mono text-[10px] text-text-muted uppercase">{type}</p>
        </div>
        <label className="flex items-center gap-1 text-body-sm text-text-muted">
          <input
            type="number"
            min={1}
            value={asset.duration ?? 10}
            onChange={(e) => onUpdate({ duration: Number(e.target.value) })}
            className="w-14 h-7 bg-canvas-depth-1 border border-border-industrial rounded px-2 text-body-sm text-text-vibrant text-right font-mono focus:outline-none focus:border-primary"
          />
          s
        </label>
        <button
          type="button"
          aria-label="Duplicate"
          title="Duplicate this asset"
          onClick={onDuplicate}
          className="text-text-muted hover:text-primary p-1"
        >
          <Icon name="content_copy" size={16} />
        </button>
        <button
          type="button"
          aria-label={`Remove ${asset.filename}`}
          onClick={onRemove}
          className="text-text-muted hover:text-status-offline p-1"
        >
          <Icon name="close" size={16} />
        </button>
      </div>

      {/* Row 2 — options + zone attachments */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-8">
        <label className="flex items-center gap-1.5 text-body-sm text-text-muted cursor-pointer">
          <Switch
            checked={!!asset.fullscreen}
            onCheckedChange={(v) => onUpdate({ fullscreen: v })}
          />
          show fullscreen
        </label>

        {type === 'video' && (
          <label className="flex items-center gap-1.5 text-body-sm text-text-muted cursor-pointer">
            <Switch checked={!!asset.option?.main} onCheckedChange={(v) => setOption({ main: v })} />
            mute audio
          </label>
        )}

        {(type === 'image' || type === 'video') && (
          <input
            type="text"
            value={asset.option?.bannerText ?? ''}
            onChange={(e) => setOption({ bannerText: e.target.value })}
            placeholder="text message over the image/video"
            className="flex-1 min-w-[180px] h-7 bg-canvas-depth-1 border border-border-industrial rounded px-2 text-body-sm text-text-vibrant focus:outline-none focus:border-primary"
          />
        )}

        {otherZones.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-label-caps text-text-muted uppercase">Add zone content:</span>
            {otherZones.map((zone) => {
              const id = zone.id as AttachZone
              const label = zoneDisplayLabel(zone)
              const val = asset[id]
              return (
                <span key={id} className="inline-flex items-center">
                  <button
                    type="button"
                    onClick={() => onAttach(id)}
                    className={cn(
                      'inline-flex items-center gap-1 px-2 h-6 rounded-l text-[11px] border transition-colors',
                      val
                        ? 'border-primary bg-primary/10 text-primary rounded-r-none'
                        : 'border-border-industrial text-text-muted hover:border-outline-variant rounded',
                    )}
                    title={val ? String(val) : `Attach a file/playlist to the ${label} zone`}
                  >
                    <Icon name="attach_file" size={13} />
                    {label}{val ? `: ${zoneValueLabel(String(val))}` : ''}
                  </button>
                  {val && (
                    <button
                      type="button"
                      onClick={() => onDetach(id)}
                      aria-label={`Clear ${label} zone`}
                      className="inline-flex items-center justify-center w-6 h-6 rounded-r border border-l-0 border-primary bg-primary/10 text-primary hover:bg-status-offline/20 hover:text-status-offline"
                    >
                      <Icon name="close" size={13} />
                    </button>
                  )}
                </span>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/** Friendly label for a zone attachment value (file name or "__playlist.json"). */
function zoneValueLabel(value: string): string {
  if (value.startsWith('__') && value.endsWith('.json')) return value.slice(2, -5)
  return value
}

// ────────────────────────────────────────────────────────────────────────────
// Zone attach dialog (file OR playlist, matching the legacy linkfile popup)
// ────────────────────────────────────────────────────────────────────────────

function ZoneAttachDialog({
  target,
  current,
  onSelect,
  onClose,
}: {
  target: { index: number; zone: AttachZone } | null
  current: string | null
  onSelect: (value: string) => void
  onClose: () => void
}) {
  const open = target !== null
  const [tab, setTab] = useState<'files' | 'playlists'>('files')
  const [search, setSearch] = useState('')

  const assetsQuery = useQuery({ queryKey: ['assets'], queryFn: fetchAssets, staleTime: 60_000, enabled: open })
  const playlistsQuery = useQuery({ queryKey: ['playlists'], queryFn: fetchPlaylists, staleTime: 60_000, enabled: open })

  // Legacy excludes audio / live-stream / CORS links from zone files.
  const files = (assetsQuery.data ?? [])
    .filter((a) => {
      const t = inferType(a)
      return t !== 'audio'
    })
    .map(assetName)
    .filter((n) => n && n.toLowerCase().includes(search.toLowerCase()))

  const playlists = (playlistsQuery.data ?? [])
    .map((p) => p.name)
    .filter((n) => n.toLowerCase().includes(search.toLowerCase()))

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            File to play in the <span className="text-primary capitalize">{target?.zone}</span> zone
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 border-b border-border-industrial">
          {(['files', 'playlists'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'px-3 py-1.5 text-body-sm capitalize border-b-2 -mb-px transition-colors',
                tab === t
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-text-vibrant',
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by name…"
          className="h-8"
        />

        <div className="max-h-72 overflow-y-auto -mx-1 px-1 flex flex-col gap-1">
          {tab === 'files'
            ? files.map((name) => (
                <ZoneOption
                  key={name}
                  label={name}
                  active={current === name}
                  onClick={() => onSelect(name)}
                />
              ))
            : playlists.map((name) => {
                const value = `__${name}.json`
                return (
                  <ZoneOption
                    key={name}
                    label={name}
                    icon="queue_music"
                    active={current === value}
                    onClick={() => onSelect(value)}
                  />
                )
              })}
          {((tab === 'files' && files.length === 0) ||
            (tab === 'playlists' && playlists.length === 0)) && (
            <p className="text-body-sm text-text-muted text-center py-6">Nothing to show.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ZoneOption({
  label,
  icon = 'description',
  active,
  onClick,
}: {
  label: string
  icon?: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-text-vibrant hover:bg-surface-container-high',
      )}
    >
      <Icon name={icon} size={16} className="text-text-muted shrink-0" />
      <span className="truncate text-body-sm">{label}</span>
      {active && <Icon name="check" size={16} className="text-primary ml-auto shrink-0" />}
    </button>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Layout preview (static — informational)
// ────────────────────────────────────────────────────────────────────────────

function LayoutPreview({ zones }: { zones: LayoutZone[] }) {
  return (
    <div className="aspect-video bg-surface-container-lowest border border-border-industrial rounded-industrial relative">
      {zones.map((z, i) => (
        <div
          key={i}
          className={cn(
            'absolute flex items-center justify-center border-2 text-label-caps uppercase',
            z.id === 'main'
              ? 'border-primary bg-primary/15 text-primary'
              : 'border-outline-variant bg-surface-container text-text-muted',
          )}
          style={{
            left: `${z.x * 100}%`,
            top: `${z.y * 100}%`,
            width: `${z.w * 100}%`,
            height: `${z.h * 100}%`,
          }}
        >
          {zoneDisplayLabel(z)}
        </div>
      ))}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Insertion helper (flat main timeline)
// ────────────────────────────────────────────────────────────────────────────

function insertAfter(
  existing: PlaylistAsset[],
  incoming: PlaylistAsset,
  targetId: string,
): PlaylistAsset[] {
  const next = [...existing]
  const match = /^tl:(\d+)$/.exec(targetId)
  if (!match) {
    next.push(incoming) // dropped on the empty droppable → append
    return next
  }
  next.splice(Number(match[1]) + 1, 0, incoming)
  return next
}
