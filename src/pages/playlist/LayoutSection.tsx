import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Icon } from '@/components/Icon'
import { cn } from '@/lib/utils'
import { LAYOUTS, findLayout, zoneDisplayLabel, type LayoutDef } from '@/lib/layouts'
import { fetchAssets, assetName } from '@/lib/assets'
import type { Playlist, VideoWindow } from '@/lib/playlists'

export type LayoutSectionProps = {
  playlist: Playlist
  onChange: (next: Playlist) => void
}

type Tab = 'layouts' | 'main' | 'zones'

export function LayoutSection({ playlist, onChange }: LayoutSectionProps) {
  const [tab, setTab] = useState<Tab>('layouts')
  const current = playlist.layout ?? '1'
  const activeLayout = findLayout(current)

  // Custom layouts require a custom_layout.html asset (like the legacy UI,
  // which disables them otherwise).
  const assetsQuery = useQuery({ queryKey: ['assets'], queryFn: fetchAssets, staleTime: 60_000 })
  // Any custom_layout*.html file qualifies (matches the legacy customTemplates filter).
  const customTemplates = (assetsQuery.data ?? [])
    .map(assetName)
    .filter((n) => /^custom_layout.*\.html$/i.test(n))
  const hasCustomTemplate = customTemplates.length > 0

  const selectLayout = (l: LayoutDef) => {
    if (l.id === current) return
    onChange({
      ...playlist,
      layout: l.id,
      // Custom layouts render from an uploaded custom_layout*.html file. Keep the
      // playlist's current file if still valid, else default to the first one.
      ...(l.custom
        ? {
            templateName:
              playlist.templateName && customTemplates.includes(playlist.templateName)
                ? playlist.templateName
                : (customTemplates[0] ?? ''),
          }
        : {}),
    })
  }

  const setTemplateName = (name: string) => onChange({ ...playlist, templateName: name })

  const setVideoWindow = (vw: VideoWindow | null) =>
    onChange({ ...playlist, videoWindow: vw })

  const setZoneVideoWindow = (zone: string, vw: VideoWindow | null) => {
    const next = { ...(playlist.zoneVideoWindow ?? {}) }
    if (vw === null) delete next[zone]
    else next[zone] = vw
    onChange({ ...playlist, zoneVideoWindow: next })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-border-industrial">
        <TabButton active={tab === 'layouts'} onClick={() => setTab('layouts')} icon="dashboard">
          Layouts
        </TabButton>
        <TabButton active={tab === 'main'} onClick={() => setTab('main')} icon="smart_display">
          Main Video Window
        </TabButton>
        <TabButton active={tab === 'zones'} onClick={() => setTab('zones')} icon="view_quilt">
          Side / Bottom Video Window
        </TabButton>
      </div>

      {tab === 'layouts' && (
        <Card className="p-5">
          <header className="flex flex-col gap-1 mb-4">
            <h3 className="text-headline-sm text-text-vibrant">Select Display Layout</h3>
            <p className="text-body-sm text-text-muted">
              The display can be divided into zones, each playing different content. Video files
              play only in the main zone. If no file is attached to a zone, its previous content
              keeps playing.
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {LAYOUTS.map((layout) => (
              <LayoutCard
                key={layout.id}
                layout={layout}
                active={current === layout.id}
                disabled={!!layout.custom && !hasCustomTemplate}
                onClick={() => selectLayout(layout)}
              />
            ))}
          </div>

          {activeLayout.custom && hasCustomTemplate && (
            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <span className="text-label-caps text-text-muted uppercase">Layout file</span>
              <div className="relative">
                <select
                  value={playlist.templateName ?? ''}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="appearance-none h-9 bg-canvas-depth-1 border border-border-industrial rounded-industrial pl-3 pr-9 text-body-sm text-text-vibrant focus:outline-none focus:border-primary"
                >
                  <option value="" disabled>
                    Select a custom_layout*.html file
                  </option>
                  {customTemplates.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <Icon
                  name="arrow_drop_down"
                  size={20}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                />
              </div>
            </div>
          )}

          {!hasCustomTemplate && (
            <p className="text-body-sm text-text-muted mt-4 flex items-center gap-2">
              <Icon name="info" size={16} className="text-status-syncing" />
              Custom layouts are disabled until a{' '}
              <span className="font-mono text-text-vibrant">custom_layout*.html</span> file is
              uploaded under Assets.
            </p>
          )}
        </Card>
      )}

      {tab === 'main' && (
        <Card className="p-5 flex flex-col gap-5 border-l-4 border-l-primary">
          <header className="flex items-center gap-2">
            <Icon name="smart_display" size={20} className="text-primary" />
            <h3 className="text-headline-sm text-text-vibrant">Main Zone Video Window</h3>
          </header>

          <div className="flex items-start gap-2.5 rounded-industrial border border-status-offline/30 bg-status-offline/5 p-3">
            <Icon name="warning" size={18} className="text-status-offline shrink-0 mt-0.5" />
            <p className="text-body-sm text-text-muted">
              <strong className="text-text-vibrant">Advanced users only.</strong> Any change affects
              the video display size. <span className="font-mono text-text-vibrant">Width</span> /{' '}
              <span className="font-mono text-text-vibrant">Height</span> set the window size;{' '}
              <span className="font-mono text-text-vibrant">Left-Offset</span> /{' '}
              <span className="font-mono text-text-vibrant">Top-Offset</span> set its position. If
              something looks wrong, hit <strong className="text-text-vibrant">Restore Defaults</strong>.
            </p>
          </div>

          <VideoWindowFields
            value={playlist.videoWindow ?? {}}
            onChange={(vw) => setVideoWindow(vw)}
          />

          <label className="flex items-center justify-between gap-3 rounded-industrial border border-border-industrial bg-canvas-depth-1/40 p-3 cursor-pointer">
            <span className="text-body-md text-text-vibrant">
              Use as full-screen dimensions also{' '}
              <span className="text-text-muted">(for custom displays)</span>
            </span>
            {/* Legacy: checked => mainzoneOnly = false (use these dims full-screen too). */}
            <Switch
              checked={playlist.videoWindow?.mainzoneOnly !== true}
              onCheckedChange={(v) =>
                setVideoWindow({ ...(playlist.videoWindow ?? {}), mainzoneOnly: !v })
              }
            />
          </label>

          <RestoreLink onClick={() => setVideoWindow(null)}>Restore Defaults</RestoreLink>
        </Card>
      )}

      {tab === 'zones' && (
        <Card className="p-5 flex flex-col gap-5">
          <header>
            <h3 className="text-headline-sm text-text-vibrant">Change video window position for other zones</h3>
            <p className="text-body-sm text-text-muted mt-1 italic">
              For custom layouts only — changing any parameter affects the video display size in the
              side and bottom zones.
            </p>
          </header>

          {(['side', 'bottom'] as const).map((zone) => {
            const vw = playlist.zoneVideoWindow?.[zone] ?? {}
            const isSet = Object.values(vw).some((v) => v !== undefined && v !== '')
            return (
              <div
                key={zone}
                className="rounded-industrial border border-border-industrial border-l-4 border-l-primary bg-canvas-depth-1/40 p-4 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-label-caps text-primary uppercase tracking-wider">
                    <Icon name={zone === 'side' ? 'view_sidebar' : 'view_agenda'} size={18} />
                    {zone} Zone Values
                  </span>
                  <span
                    className={cn(
                      'px-2 py-0.5 text-[10px] rounded uppercase font-bold tracking-wide',
                      isSet
                        ? 'bg-primary/10 text-primary'
                        : 'bg-surface-container text-text-muted',
                    )}
                  >
                    {isSet ? 'Set' : 'Default'}
                  </span>
                </div>
                <VideoWindowFields value={vw} onChange={(next) => setZoneVideoWindow(zone, next)} />
                <RestoreLink onClick={() => setZoneVideoWindow(zone, null)}>
                  Restore {zone} zone defaults
                </RestoreLink>
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}

function VideoWindowFields({
  value,
  onChange,
}: {
  value: VideoWindow
  onChange: (vw: VideoWindow) => void
}) {
  const set = (patch: Partial<VideoWindow>) => onChange({ ...value, ...patch })
  // pisignage's field naming: `length` is the window WIDTH, `width` is the HEIGHT.
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <UnitField label="Width" value={value.length} placeholder="auto" onChange={(v) => set({ length: v })} />
      <UnitField label="Height" value={value.width} placeholder="auto" onChange={(v) => set({ width: v })} />
      <UnitField label="Left-Offset" value={value.xoffset} placeholder="0" onChange={(v) => set({ xoffset: v })} />
      <UnitField label="Top-Offset" value={value.yoffset} placeholder="0" onChange={(v) => set({ yoffset: v })} />
    </div>
  )
}

function UnitField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value?: number | string
  placeholder?: string
  onChange: (v: string) => void
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-label-caps text-text-muted uppercase">{label}</span>
      <div className="relative">
        <input
          type="number"
          inputMode="numeric"
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-9 bg-canvas-depth-1 border border-border-industrial rounded-industrial pl-3 pr-9 text-body-md font-mono text-text-vibrant placeholder:text-text-muted/50 focus:outline-none focus:border-primary transition-colors"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-body-sm text-text-muted pointer-events-none select-none">
          px
        </span>
      </div>
    </label>
  )
}

function RestoreLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-1.5 self-start text-label-caps uppercase tracking-wide text-primary hover:underline"
    >
      <Icon
        name="restart_alt"
        size={16}
        className="transition-transform duration-500 group-hover:-rotate-180"
      />
      {children}
    </button>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2 text-body-md border-b-2 -mb-px transition-colors',
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-text-muted hover:text-text-vibrant',
      )}
    >
      <Icon name={icon} size={18} />
      {children}
    </button>
  )
}

function LayoutCard({
  layout,
  active,
  disabled,
  onClick,
}: {
  layout: LayoutDef
  active: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group text-left rounded-lg border-2 p-4 transition-colors',
        disabled && 'opacity-40 cursor-not-allowed',
        active
          ? 'border-primary bg-primary/5'
          : 'border-border-industrial hover:border-outline-variant',
      )}
    >
      <div
        className={cn(
          'relative bg-surface-container-lowest rounded-industrial mb-3 overflow-hidden border border-border-industrial',
          layout.portrait ? 'aspect-[9/16] mx-auto max-w-[90px]' : 'aspect-video',
        )}
      >
        {layout.zones.map((z, i) => (
          <div
            key={i}
            className={cn(
              'absolute border flex items-center justify-center',
              active ? 'border-primary bg-primary/15' : 'border-outline-variant bg-surface-container',
            )}
            style={{
              left: `${z.x * 100}%`,
              top: `${z.y * 100}%`,
              width: `${z.w * 100}%`,
              height: `${z.h * 100}%`,
            }}
          >
            <span className="text-[8px] uppercase text-text-muted">{zoneDisplayLabel(z)}</span>
          </div>
        ))}
        {layout.custom && (
          <div className="absolute inset-0 flex items-center justify-center text-text-muted font-bold">
            C
          </div>
        )}
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={cn(
              'text-body-md font-bold',
              active ? 'text-primary' : 'text-text-vibrant',
            )}
          >
            {layout.name}
          </p>
          <p className="text-body-sm text-text-muted">{layout.description}</p>
        </div>
        {active && <Icon name="check_circle" className="text-primary shrink-0" size={20} filled />}
      </div>
      <p className="text-[11px] text-text-muted mt-2 font-mono">id: {layout.id}</p>
    </button>
  )
}

