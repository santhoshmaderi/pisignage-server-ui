import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Icon } from '@/components/Icon'
import { cn } from '@/lib/utils'
import { saveGroupTicker, type Group, type GroupTicker } from '@/lib/groups'

const inputCls =
  'bg-surface-container-low border border-border-industrial rounded px-3 py-2 text-data-mono focus:border-primary focus:outline-none placeholder:text-outline'

export function GroupTickerDialog({
  group,
  open,
  onOpenChange,
  onSaved,
}: {
  group: Group
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [t, setT] = useState<GroupTicker>(() => seed(group.ticker))

  useEffect(() => {
    if (open) setT(seed(group.ticker))
  }, [open, group])

  const set = (patch: Partial<GroupTicker>) => setT((cur) => ({ ...cur, ...patch }))
  const setRss = (patch: Partial<NonNullable<GroupTicker['rss']>>) =>
    setT((cur) => ({ ...cur, rss: { ...cur.rss, ...patch } }))

  const saveMut = useMutation({
    mutationFn: () => saveGroupTicker(group._id, t),
    onSuccess: () => {
      onSaved()
      onOpenChange(false)
    },
  })

  const isHardware = t.behavior === 'openvg_left' || t.behavior === 'openvg_right'
  const heightStr = t.tickerHeight == null ? '' : String(t.tickerHeight)
  const isCustomHeight = heightStr !== '' && heightStr !== '60' && heightStr !== '100'

  return (
    <Dialog open={open} onOpenChange={(o) => !saveMut.isPending && onOpenChange(o)}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="px-8 pt-8 pb-4 mb-0">
          <DialogTitle className="text-headline-md flex items-center gap-3">
            <Icon name="subtitles" className="text-primary" />
            Group Ticker Configuration
          </DialogTitle>
          <DialogDescription className="text-body-sm">
            Configure the scrolling ticker for all players in “{group.name}”. Saved settings
            apply when you Deploy the group.
          </DialogDescription>
        </DialogHeader>
        <hr className="border-border-industrial/50 mx-8" />

        <div className="px-8 py-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Visibility */}
          <Row label="Ticker">
            <div className="flex flex-wrap gap-6">
              <Check checked={!!t.enable} onChange={(v) => set({ enable: v })} label="Show" />
              <Check
                checked={!!t.bannerText}
                onChange={(v) => set({ bannerText: v })}
                label="Show asset associated text"
              />
            </div>
          </Row>

          {t.enable && (
            <>
              {/* Type + Hardware (single behavior field) */}
              <Row label="Type" align="start">
                <div className="flex flex-wrap gap-4">
                  <Radio name="behavior" checked={t.behavior === 'slide'} onChange={() => set({ behavior: 'slide' })} label="Slide" />
                  <Radio name="behavior" checked={t.behavior === 'scroll'} onChange={() => set({ behavior: 'scroll' })} label="Scroll left" />
                  <Radio name="behavior" checked={t.behavior === 'scrollRight'} onChange={() => set({ behavior: 'scrollRight' })} label="Scroll right" />
                </div>
              </Row>
              <Row label="Hardware">
                <div className="flex flex-wrap gap-4">
                  <Radio name="behavior" checked={t.behavior === 'openvg_left'} onChange={() => set({ behavior: 'openvg_left' })} label="left" />
                  <Radio name="behavior" checked={t.behavior === 'openvg_right'} onChange={() => set({ behavior: 'openvg_right' })} label="right" />
                </div>
              </Row>

              {/* CSS (software modes) */}
              {!isHardware && (
                <Row label="Optional CSS">
                  <input
                    type="text"
                    value={t.style ?? ''}
                    onChange={(e) => set({ style: e.target.value })}
                    placeholder="e.g. color:#eee; font-style:italic;"
                    className={cn(inputCls, 'w-full')}
                  />
                </Row>
              )}

              {/* Hardware-only geometry */}
              {isHardware && (
                <>
                  <Row label="Font / Width">
                    <div className="flex flex-wrap gap-3">
                      <NumText value={t.tickerFontSize} onChange={(v) => set({ tickerFontSize: v })} placeholder="28" title="Font size" />
                      <NumText value={t.tickerWidth} onChange={(v) => set({ tickerWidth: v })} placeholder="0 (full)" title="Width" />
                    </div>
                  </Row>
                  <Row label="X / Y position">
                    <div className="flex flex-wrap gap-3">
                      <NumText value={t.tickerX} onChange={(v) => set({ tickerX: v })} placeholder="0 (left)" title="x position" />
                      <NumText value={t.tickerY} onChange={(v) => set({ tickerY: v })} placeholder="0 (bottom)" title="y position" />
                    </div>
                  </Row>
                </>
              )}

              {/* Speed */}
              <Row label="Ticker Speed">
                <div className="flex flex-wrap gap-4">
                  <Radio name="speed" checked={String(t.textSpeed) === '1'} onChange={() => set({ textSpeed: '1' })} label="Slow" />
                  <Radio name="speed" checked={String(t.textSpeed) === '2'} onChange={() => set({ textSpeed: '2' })} label="Medium" />
                  <Radio name="speed" checked={String(t.textSpeed) === '3'} onChange={() => set({ textSpeed: '3' })} label="Full" />
                </div>
              </Row>

              {/* Height */}
              <Row label="Ticker Height">
                <div className="flex flex-wrap items-center gap-4">
                  <Radio name="height" checked={heightStr === '60'} onChange={() => set({ tickerHeight: '60' })} label="Default (60px)" />
                  <Radio name="height" checked={heightStr === '100'} onChange={() => set({ tickerHeight: '100' })} label="Large (100px)" />
                  <div className="flex items-center gap-2">
                    <Radio
                      name="height"
                      checked={isCustomHeight}
                      onChange={() => set({ tickerHeight: heightStr && isCustomHeight ? heightStr : '' })}
                      label="Custom"
                    />
                    <input
                      type="number"
                      value={isCustomHeight ? heightStr : ''}
                      onChange={(e) => set({ tickerHeight: e.target.value })}
                      placeholder="60"
                      className={cn(inputCls, 'w-20')}
                    />
                  </div>
                </div>
              </Row>

              {/* RSS toggle */}
              <Row label="RSS Feed">
                <Check
                  checked={!!t.rss?.enable}
                  onChange={(v) => setRss({ enable: v })}
                  label="Use RSS feed"
                />
              </Row>

              {t.rss?.enable ? (
                <>
                  <Row label="Item duration">
                    <input
                      type="number"
                      value={t.rss?.feedDelay ?? ''}
                      onChange={(e) => setRss({ feedDelay: e.target.value === '' ? undefined : Number(e.target.value) })}
                      placeholder="RSS item duration (slide mode)"
                      className={cn(inputCls, 'w-full')}
                    />
                  </Row>
                  <Row label="RSS feed Link">
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={t.rss?.link ?? ''}
                        onChange={(e) => setRss({ link: e.target.value })}
                        placeholder="enter your rss link…"
                        className={cn(inputCls, 'w-full')}
                      />
                      <Check
                        checked={!!t.rss?.encodeAsBinary}
                        onChange={(v) => setRss({ encodeAsBinary: v })}
                        label="Use binary encoding (if characters display incorrectly)"
                      />
                      <Check
                        checked={!!t.rss?.useDescription}
                        onChange={(v) => setRss({ useDescription: v })}
                        label="Use description field instead of title"
                      />
                    </div>
                  </Row>
                </>
              ) : (
                <div className="space-y-2">
                  <label className="text-text-muted text-label-caps uppercase block">
                    Add Messages for the ticker
                  </label>
                  <textarea
                    rows={4}
                    value={t.messages ?? ''}
                    onChange={(e) => set({ messages: e.target.value })}
                    placeholder="Hello from piSignage player"
                    className="w-full bg-surface-container-low border border-border-industrial rounded px-3 py-3 text-body-md text-text-vibrant focus:border-primary focus:outline-none placeholder:text-outline resize-none"
                  />
                  <p className="text-text-muted text-body-sm italic">
                    Each line is treated as a separate message item.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-surface-container-high px-8 py-5 flex justify-end gap-4 border-t border-border-industrial">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={saveMut.isPending}
            className="px-6 py-2 border border-border-industrial text-text-muted hover:bg-surface-container-high rounded text-label-caps uppercase transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
            className="px-8 py-2 bg-primary text-on-primary hover:bg-primary-container rounded text-label-caps uppercase font-bold transition-colors disabled:opacity-50"
          >
            {saveMut.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
        {saveMut.error != null && (
          <p className="px-8 pb-4 text-body-sm text-status-offline" role="alert">
            {saveMut.error instanceof Error ? saveMut.error.message : 'Save failed'}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Apply the old UI's defaults to a (possibly empty) ticker object. */
function seed(ticker?: GroupTicker): GroupTicker {
  return {
    enable: ticker?.enable ?? false,
    bannerText: ticker?.bannerText ?? false,
    behavior: ticker?.behavior ?? 'slide',
    style: ticker?.style ?? '',
    tickerFontSize: ticker?.tickerFontSize,
    tickerWidth: ticker?.tickerWidth,
    tickerX: ticker?.tickerX,
    tickerY: ticker?.tickerY,
    textSpeed: ticker?.textSpeed ?? '3',
    tickerHeight: ticker?.tickerHeight ?? '60',
    messages: ticker?.messages ?? '',
    rss: {
      enable: ticker?.rss?.enable ?? false,
      link: ticker?.rss?.link ?? '',
      feedDelay: ticker?.rss?.feedDelay ?? 10,
      encodeAsBinary: ticker?.rss?.encodeAsBinary ?? false,
      useDescription: ticker?.rss?.useDescription ?? false,
    },
  }
}

function Row({
  label,
  align = 'center',
  children,
}: {
  label: string
  align?: 'center' | 'start'
  children: React.ReactNode
}) {
  return (
    <div className={cn('grid grid-cols-4 gap-4', align === 'center' ? 'items-center' : 'items-start')}>
      <label className={cn('col-span-1 text-text-muted text-label-caps uppercase', align === 'start' && 'pt-1')}>
        {label}
      </label>
      <div className="col-span-3">{children}</div>
    </div>
  )
}

function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-border-industrial bg-surface-container-low text-primary focus:ring-0"
      />
      <span className="text-body-md group-hover:text-text-vibrant">{label}</span>
    </label>
  )
}

function Radio({
  name,
  checked,
  onChange,
  label,
}: {
  name: string
  checked: boolean
  onChange: () => void
  label: string
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="w-4 h-4 border-border-industrial bg-surface-container-low text-primary focus:ring-0"
      />
      <span className="text-body-md">{label}</span>
    </label>
  )
}

function NumText({
  value,
  onChange,
  placeholder,
  title,
}: {
  value?: string | number
  onChange: (v: string) => void
  placeholder: string
  title: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] text-text-muted uppercase">{title}</span>
      <input
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(inputCls, 'w-28')}
      />
    </label>
  )
}

