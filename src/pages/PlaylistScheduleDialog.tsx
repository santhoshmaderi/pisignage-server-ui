import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Icon } from '@/components/Icon'
import { cn } from '@/lib/utils'
import type { PlaylistSchedule } from '@/lib/groups'

/**
 * Per-playlist schedule editor for a group's additional playlists — the v2
 * equivalent of the old UI's schedule-calendar modal. It writes exactly the
 * fields the player's playlist selector reads:
 *   durationEnable + startdate/enddate  → ISO strings at UTC midnight
 *   timeEnable + starttime/endtime      → "HH:mm" (end < start = overnight)
 *   weekdays                            → 1 = Sunday … 7 = Saturday
 *   monthdays                           → 1 … 31
 */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] // id = index + 1
const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]
const ALL_MONTHDAYS = Array.from({ length: 31 }, (_, i) => i + 1)

const inputCls =
  'bg-surface-container-low border border-border-industrial rounded px-3 py-2 text-data-mono text-on-surface focus:border-primary focus:outline-none disabled:opacity-40'

type Draft = {
  durationEnable: boolean
  startdate: string // yyyy-mm-dd
  enddate: string // yyyy-mm-dd
  timeEnable: boolean
  starttime: string // HH:mm
  endtime: string // HH:mm
  weekdays: number[]
  monthdays: number[]
}

/** Stored ISO date (UTC midnight) → value for <input type="date">. */
function toDateInput(v?: string): string {
  if (!v) return ''
  const d = new Date(v)
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

/** <input type="date"> value → ISO at UTC midnight (what the old UI stored). */
function fromDateInput(v: string): string | undefined {
  return v ? new Date(`${v}T00:00:00.000Z`).toISOString() : undefined
}

/** Normalise a stored time ("8:00", "08:00", "x:08:00") to "HH:mm". */
function toTimeInput(v?: string): string {
  if (!v) return ''
  const parts = v.split(':')
  if (parts.length < 2) return ''
  const h = parseInt(parts[parts.length - 2], 10)
  const m = parseInt(parts[parts.length - 1], 10)
  if (isNaN(h) || isNaN(m)) return ''
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function seed(s: PlaylistSchedule | undefined): Draft {
  const today = new Date().toISOString().slice(0, 10)
  // Very old records stored a single weekday/monthday instead of the arrays.
  const weekdays =
    s?.weekdays ?? (s?.weekday ? [s.weekday] : ALL_WEEKDAYS)
  const monthdays =
    s?.monthdays ?? (s?.monthday ? [s.monthday] : ALL_MONTHDAYS)
  return {
    durationEnable: !!s?.durationEnable,
    startdate: toDateInput(s?.startdate) || today,
    enddate: toDateInput(s?.enddate) || toDateInput(s?.startdate) || today,
    timeEnable: !!s?.timeEnable,
    starttime: toTimeInput(s?.starttime) || '08:00',
    endtime: toTimeInput(s?.endtime) || '20:00',
    weekdays: [...weekdays].sort((a, b) => a - b),
    monthdays: [...monthdays].sort((a, b) => a - b),
  }
}

/** Merge the draft back onto the stored settings (keeps ads/domination/etc.). */
function toSettings(prev: PlaylistSchedule | undefined, d: Draft): PlaylistSchedule {
  const next: PlaylistSchedule = {
    ...(prev ?? {}),
    durationEnable: d.durationEnable,
    startdate: d.durationEnable ? fromDateInput(d.startdate) : prev?.startdate,
    enddate: d.durationEnable ? fromDateInput(d.enddate) : prev?.enddate,
    timeEnable: d.timeEnable,
    starttime: d.timeEnable ? d.starttime : prev?.starttime,
    endtime: d.timeEnable ? d.endtime : prev?.endtime,
    weekdays: d.weekdays,
    monthdays: d.monthdays,
  }
  // Backward compatibility with players < 1.7.0, which read a single day
  // (mirrors the old UI).
  if (d.weekdays.length > 0 && d.weekdays.length < 7) next.weekday = d.weekdays[0]
  else delete next.weekday
  if (d.monthdays.length > 0 && d.monthdays.length < 31) next.monthday = d.monthdays[0]
  else delete next.monthday
  // Date objects the old AngularJS UI kept for its time pickers; it rebuilds
  // them from starttime/endtime, so drop them rather than leave stale values.
  delete (next as Record<string, unknown>).starttimeObj
  delete (next as Record<string, unknown>).endtimeObj
  return next
}

export function PlaylistScheduleDialog({
  playlistName,
  settings,
  open,
  onOpenChange,
  onSave,
}: {
  playlistName: string
  settings?: PlaylistSchedule
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (settings: PlaylistSchedule) => void
}) {
  const [d, setD] = useState<Draft>(() => seed(settings))

  useEffect(() => {
    if (open) setD(seed(settings))
  }, [open, settings])

  const set = (patch: Partial<Draft>) => setD((cur) => ({ ...cur, ...patch }))
  const toggle = (key: 'weekdays' | 'monthdays', id: number) =>
    setD((cur) => {
      const list = cur[key]
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
      return { ...cur, [key]: next.sort((a, b) => a - b) }
    })

  const dateError =
    d.durationEnable && (!d.startdate || !d.enddate)
      ? 'Pick both a start and an end date.'
      : d.durationEnable && d.enddate < d.startdate
        ? 'End date must be on or after the start date.'
        : ''
  const timeError = d.timeEnable && (!d.starttime || !d.endtime) ? 'Pick both a start and an end time.' : ''
  const overnight = d.timeEnable && !!d.starttime && !!d.endtime && d.starttime > d.endtime
  const noDays = d.weekdays.length === 0 || d.monthdays.length === 0
  const invalid = !!dateError || !!timeError

  const save = () => {
    if (invalid) return
    onSave(toSettings(settings, d))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="px-8 pt-8 pb-4 mb-0">
          <DialogTitle className="text-headline-md flex items-center gap-3">
            <Icon name="calendar_month" className="text-primary" />
            Schedule “{playlistName}”
          </DialogTitle>
          <DialogDescription className="text-body-sm">
            The playlist plays only when every enabled condition matches. Changes apply to players
            when you deploy the group.
          </DialogDescription>
        </DialogHeader>
        <hr className="border-border-industrial/50 mx-8" />

        <div className="px-8 py-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Date range */}
          <section className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={d.durationEnable}
                onChange={(e) => set({ durationEnable: e.target.checked })}
                className="w-5 h-5 rounded border-outline-variant bg-surface-container text-primary"
              />
              <span className="text-headline-sm text-text-vibrant">Between dates</span>
              <span className="text-body-sm text-text-muted">(both inclusive)</span>
            </label>
            <div className="flex flex-wrap items-center gap-3 pl-8">
              <input
                type="date"
                aria-label="Start date"
                value={d.startdate}
                disabled={!d.durationEnable}
                onChange={(e) => {
                  const startdate = e.target.value
                  // Like the old UI: keep the end date from falling before the start.
                  set(startdate > d.enddate ? { startdate, enddate: startdate } : { startdate })
                }}
                className={inputCls}
              />
              <span className="text-body-sm text-text-muted">till</span>
              <input
                type="date"
                aria-label="End date"
                value={d.enddate}
                min={d.startdate || undefined}
                disabled={!d.durationEnable}
                onChange={(e) => set({ enddate: e.target.value })}
                className={inputCls}
              />
            </div>
            {dateError && <p className="pl-8 text-body-sm text-status-offline">{dateError}</p>}
          </section>

          {/* Time of day */}
          <section className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={d.timeEnable}
                onChange={(e) => set({ timeEnable: e.target.checked })}
                className="w-5 h-5 rounded border-outline-variant bg-surface-container text-primary"
              />
              <span className="text-headline-sm text-text-vibrant">At a time of day</span>
              <span className="text-body-sm text-text-muted">(e.g. 08:00 – 20:00)</span>
            </label>
            <div className="flex flex-wrap items-center gap-3 pl-8">
              <input
                type="time"
                aria-label="Start time"
                value={d.starttime}
                disabled={!d.timeEnable}
                onChange={(e) => set({ starttime: e.target.value })}
                className={inputCls}
              />
              <span className="text-body-sm text-text-muted">till</span>
              <input
                type="time"
                aria-label="End time"
                value={d.endtime}
                disabled={!d.timeEnable}
                onChange={(e) => set({ endtime: e.target.value })}
                className={inputCls}
              />
            </div>
            {timeError && <p className="pl-8 text-body-sm text-status-offline">{timeError}</p>}
            {overnight && (
              <p className="pl-8 text-body-sm text-text-muted">
                End is earlier than start, so this runs overnight ({d.starttime} → {d.endtime} next day).
              </p>
            )}
          </section>

          {/* Week days */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-headline-sm text-text-vibrant">Week days</span>
              <DayBulk
                onAll={() => set({ weekdays: ALL_WEEKDAYS })}
                onNone={() => set({ weekdays: [] })}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((label, i) => (
                <DayChip
                  key={label}
                  label={label}
                  active={d.weekdays.includes(i + 1)}
                  onClick={() => toggle('weekdays', i + 1)}
                />
              ))}
            </div>
          </section>

          {/* Month days */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-headline-sm text-text-vibrant">Days of month</span>
              <DayBulk
                onAll={() => set({ monthdays: ALL_MONTHDAYS })}
                onNone={() => set({ monthdays: [] })}
              />
            </div>
            <div className="grid grid-cols-7 gap-2">
              {ALL_MONTHDAYS.map((n) => (
                <DayChip
                  key={n}
                  label={String(n)}
                  active={d.monthdays.includes(n)}
                  onClick={() => toggle('monthdays', n)}
                />
              ))}
            </div>
          </section>

          {noDays && (
            <p className="text-body-sm text-tertiary flex items-center gap-2" role="status">
              <Icon name="warning" size={16} />
              No week days or no month days selected — this playlist will never play.
            </p>
          )}
        </div>

        <div className="bg-surface-container-high px-8 py-5 flex justify-end items-center gap-4 border-t border-border-industrial">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-body-sm font-bold text-text-muted hover:text-text-vibrant transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={invalid}
            className="px-6 py-2.5 rounded-lg bg-primary text-on-primary font-bold hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save schedule
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DayChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'min-w-11 px-2 py-1.5 rounded border text-body-sm font-data-mono transition-colors',
        active
          ? 'border-primary text-primary bg-primary/10'
          : 'border-border-industrial text-text-muted hover:border-outline-variant hover:text-text-vibrant',
      )}
    >
      {label}
    </button>
  )
}

function DayBulk({ onAll, onNone }: { onAll: () => void; onNone: () => void }) {
  return (
    <div className="flex gap-3 text-label-caps uppercase tracking-wider">
      <button type="button" onClick={onAll} className="text-primary hover:underline">
        All
      </button>
      <button type="button" onClick={onNone} className="text-text-muted hover:text-text-vibrant hover:underline">
        None
      </button>
    </div>
  )
}
