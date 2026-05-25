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
import { Icon } from '@/components/Icon'
import { cn } from '@/lib/utils'
import { assetName, assetThumbnailUrl, fetchAssets, inferType, type Asset, type AssetType } from '@/lib/assets'
import { findLayout, type LayoutZone } from '@/lib/layouts'
import {
  formatDuration,
  totalDuration,
  type Playlist,
  type PlaylistAsset,
} from '@/lib/playlists'

export type SequenceSectionProps = {
  playlist: Playlist
  onChange: (next: Playlist) => void
}

const LIBRARY_TYPES: { value: AssetType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'video', label: 'Video' },
  { value: 'image', label: 'Image' },
  { value: 'html', label: 'HTML' },
]

const DEFAULT_DURATION: Record<AssetType, number> = {
  video: 0, // honored by player
  image: 10,
  html: 30,
  link: 30,
  audio: 0,
  folder: 0,
  other: 10,
}

export function SequenceSection({ playlist, onChange }: SequenceSectionProps) {
  const layout = findLayout(playlist.layout)
  const zones = layout.zones
  const [activeZone, setActiveZone] = useState<string>(zones[0]?.id ?? 'main')

  const assetsQuery = useQuery({ queryKey: ['assets'], queryFn: fetchAssets, staleTime: 60_000 })
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<AssetType | 'all'>('all')

  const libraryAssets = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (assetsQuery.data ?? []).filter((a) => {
      if (typeFilter !== 'all' && inferType(a) !== typeFilter) return false
      if (term && !assetName(a).toLowerCase().includes(term)) return false
      return true
    })
  }, [assetsQuery.data, search, typeFilter])

  const zoneAssets = useMemo(
    () => playlist.assets.filter((a) => (a.option?.zone ?? 'main') === activeZone),
    [playlist.assets, activeZone],
  )

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const [activeDragLabel, setActiveDragLabel] = useState<string | null>(null)

  const handleDragStart = (e: DragStartEvent) => {
    setActiveDragLabel(String(e.active.data.current?.label ?? e.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragLabel(null)
    const { active, over } = event
    if (!over) return

    const fromLibrary = active.data.current?.source === 'library'
    const fromTimeline = active.data.current?.source === 'timeline'

    // Drop from library → into the active zone's timeline.
    if (fromLibrary) {
      const file = active.data.current?.asset as Asset | undefined
      if (!file) return
      const fname = assetName(file)
      if (!fname) return
      const newAsset: PlaylistAsset = {
        filename: fname,
        duration: DEFAULT_DURATION[inferType(file)] || 10,
        selected: true,
        fullscreen: false,
        option: { zone: activeZone },
      }
      const nextAssets = insertAfter(playlist.assets, newAsset, String(over.id), activeZone)
      onChange({ ...playlist, assets: nextAssets })
      return
    }

    // Reorder within the timeline.
    if (fromTimeline && active.id !== over.id) {
      const ids = zoneAssets.map((_, i) => timelineId(activeZone, i))
      const oldIndex = ids.indexOf(String(active.id))
      const newIndex = ids.indexOf(String(over.id))
      if (oldIndex < 0 || newIndex < 0) return
      const reordered = arrayMove(zoneAssets, oldIndex, newIndex)
      // Rebuild playlist.assets with reordered chunk in place.
      const next: PlaylistAsset[] = []
      let r = 0
      for (const a of playlist.assets) {
        if ((a.option?.zone ?? 'main') === activeZone) {
          next.push(reordered[r++])
        } else {
          next.push(a)
        }
      }
      onChange({ ...playlist, assets: next })
    }
  }

  const removeFromTimeline = (idx: number) => {
    const next = [...playlist.assets]
    let nth = -1
    for (let i = 0; i < next.length; i++) {
      if ((next[i].option?.zone ?? 'main') === activeZone) nth++
      if (nth === idx) {
        next.splice(i, 1)
        break
      }
    }
    onChange({ ...playlist, assets: next })
  }

  const updateAsset = (idx: number, patch: Partial<PlaylistAsset>) => {
    const next = [...playlist.assets]
    let nth = -1
    for (let i = 0; i < next.length; i++) {
      if ((next[i].option?.zone ?? 'main') === activeZone) nth++
      if (nth === idx) {
        next[i] = { ...next[i], ...patch }
        break
      }
    }
    onChange({ ...playlist, assets: next })
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
          <div className="overflow-y-auto -mx-1 px-1 grid grid-cols-2 gap-2 min-h-0">
            {assetsQuery.isLoading ? (
              <p className="col-span-2 text-body-sm text-text-muted text-center py-6">
                Loading assets…
              </p>
            ) : libraryAssets.length === 0 ? (
              <p className="col-span-2 text-body-sm text-text-muted text-center py-6">
                No assets match.
              </p>
            ) : (
              libraryAssets.map((asset, i) => (
                <LibraryItem key={assetName(asset) || `idx-${i}`} asset={asset} />
              ))
            )}
          </div>
        </Card>

        {/* Timeline */}
        <div className="col-span-12 lg:col-span-6 flex flex-col gap-3">
          {zones.length > 1 && (
            <div className="flex gap-1 bg-canvas-depth-1 p-1 rounded-industrial border border-border-industrial self-start">
              {zones.map((z) => (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => setActiveZone(z.id)}
                  className={cn(
                    'px-3 py-1 rounded text-body-sm transition-colors',
                    activeZone === z.id
                      ? 'bg-surface-variant text-text-vibrant'
                      : 'text-text-muted hover:text-text-vibrant',
                  )}
                >
                  {zoneLabel(z)}
                </button>
              ))}
            </div>
          )}

          <Timeline
            zone={activeZone}
            assets={zoneAssets}
            totalSec={totalDuration(playlist, activeZone)}
            onRemove={removeFromTimeline}
            onUpdate={updateAsset}
          />
        </div>

        {/* Layout preview */}
        <Card className="col-span-12 lg:col-span-3 p-4 self-start">
          <h3 className="text-headline-sm text-text-vibrant mb-3">Layout</h3>
          <LayoutPreview zones={zones} activeZone={activeZone} onZoneClick={setActiveZone} />
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
        </Card>
      </div>

      <DragOverlay>
        {activeDragLabel ? (
          <div className="px-3 py-1.5 rounded-industrial bg-primary text-on-primary text-body-sm font-bold shadow-lg">
            {activeDragLabel}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Library draggable
// ────────────────────────────────────────────────────────────────────────────

function LibraryItem({ asset }: { asset: Asset }) {
  const type = inferType(asset)
  const name = assetName(asset)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `lib:${name}`,
    data: { source: 'library', asset, label: name },
  })

  return (
    <button
      type="button"
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'group text-left rounded-industrial overflow-hidden border border-border-industrial hover:border-primary/50 bg-surface-container-low transition-colors',
        isDragging && 'opacity-30',
      )}
    >
      <div className="aspect-video bg-surface-container relative flex items-center justify-center">
        {assetThumbnailUrl(asset) ? (
          <img src={assetThumbnailUrl(asset)!} alt={name} className="w-full h-full object-cover" />
        ) : (
          <Icon name={iconFor(type)} size={28} className="opacity-50 text-text-muted" />
        )}
        <span className="absolute top-1 right-1 bg-surface/80 backdrop-blur p-0.5 rounded">
          <Icon name={iconFor(type)} size={12} className="text-primary" />
        </span>
      </div>
      <p className="px-2 py-1.5 text-body-sm text-text-vibrant truncate">{name}</p>
    </button>
  )
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
// Timeline + sortable items
// ────────────────────────────────────────────────────────────────────────────

function timelineId(zone: string, index: number): string {
  return `tl:${zone}:${index}`
}

function Timeline({
  zone,
  assets,
  totalSec,
  onRemove,
  onUpdate,
}: {
  zone: string
  assets: PlaylistAsset[]
  totalSec: number
  onRemove: (idx: number) => void
  onUpdate: (idx: number, patch: Partial<PlaylistAsset>) => void
}) {
  const ids = assets.map((_, i) => timelineId(zone, i))
  const { setNodeRef, isOver } = useDroppable({ id: `drop:${zone}` })

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
                key={timelineId(zone, idx)}
                id={timelineId(zone, idx)}
                asset={asset}
                onRemove={() => onRemove(idx)}
                onUpdate={(patch) => onUpdate(idx, patch)}
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
  onRemove,
  onUpdate,
}: {
  id: string
  asset: PlaylistAsset
  onRemove: () => void
  onUpdate: (patch: Partial<PlaylistAsset>) => void
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
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-2 rounded-industrial bg-surface-container border border-border-industrial"
    >
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
        {asset.option?.zone && (
          <p className="text-body-sm text-text-muted font-mono">zone: {asset.option.zone}</p>
        )}
      </div>
      <label className="flex items-center gap-1 text-body-sm text-text-muted">
        <input
          type="number"
          min={0}
          value={asset.duration ?? 10}
          onChange={(e) => onUpdate({ duration: Number(e.target.value) })}
          className="w-14 h-7 bg-canvas-depth-1 border border-border-industrial rounded px-2 text-body-sm text-text-vibrant text-right font-mono focus:outline-none focus:border-primary"
        />
        s
      </label>
      <button
        type="button"
        aria-label={`Remove ${asset.filename}`}
        onClick={onRemove}
        className="text-text-muted hover:text-status-offline p-1"
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Layout preview
// ────────────────────────────────────────────────────────────────────────────

function LayoutPreview({
  zones,
  activeZone,
  onZoneClick,
}: {
  zones: LayoutZone[]
  activeZone: string
  onZoneClick: (id: string) => void
}) {
  return (
    <div className="aspect-video bg-surface-container-lowest border border-border-industrial rounded-industrial relative">
      {zones.map((z, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onZoneClick(z.id)}
          className={cn(
            'absolute flex items-center justify-center border-2 transition-colors text-label-caps uppercase',
            activeZone === z.id
              ? 'border-primary bg-primary/15 text-primary'
              : 'border-outline-variant bg-surface-container text-text-muted hover:border-outline',
          )}
          style={{
            left: `${z.x * 100}%`,
            top: `${z.y * 100}%`,
            width: `${z.w * 100}%`,
            height: `${z.h * 100}%`,
          }}
        >
          {z.id}
        </button>
      ))}
    </div>
  )
}

function zoneLabel(z: LayoutZone): string {
  return z.id.toUpperCase()
}

// ────────────────────────────────────────────────────────────────────────────
// Insertion helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Insert `incoming` into `existing` after the timeline item identified by
 * `targetId`. If the target is the empty drop zone (`drop:<zone>`) or not
 * found, appends to the end of the active zone.
 */
function insertAfter(
  existing: PlaylistAsset[],
  incoming: PlaylistAsset,
  targetId: string,
  zone: string,
): PlaylistAsset[] {
  const next = [...existing]
  const match = /^tl:[^:]+:(\d+)$/.exec(targetId)
  if (!match) {
    // Drop on the empty droppable — append at the end of this zone.
    let lastIdx = -1
    for (let i = 0; i < next.length; i++) {
      if ((next[i].option?.zone ?? 'main') === zone) lastIdx = i
    }
    next.splice(lastIdx + 1, 0, incoming)
    return next
  }
  const zoneIdx = Number(match[1])
  let nth = -1
  for (let i = 0; i < next.length; i++) {
    if ((next[i].option?.zone ?? 'main') === zone) nth++
    if (nth === zoneIdx) {
      next.splice(i + 1, 0, incoming)
      return next
    }
  }
  next.push(incoming)
  return next
}
