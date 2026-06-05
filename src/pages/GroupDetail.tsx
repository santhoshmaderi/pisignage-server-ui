import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  buildGroupPlaylists,
  collectGroupAssets,
  deployGroup,
  saveEmergencyMessage,
  updateGroup,
  type EmergencyMessage,
  type Group,
  type GroupPlaylist,
  type PlaylistRef,
  type PlaylistSchedule,
} from '@/lib/groups'
import { fetchPlaylists } from '@/lib/playlists'
import { GroupTickerDialog } from './GroupTickerDialog'
import { GroupSettingsDialog } from './GroupSettingsDialog'

/** Shared pill style for the group action buttons (matches the Assets filter chips). */
const GROUP_PILL = 'px-3 py-1 rounded-full border text-label-caps uppercase tracking-wider transition-colors'
/** Neutral (inactive) pill colors — used when the feature isn't enabled. */
const GROUP_PILL_IDLE =
  'border-border-industrial text-text-muted hover:border-outline-variant hover:text-text-vibrant'

/** Normalize the group's playlists (strings or objects) to typed entries. */
function toEntries(refs?: PlaylistRef[]): GroupPlaylist[] {
  return (refs ?? []).map((r) =>
    typeof r === 'string'
      ? { name: r }
      : { name: r.name ?? '', plType: r.plType, settings: (r as { settings?: PlaylistSchedule }).settings },
  )
}

function fmtTime(v?: string): string {
  if (!v) return ''
  // Many forks store "HH:mm"; others store an ISO/Date string.
  if (/^\d{1,2}:\d{2}$/.test(v)) return v
  const d = new Date(v)
  return isNaN(d.getTime()) ? v : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(v?: string): string {
  if (!v) return ''
  const d = new Date(v)
  return isNaN(d.getTime()) ? v : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function scheduleSummary(s?: PlaylistSchedule): string {
  if (!s) return ''
  const parts: string[] = []
  if (s.timeEnable && s.starttime && s.endtime) parts.push(`${fmtTime(s.starttime)} - ${fmtTime(s.endtime)}`)
  if (s.durationEnable && s.startdate && s.enddate) parts.push(`${fmtDate(s.startdate)} - ${fmtDate(s.enddate)}`)
  return parts.join('  ·  ')
}

export function GroupDetail({
  group,
  onClose,
  onChanged,
}: {
  group: Group
  onClose: () => void
  onChanged: () => void
}) {
  // Local draft, seeded from the group. Each change persists via updateGroup
  // (the server merges the patch onto the group), mirroring the old UI.
  const [playlists, setPlaylists] = useState<GroupPlaylist[]>(() => toEntries(group.playlists))
  const [combineDefaultPlaylist, setCombine] = useState(!!group.combineDefaultPlaylist)
  const [playAllEligiblePlaylists, setPlayAll] = useState(!!group.playAllEligiblePlaylists)
  const [shuffleContent, setShuffle] = useState(!!group.shuffleContent)
  const [emergencyOpen, setEmergencyOpen] = useState(false)
  const [tickerOpen, setTickerOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const playlistsQuery = useQuery({ queryKey: ['playlists'], queryFn: fetchPlaylists, staleTime: 60_000 })
  const playlistNames = useMemo(
    () => (playlistsQuery.data ?? []).map((p) => p.name).filter(Boolean),
    [playlistsQuery.data],
  )

  const saveMut = useMutation({
    mutationFn: (patch: Partial<Group>) => updateGroup(group._id, patch),
    onSuccess: onChanged,
  })

  const deployMut = useMutation({
    mutationFn: () =>
      // Expand the group's playlists into the concrete file list the server syncs
      // to players (the server does not compute this — see collectGroupAssets).
      // Use the local `playlists` draft, not the `group` prop, which is a stale
      // snapshot from when the detail view opened (the prop isn't re-passed after
      // edits, so it can miss a playlist you just assigned).
      deployGroup(group._id, {
        assets: collectGroupAssets({ playlists: playlists as PlaylistRef[], logo: group.logo }, playlistsQuery.data ?? []),
        // Annotate each playlist (plType/skipForSchedule + behavior settings) so
        // the player schedules it after a reboot — not just on the live sync.
        playlists: buildGroupPlaylists({ playlists: playlists as PlaylistRef[] }, playlistsQuery.data ?? []),
      }),
    onSuccess: onChanged,
  })

  // Auto-clear the success banner after a few seconds; errors persist until the
  // next deploy attempt so the user can read the reason (e.g. "No Players associated").
  useEffect(() => {
    if (!deployMut.isSuccess) return
    const t = setTimeout(() => deployMut.reset(), 4000)
    return () => clearTimeout(t)
  }, [deployMut.isSuccess, deployMut])

  const defaultName = playlists[0]?.name ?? ''
  const additional = playlists.slice(1)

  // Persist the playlists array, keeping local state in sync.
  const commitPlaylists = (next: GroupPlaylist[]) => {
    setPlaylists(next)
    saveMut.mutate({ playlists: next as unknown as PlaylistRef[] })
  }

  const setDefault = (name: string) => {
    const next = [...playlists]
    if (next.length === 0) next.push({ name })
    else next[0] = { ...next[0], name }
    commitPlaylists(next)
  }

  const addAdditional = () => {
    // Ensure a default slot exists so additions land at index >= 1.
    const next = playlists.length === 0 ? [{ name: '' }] : [...playlists]
    next.push({ name: '', plType: 'regular', settings: {} })
    commitPlaylists(next)
  }

  const setAdditionalName = (idx: number, name: string) => {
    const actual = idx + 1
    const next = [...playlists]
    next[actual] = { ...next[actual], name }
    commitPlaylists(next)
  }

  const removeAdditional = (idx: number) => {
    const next = [...playlists]
    next.splice(idx + 1, 1)
    commitPlaylists(next)
  }

  const toggleFlag = (
    key: 'combineDefaultPlaylist' | 'playAllEligiblePlaylists' | 'shuffleContent',
    value: boolean,
  ) => {
    if (key === 'combineDefaultPlaylist') setCombine(value)
    if (key === 'playAllEligiblePlaylists') setPlayAll(value)
    if (key === 'shuffleContent') setShuffle(value)
    saveMut.mutate({ [key]: value } as Partial<Group>)
  }

  const canDeploy = playlists.some((p) => p.name)

  return (
    <Card className="p-0 overflow-hidden">
      {/* Header / actions */}
      <div className="p-6 border-b border-border-industrial flex flex-wrap items-center justify-between gap-4 bg-surface-container/50">
        <div className="flex items-center gap-3">
          <h3 className="text-headline-md text-primary">{group.name}</h3>
          <span className="px-2 py-0.5 rounded bg-status-online/10 text-status-online border border-status-online/20 text-label-caps uppercase">
            Active
          </span>
          {saveMut.isPending && <span className="text-body-sm text-text-muted">Saving…</span>}
          {deployMut.isError && (
            <span className="flex items-center gap-1 text-body-sm text-status-offline" role="alert">
              <Icon name="error" size={16} />
              {deployMut.error instanceof Error ? deployMut.error.message : 'Deploy failed'}
            </span>
          )}
          {deployMut.isSuccess && (
            <span className="flex items-center gap-1 text-body-sm text-status-online">
              <Icon name="check_circle" size={16} />
              Deployed to {group.name}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setEmergencyOpen(true)}
            className={cn(
              GROUP_PILL,
              group.emergencyMessage?.enable
                ? 'border-status-offline text-status-offline bg-status-offline/10'
                : GROUP_PILL_IDLE,
            )}
          >
            Emergency Message
          </button>
          <button
            onClick={() => setTickerOpen(true)}
            className={cn(
              GROUP_PILL,
              group.ticker?.enable
                ? 'border-primary text-primary bg-primary/10'
                : GROUP_PILL_IDLE,
            )}
          >
            Group Ticker
          </button>
          <button onClick={() => setSettingsOpen(true)} className={cn(GROUP_PILL, GROUP_PILL_IDLE)}>
            Group Settings
          </button>
          <Button onClick={() => deployMut.mutate()} disabled={!canDeploy || deployMut.isPending}>
            {deployMut.isPending ? 'Deploying…' : `Deploy to ${group.name}`}
          </Button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface-container-highest text-text-muted hover:text-text-vibrant rounded text-body-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Config */}
      <div className="p-6 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Default playlist + options */}
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="block text-headline-sm text-text-vibrant">Default Playlist for the group</label>
              <Select value={defaultName} onChange={setDefault} options={playlistNames} placeholder="-- none --" />
            </div>

            <div className="space-y-4 pt-2">
              <CheckRow
                checked={combineDefaultPlaylist}
                onChange={(v) => toggleFlag('combineDefaultPlaylist', v)}
                label="Play together with scheduled playlist (v1.7.0+)"
              />
              <CheckRow
                checked={playAllEligiblePlaylists}
                onChange={(v) => toggleFlag('playAllEligiblePlaylists', v)}
                label="Combine content of all scheduled playlists"
              />
              <CheckRow
                checked={shuffleContent}
                onChange={(v) => toggleFlag('shuffleContent', v)}
                label="Shuffle content before deploying"
              />
            </div>
          </div>

          {/* Additional playlists */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-headline-sm text-text-vibrant">Additional Playlists</label>
              <button
                onClick={addAdditional}
                disabled={!defaultName}
                className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Icon name="add" size={16} />
                <span className="text-label-caps uppercase">Add</span>
              </button>
            </div>
            {additional.length === 0 ? (
              <div className="p-4 border border-dashed border-border-industrial rounded-xl text-center bg-surface-container/20">
                <p className="text-text-muted text-body-sm">
                  Select additional playlists for Scheduling / Advertising purposes
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {additional.map((pl, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Select
                      value={pl.name}
                      onChange={(name) => setAdditionalName(i, name)}
                      options={playlistNames}
                      placeholder="-- choose --"
                      className="flex-1"
                    />
                    <button
                      onClick={() => removeAdditional(i)}
                      aria-label="Remove playlist"
                      className="p-2 text-text-muted hover:text-status-offline transition-colors"
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Schedule table */}
        <div className="space-y-4">
          <h4 className="text-label-caps text-text-muted tracking-widest uppercase">Active Content Schedule</h4>
          <div className="overflow-hidden border border-border-industrial rounded-xl bg-surface-container/30">
            <div className="grid grid-cols-12 items-center p-4 border-b border-border-industrial text-label-caps text-text-muted uppercase">
              <div className="col-span-1">#</div>
              <div className="col-span-5">Playlist</div>
              <div className="col-span-4">Schedule</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>
            {additional.filter((p) => p.name).length === 0 ? (
              <div className="p-4 text-body-sm text-text-muted">
                No scheduled playlists. Add one above to schedule content.
              </div>
            ) : (
              additional.map((pl, i) =>
                pl.name ? (
                  <div
                    key={i}
                    className="grid grid-cols-12 items-center p-4 hover:bg-surface-container-high/50 transition-colors border-b border-border-industrial last:border-0"
                  >
                    <div className="col-span-1 font-data-mono text-text-muted">{i + 1}.</div>
                    <div className="col-span-5">
                      <div className="flex items-center gap-3">
                        <Icon name="schedule" size={18} className="text-tertiary" />
                        <span className="text-body-md text-text-vibrant">{pl.name}</span>
                        {pl.plType && pl.plType !== 'regular' && (
                          <span className="px-2 py-0.5 rounded bg-tertiary/10 text-tertiary text-[10px] border border-tertiary/20 uppercase">
                            {pl.plType}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="col-span-4">
                      <div className="flex items-center gap-2 text-text-muted font-data-mono text-body-sm">
                        <Icon name="calendar_today" size={14} />
                        <span>{scheduleSummary(pl.settings) || 'Always'}</span>
                      </div>
                    </div>
                    <div className="col-span-2 text-right">
                      <button
                        onClick={() => removeAdditional(i)}
                        aria-label={`Remove ${pl.name}`}
                        className="text-text-muted hover:text-status-offline transition-colors p-2"
                      >
                        <Icon name="close" size={16} />
                      </button>
                    </div>
                  </div>
                ) : null,
              )
            )}
          </div>
        </div>
      </div>
      <EmergencyMessageDialog
        group={group}
        open={emergencyOpen}
        onOpenChange={setEmergencyOpen}
        onSaved={onChanged}
      />

      <GroupTickerDialog
        group={group}
        open={tickerOpen}
        onOpenChange={setTickerOpen}
        onSaved={onChanged}
      />

      <GroupSettingsDialog
        group={group}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSaved={onChanged}
      />
    </Card>
  )
}

function EmergencyMessageDialog({
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
  const MAX = 140
  const [enable, setEnable] = useState(!!group.emergencyMessage?.enable)
  const [vPos, setVPos] = useState<string>(group.emergencyMessage?.vPos ?? 'top')
  const [msg, setMsg] = useState(group.emergencyMessage?.msg ?? '')

  // Re-seed from the group whenever the dialog (re)opens.
  useEffect(() => {
    if (open) {
      setEnable(!!group.emergencyMessage?.enable)
      setVPos(group.emergencyMessage?.vPos ?? 'top')
      setMsg(group.emergencyMessage?.msg ?? '')
    }
  }, [open, group])

  const saveMut = useMutation({
    mutationFn: () => {
      const em: EmergencyMessage = {
        enable,
        msg,
        vPos,
        // Old UI keeps horizontal position fixed at 'middle' (control hidden).
        hPos: group.emergencyMessage?.hPos ?? 'middle',
      }
      return saveEmergencyMessage(group._id, em)
    },
    onSuccess: () => {
      onSaved()
      onOpenChange(false)
    },
  })

  const positions: { value: string; label: string }[] = [
    { value: 'top', label: 'Top' },
    { value: 'middle', label: 'Middle' },
    { value: 'bottom', label: 'Bottom' },
  ]

  return (
    <Dialog open={open} onOpenChange={(o) => !saveMut.isPending && onOpenChange(o)}>
      <DialogContent className="max-w-xl p-0 overflow-hidden border-t-4 border-t-status-offline">
        <DialogHeader className="px-8 pt-8 pb-4 mb-0">
          <DialogTitle className="text-headline-md flex items-center gap-3">
            <Icon name="warning" className="text-status-offline" />
            Emergency Message Config
          </DialogTitle>
          <DialogDescription className="text-body-sm">
            Configure a high-priority overlay message shown on all players in this group.
          </DialogDescription>
        </DialogHeader>
        <hr className="border-border-industrial/50 mx-8" />

        <div className="px-8 py-6 space-y-6">
          <div className="grid grid-cols-12 gap-8">
            {/* Active status */}
            <div className="col-span-12 sm:col-span-4 flex flex-col gap-3">
              <span className="text-label-caps text-text-muted uppercase tracking-widest">Active Status</span>
              <label className="flex items-center gap-3 bg-surface-dim border border-border-industrial p-3 rounded-lg hover:border-primary/40 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={enable}
                  onChange={(e) => setEnable(e.target.checked)}
                  className="w-5 h-5 rounded bg-surface-container-low border-border-industrial text-status-offline focus:ring-status-offline"
                />
                <span className="text-body-md font-bold text-on-surface">Broadcast</span>
              </label>
            </div>

            {/* Vertical position */}
            <div className="col-span-12 sm:col-span-8 flex flex-col gap-3">
              <span className="text-label-caps text-text-muted uppercase tracking-widest">Vertical Position</span>
              <div className="grid grid-cols-3 gap-2 bg-surface-dim p-1.5 border border-border-industrial rounded-lg">
                {positions.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setVPos(p.value)}
                    disabled={!enable}
                    className={cn(
                      'flex flex-col items-center justify-center gap-1 py-2 rounded transition-all disabled:opacity-40 disabled:cursor-not-allowed',
                      vPos === p.value
                        ? 'bg-surface-container-high border border-primary/40 text-primary'
                        : 'text-text-muted hover:bg-surface-container hover:text-text-vibrant',
                    )}
                  >
                    <div
                      className={cn(
                        'w-6 h-1 rounded-full',
                        vPos === p.value ? 'bg-primary' : 'bg-text-muted/30',
                      )}
                    />
                    <span className="text-[10px] font-bold uppercase">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Message */}
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <span className="text-label-caps text-text-muted uppercase tracking-widest">Overlay Message</span>
              <span
                className={cn(
                  'text-[10px] font-data-mono',
                  msg.length > MAX ? 'text-status-offline' : 'text-text-muted',
                )}
              >
                {msg.length} / {MAX} characters
              </span>
            </div>
            <textarea
              value={msg}
              maxLength={MAX}
              disabled={!enable}
              onChange={(e) => setMsg(e.target.value)}
              rows={3}
              placeholder="e.g. FIRE DRILL: All personnel proceed to nearest exit."
              className="w-full bg-surface-dim border border-border-industrial rounded-lg px-4 py-4 text-body-md text-text-vibrant font-bold focus:ring-1 focus:ring-status-offline focus:border-status-offline outline-none transition-all resize-none disabled:opacity-50"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-surface-container-high px-8 py-6 flex justify-end items-center gap-6 border-t border-border-industrial">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={saveMut.isPending}
            className="text-body-sm font-bold text-text-muted hover:text-text-vibrant transition-all"
          >
            Discard Changes
          </button>
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending || (enable && !msg.trim())}
              className="px-8 py-3 rounded-lg bg-status-offline text-white font-extrabold shadow-lg shadow-status-offline/20 hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon name="send" size={20} />
              {saveMut.isPending ? 'DEPLOYING…' : 'CONFIRM DEPLOYMENT'}
            </button>
            <span className="text-[9px] text-status-offline/80 tracking-widest uppercase mr-2">
              {enable ? 'Immediate effect' : 'Will clear the message'}
            </span>
          </div>
        </div>
        {saveMut.error != null && (
          <p className="px-8 pb-4 text-body-sm text-status-offline" role="alert">
            {saveMut.error instanceof Error ? saveMut.error.message : 'Deploy failed'}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Select({
  value,
  onChange,
  options,
  placeholder,
  className,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder: string
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-surface-container border border-border-industrial rounded-lg px-4 py-3 text-body-md text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <Icon
        name="expand_more"
        className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted"
      />
    </div>
  )
}

function CheckRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="flex items-center gap-3 group cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5 rounded border-outline-variant bg-surface-container text-primary focus:ring-primary/20"
      />
      <span className="text-body-md text-text-vibrant group-hover:text-primary transition-colors">{label}</span>
    </label>
  )
}
