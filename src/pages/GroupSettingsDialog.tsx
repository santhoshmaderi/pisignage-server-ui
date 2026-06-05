import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Icon } from '@/components/Icon'
import { cn } from '@/lib/utils'
import { saveGroupSettings, type Group, type GroupSettings } from '@/lib/groups'
import { fetchAssets, assetName } from '@/lib/assets'

const inputCls =
  'bg-surface-container-low border border-border-industrial rounded px-3 py-2 text-data-mono focus:border-primary focus:outline-none placeholder:text-outline'

const RESOLUTIONS = [
  { value: 'auto', label: 'Auto based on TV settings (EDID)' },
  { value: '1080p', label: 'Full HD (1080p) 1920x1080' },
  { value: '720p', label: 'HD (720p) 1280x720' },
  { value: 'PAL', label: 'PAL (RCA) 720x576' },
  { value: 'NTSC', label: 'NTSC (RCA) 720x480' },
]

const ORIENTATIONS = [
  { value: 'landscape', label: 'Landscape' },
  { value: 'portrait', label: 'Portrait Right (Hardware)' },
  { value: 'portrait270', label: 'Portrait Left (Hardware)' },
  { value: 'invert', label: 'Vertical Flip' },
  { value: 'invert-horizontal', label: 'Horizontal Flip' },
]

// Row-major order so a 2-column grid reads: Mirror | Enable 4K / Tile Horz | Tile Vert.
const DUAL_MODES = [
  { value: 'mirror', label: 'Mirror Screens' },
  { value: '4k', label: 'Enable 4K' },
  { value: 'tile-horizontal', label: 'Tile Horizontal' },
  { value: 'tile-vertical', label: 'Tile Vertical' },
]

export function GroupSettingsDialog({
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
  const [s, setS] = useState<GroupSettings>(() => seed(group))

  useEffect(() => {
    if (open) setS(seed(group))
  }, [open, group])

  const set = (patch: Partial<GroupSettings>) => setS((cur) => ({ ...cur, ...patch }))
  const setClock = (patch: Partial<NonNullable<GroupSettings['showClock']>>) =>
    setS((cur) => ({ ...cur, showClock: { ...cur.showClock, ...patch } }))
  const setDual = (patch: Partial<NonNullable<GroupSettings['monitorArrangement']>>) =>
    setS((cur) => ({ ...cur, monitorArrangement: { ...cur.monitorArrangement, ...patch } }))
  const setSleep = (patch: Partial<NonNullable<GroupSettings['sleep']>>) =>
    setS((cur) => ({ ...cur, sleep: { ...cur.sleep, ...patch } }))
  const setReboot = (patch: Partial<NonNullable<GroupSettings['reboot']>>) =>
    setS((cur) => ({ ...cur, reboot: { ...cur.reboot, ...patch } }))
  const setKiosk = (patch: Partial<NonNullable<GroupSettings['kioskUi']>>) =>
    setS((cur) => ({ ...cur, kioskUi: { ...cur.kioskUi, ...patch } }))

  // Logo picker: png/image assets only.
  const assetsQuery = useQuery({ queryKey: ['assets'], queryFn: fetchAssets, staleTime: 60_000, enabled: open })
  const imageAssets = useMemo(
    () =>
      (assetsQuery.data ?? [])
        .filter((a) => String(a.type ?? '') === 'image')
        .map(assetName)
        .filter(Boolean),
    [assetsQuery.data],
  )

  const saveMut = useMutation({
    mutationFn: () => saveGroupSettings(group._id, s),
    onSuccess: () => {
      onSaved()
      onOpenChange(false)
    },
  })

  const num = (v: string): number | undefined => (v === '' ? undefined : Number(v))

  return (
    <Dialog open={open} onOpenChange={(o) => !saveMut.isPending && onOpenChange(o)}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="px-8 pt-8 pb-4 mb-0">
          <DialogTitle className="text-headline-md flex items-center gap-3">
            <Icon name="settings" className="text-primary" />
            Group Settings
          </DialogTitle>
          <DialogDescription className="text-body-sm">
            Display, orientation and player settings for all players in “{group.name}”. Saved
            settings apply when you Deploy the group.
          </DialogDescription>
        </DialogHeader>
        <hr className="border-border-industrial/50 mx-8" />

        <div className="px-8 py-6 space-y-6 max-h-[65vh] overflow-y-auto">
          {/* Resolution & Orientation — side by side */}
          <Row label="Resolution & Orientation" align="start">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              <div className="flex flex-col gap-2">
                {RESOLUTIONS.map((r) => (
                  <Radio
                    key={r.value}
                    name="resolution"
                    checked={s.resolution === r.value}
                    onChange={() => set({ resolution: r.value })}
                    label={r.label}
                  />
                ))}
              </div>
              <div className="flex flex-col gap-2">
                {ORIENTATIONS.map((o) => (
                  <Radio
                    key={o.value}
                    name="orientation"
                    checked={s.orientation === o.value}
                    onChange={() => set({ orientation: o.value })}
                    label={o.label}
                  />
                ))}
              </div>
            </div>
          </Row>

          {/* Dual screen */}
          <Row label="Dual Screen (Pi4, v4.x only)" align="start">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2">
              <div className="sm:col-span-2 grid grid-cols-2 gap-x-6 gap-y-2">
                {DUAL_MODES.map((m) => (
                  <Radio
                    key={m.value}
                    name="dual"
                    checked={s.monitorArrangement?.mode === m.value}
                    onChange={() => setDual({ mode: m.value })}
                    label={m.label}
                  />
                ))}
              </div>
              <Check
                checked={!!s.monitorArrangement?.reverse}
                onChange={(v) => setDual({ reverse: v })}
                label="Reverse order"
              />
            </div>
          </Row>

          {/* Animation — 3 columns × 2 rows */}
          <Row label="Animation" align="start">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
              <Radio
                name="anim"
                checked={s.animationEnable === false}
                onChange={() => set({ animationEnable: false, animationType: null })}
                label="Disable"
              />
              <Radio
                name="anim"
                checked={s.animationEnable !== false && s.animationType === 'right'}
                onChange={() => set({ animationEnable: true, animationType: 'right' })}
                label="Slide right"
              />
              <Radio
                name="anim"
                checked={s.animationEnable !== false && s.animationType === 'up'}
                onChange={() => set({ animationEnable: true, animationType: 'up' })}
                label="Slide up"
              />
              <Radio
                name="anim"
                checked={s.animationEnable !== false && s.animationType === 'blend'}
                onChange={() => set({ animationEnable: true, animationType: 'blend' })}
                label="Blend"
              />
              <Radio
                name="anim"
                checked={s.animationEnable !== false && s.animationType === 'left'}
                onChange={() => set({ animationEnable: true, animationType: 'left' })}
                label="Slide left"
              />
              <Radio
                name="anim"
                checked={s.animationEnable !== false && s.animationType === 'down'}
                onChange={() => set({ animationEnable: true, animationType: 'down' })}
                label="Slide down"
              />
            </div>
          </Row>

          <hr className="border-border-industrial/50" />

          {/* Background & Volume — one row */}
          <Row label="Background">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={s.signageBackgroundColor || '#000000'}
                  onChange={(e) => set({ signageBackgroundColor: e.target.value })}
                  className="h-9 w-14 bg-surface-container-low border border-border-industrial rounded p-1 cursor-pointer"
                />
                <span className="text-data-mono text-text-muted uppercase">
                  {s.signageBackgroundColor || '#000000'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-text-muted text-body-sm uppercase">Volume (%)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={s.omxVolume ?? ''}
                  onChange={(e) => set({ omxVolume: num(e.target.value) })}
                  placeholder="100"
                  className={cn(inputCls, 'w-24')}
                />
              </div>
            </div>
          </Row>

          {/* Logo — picker + x/y inline */}
          <Row label="Show Logo">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={s.logo ?? ''}
                onChange={(e) => set({ logo: e.target.value || null })}
                className={cn(inputCls, 'flex-1 min-w-[12rem] appearance-none')}
              >
                <option value="">Select a png image from Assets</option>
                {/* Keep the current value selectable even if not in the image list. */}
                {s.logo && !imageAssets.includes(s.logo) && <option value={s.logo}>{s.logo}</option>}
                {imageAssets.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              {s.logo && (
                <button
                  type="button"
                  onClick={() => set({ logo: null })}
                  aria-label="Clear logo"
                  className="px-2 py-1 border border-border-industrial text-text-muted hover:text-status-offline rounded transition-colors"
                >
                  <Icon name="close" size={16} />
                </button>
              )}
              <input
                type="text"
                value={s.logox ?? ''}
                onChange={(e) => set({ logox: e.target.value })}
                placeholder="x pos"
                className={cn(inputCls, 'w-20')}
              />
              <input
                type="text"
                value={s.logoy ?? ''}
                onChange={(e) => set({ logoy: e.target.value })}
                placeholder="y pos"
                className={cn(inputCls, 'w-20')}
              />
            </div>
          </Row>

          {/* Display clock */}
          <Row label="Display Clock" align="start">
            <div className="space-y-3">
              <Check
                checked={!!s.showClock?.enable}
                onChange={(v) => setClock({ enable: v })}
                label="Show clock"
              />
              {s.showClock?.enable && (
                <>
                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    <Radio name="clockpos" checked={s.showClock?.position === 'top'} onChange={() => setClock({ position: 'top' })} label="Top" />
                    <Radio name="clockpos" checked={s.showClock?.position === 'bottom'} onChange={() => setClock({ position: 'bottom' })} label="Bottom" />
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    <Radio name="clockfmt" checked={String(s.showClock?.format) === '12'} onChange={() => setClock({ format: '12' })} label="12 hr" />
                    <Radio name="clockfmt" checked={String(s.showClock?.format) === '24'} onChange={() => setClock({ format: '24' })} label="24 hr" />
                    <Radio name="clockfmt" checked={String(s.showClock?.format) === '12d'} onChange={() => setClock({ format: '12d' })} label="date+12h" />
                    <Radio name="clockfmt" checked={String(s.showClock?.format) === '24d'} onChange={() => setClock({ format: '24d' })} label="date+24h" />
                  </div>
                </>
              )}
            </div>
          </Row>

          <hr className="border-border-industrial/50" />

          {/* Fit image / video */}
          <Row label="Fit Image">
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Radio name="fitimg" checked={s.imageSize === 0} onChange={() => set({ imageSize: 0 })} label="Actual" />
              <Radio name="fitimg" checked={s.imageSize === 1} onChange={() => set({ imageSize: 1 })} label="Letterbox" />
              <Radio name="fitimg" checked={s.imageSize === 2} onChange={() => set({ imageSize: 2 })} label="Stretched" />
            </div>
          </Row>
          <Row label="Fit Video">
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Radio name="fitvid" checked={s.videoSize === 1} onChange={() => set({ videoSize: 1 })} label="Letterbox" />
              <Radio name="fitvid" checked={s.videoSize === 2} onChange={() => set({ videoSize: 2 })} label="Stretched" />
            </div>
          </Row>

          <hr className="border-border-industrial/50" />

          {/* URL reload — side by side */}
          <Row label="URL Reload">
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <Check
                checked={s.urlReloadDisable !== true}
                onChange={(v) => set({ urlReloadDisable: !v })}
                label="Reload link URLs each time"
              />
              <Check
                checked={!!s.keepWeblinksInMemory}
                onChange={(v) => set({ keepWeblinksInMemory: v })}
                label="Keep webpages in memory"
              />
            </div>
          </Row>

          {/* Break video */}
          <Row label="Break Video">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="number"
                value={s.timeToStopVideo ?? ''}
                onChange={(e) => set({ timeToStopVideo: num(e.target.value) })}
                placeholder="0"
                className={cn(inputCls, 'w-24')}
              />
              <span className="text-text-muted text-body-sm">
                seconds — stop video after every N secs (0 to disable) to show adverts
              </span>
            </div>
          </Row>

          <hr className="border-border-industrial/50" />

          {/* Schedule display off */}
          <Row label="Schedule Off" align="start">
            <div className="space-y-3">
              <Check
                checked={!!s.sleep?.enable}
                onChange={(v) => setSleep({ enable: v })}
                label="Enable scheduled display OFF"
              />
              {s.sleep?.enable && (
                <div className="flex flex-wrap gap-4">
                  <TimeField label="ON at" value={s.sleep?.ontime} onChange={(v) => setSleep({ ontime: v })} />
                  <TimeField label="OFF at" value={s.sleep?.offtime} onChange={(v) => setSleep({ offtime: v })} />
                </div>
              )}
              <p className="text-text-muted text-body-sm italic">
                For finer control use the TV_OFF playlist under group scheduling.
              </p>
            </div>
          </Row>

          {/* Daily reboot */}
          <Row label="Daily Reboot" align="start">
            <div className="space-y-3">
              <Check
                checked={!!s.reboot?.enable}
                onChange={(v) => setReboot({ enable: v })}
                label="Enable optional daily reboot"
              />
              {s.reboot?.enable && (
                <TimeField label="reboot at" value={s.reboot?.absoluteTime} onChange={(v) => setReboot({ absoluteTime: v })} />
              )}
            </div>
          </Row>

          {/* Kiosk menu */}
          <Row label="Kiosk Menu" align="start">
            <div className="space-y-3">
              <Check
                checked={!!s.kioskUi?.enable}
                onChange={(v) => setKiosk({ enable: v })}
                label="Enable kiosk menu"
              />
              {s.kioskUi?.enable && (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={s.kioskUi?.url ?? ''}
                    onChange={(e) => setKiosk({ url: e.target.value })}
                    placeholder="URL — leave blank for default"
                    className={cn(inputCls, 'w-full')}
                  />
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={s.kioskUi?.timeout ?? ''}
                      onChange={(e) => setKiosk({ timeout: num(e.target.value) })}
                      placeholder="30"
                      className={cn(inputCls, 'w-24')}
                    />
                    <span className="text-text-muted text-body-sm">inactivity timeout (secs)</span>
                  </div>
                </div>
              )}
            </div>
          </Row>

          <hr className="border-border-industrial/50" />

          {/* Video player */}
          <Row label="Video Play" align="start">
            <div className="space-y-3">
              <Radio
                name="vplayer"
                checked={(s.selectedVideoPlayer ?? 'default') === 'default'}
                onChange={() => set({ selectedVideoPlayer: 'default' })}
                label="Default (omxplayer <4, chromium ≥4.x)"
              />
              <div className="space-y-2">
                <Radio
                  name="vplayer"
                  checked={s.selectedVideoPlayer === 'mpv'}
                  onChange={() => set({ selectedVideoPlayer: 'mpv' })}
                  label="MPV (avoids gaps between videos, certain YouTube streams)"
                />
                {s.selectedVideoPlayer === 'mpv' && (
                  <div className="flex items-center gap-3 pl-6">
                    <input
                      type="text"
                      value={s.mpvAudioDelay ?? ''}
                      onChange={(e) => set({ mpvAudioDelay: e.target.value })}
                      placeholder="0"
                      className={cn(inputCls, 'w-24')}
                    />
                    <span className="text-text-muted text-body-sm">Optional Audio-Video Delay (secs)</span>
                  </div>
                )}
              </div>
              <Radio
                name="vplayer"
                checked={s.selectedVideoPlayer === 'cvlc'}
                onChange={() => set({ selectedVideoPlayer: 'cvlc' })}
                label="VLC (Experimental — 4K support ≥4.x on Raspberry Pi)"
              />
            </div>
          </Row>

          <hr className="border-border-industrial/50" />

          {/* Player settings — two columns */}
          <Row label="Player settings" align="start">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
              <div className="space-y-2">
                <Check checked={!!s.disableAp} onChange={(v) => set({ disableAp: v })} label="Disable player wifi AP" />
                <Check checked={!!s.disableWebUi} onChange={(v) => set({ disableWebUi: v })} label="Disable player webUI" />
              </div>
              <div className="space-y-2">
              <label className="flex items-start gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={!!s.disableWarnings}
                  onChange={(e) => set({ disableWarnings: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded border-border-industrial bg-surface-container-low text-primary focus:ring-0"
                />
                <span className="text-body-md leading-tight">
                  <span className="text-status-offline">Disable player power/temperature warning</span>
                  <br />
                  <span className="text-text-muted text-body-sm italic">use caution as this may damage the hardware</span>
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={!!s.enablePio}
                  onChange={(e) => set({ enablePio: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded border-border-industrial bg-surface-container-low text-primary focus:ring-0"
                />
                <span className="text-body-md leading-tight group-hover:text-text-vibrant">
                  Enable GPIO media control (17, 18, 27)
                  <br />
                  <a
                    href="https://github.com/colloqi/piSignage/blob/master/GPIO%20media%20control%20Instructions.md"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary text-body-sm hover:underline"
                  >
                    for details refer GPIO instructions
                  </a>
                </span>
              </label>
              </div>
            </div>
          </Row>
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

/** Seed the dialog draft from the group, applying the old UI's defaults. */
function seed(group: Group): GroupSettings {
  const clock =
    group.showClock && typeof group.showClock === 'object'
      ? group.showClock
      : { enable: !!group.showClock }
  return {
    resolution: group.resolution ?? 'auto',
    orientation: group.orientation ?? 'landscape',
    monitorArrangement: {
      mode: group.monitorArrangement?.mode ?? 'mirror',
      reverse: group.monitorArrangement?.reverse ?? false,
    },
    animationEnable: group.animationEnable,
    animationType: group.animationType ?? null,
    signageBackgroundColor: group.signageBackgroundColor ?? '#000000',
    omxVolume: group.omxVolume,
    logo: group.logo ?? null,
    logox: group.logox,
    logoy: group.logoy,
    showClock: {
      enable: clock.enable ?? false,
      format: clock.format ?? '12',
      position: clock.position ?? 'bottom',
    },
    // imageSize: resizeAssets ? (imageLetterboxed ? 1 : 2) : 0
    imageSize: group.resizeAssets ? (group.imageLetterboxed ? 1 : 2) : 0,
    // videoSize: videoKeepAspect ? 1 : 2
    videoSize: group.videoKeepAspect ? 1 : 2,
    urlReloadDisable: group.urlReloadDisable,
    keepWeblinksInMemory: group.keepWeblinksInMemory ?? false,
    timeToStopVideo: group.timeToStopVideo,
    sleep: {
      enable: group.sleep?.enable ?? false,
      ontime: group.sleep?.ontime ?? '',
      offtime: group.sleep?.offtime ?? '',
    },
    reboot: {
      enable: group.reboot?.enable ?? false,
      absoluteTime: group.reboot?.absoluteTime ?? '',
    },
    kioskUi: {
      enable: group.kioskUi?.enable ?? false,
      url: group.kioskUi?.url ?? '',
      timeout: group.kioskUi?.timeout,
    },
    selectedVideoPlayer: group.enableMpv ? 'mpv' : group.selectedVideoPlayer ?? 'default',
    mpvAudioDelay: group.mpvAudioDelay ?? '',
    disableAp: group.disableAp ?? false,
    disableWebUi: group.disableWebUi ?? false,
    disableWarnings: group.disableWarnings ?? false,
    enablePio: group.enablePio ?? false,
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

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string
  value?: string
  onChange: (v: string) => void
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-[10px] text-text-muted uppercase">{label}</span>
      <input
        type="time"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={cn(inputCls, 'w-32')}
      />
    </label>
  )
}
