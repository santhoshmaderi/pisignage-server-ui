import { Card } from '@/components/ui/card'
import { Icon } from '@/components/Icon'
import { cn } from '@/lib/utils'
import { LAYOUTS, type LayoutDef } from '@/lib/layouts'
import type { Playlist } from '@/lib/playlists'

export type LayoutSectionProps = {
  playlist: Playlist
  onChange: (next: Playlist) => void
}

export function LayoutSection({ playlist, onChange }: LayoutSectionProps) {
  const current = playlist.layout ?? '1'

  const handleSelect = (id: string) => {
    if (id === current) return
    onChange({ ...playlist, layout: id })
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <header className="flex flex-col gap-1 mb-4">
          <h3 className="text-headline-sm text-text-vibrant">Zone Layout</h3>
          <p className="text-body-sm text-text-muted">
            Layouts define which regions of the screen accept media. Changing the layout keeps
            existing assets — any whose zone no longer exists will fall back to the main zone
            on the player.
          </p>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {LAYOUTS.map((layout) => (
            <LayoutCard
              key={layout.id}
              layout={layout}
              active={current === layout.id}
              onClick={() => handleSelect(layout.id)}
            />
          ))}
        </div>
      </Card>

      <Card className="p-4 flex items-center gap-3 border-status-syncing/30 bg-status-syncing/5">
        <Icon name="info" className="text-status-syncing" />
        <p className="text-body-sm text-text-muted">
          Pisignage exposes more advanced layouts at the server level. Custom HTML templates
          are not editable from this console yet — set <span className="font-mono text-text-vibrant">templateName</span> directly in the JSON for those.
        </p>
      </Card>
    </div>
  )
}

function LayoutCard({
  layout,
  active,
  onClick,
}: {
  layout: LayoutDef
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group text-left rounded-lg border-2 p-4 transition-colors',
        active
          ? 'border-primary bg-primary/5'
          : 'border-border-industrial hover:border-outline-variant',
      )}
    >
      <div
        className={cn(
          'relative bg-surface-container-lowest rounded-industrial mb-3 overflow-hidden border border-border-industrial',
          layout.portrait ? 'aspect-[9/16] mx-auto max-w-[120px]' : 'aspect-video',
        )}
      >
        {layout.zones.map((z, i) => (
          <div
            key={i}
            className={cn(
              'absolute border',
              active ? 'border-primary bg-primary/15' : 'border-outline-variant bg-surface-container',
            )}
            style={{
              left: `${z.x * 100}%`,
              top: `${z.y * 100}%`,
              width: `${z.w * 100}%`,
              height: `${z.h * 100}%`,
            }}
          />
        ))}
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={cn(
              'text-body-md font-bold truncate',
              active ? 'text-primary' : 'text-text-vibrant',
            )}
          >
            {layout.name}
          </p>
          <p className="text-body-sm text-text-muted line-clamp-2">{layout.description}</p>
        </div>
        {active && <Icon name="check_circle" className="text-primary" size={20} filled />}
      </div>
      <p className="text-data-mono text-[11px] text-text-muted mt-2 font-mono">
        id: {layout.id} · {layout.zones.length} {layout.zones.length === 1 ? 'zone' : 'zones'}
      </p>
    </button>
  )
}
